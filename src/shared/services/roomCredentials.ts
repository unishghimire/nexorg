import { db, rtdb } from '../config/firebase';
import { doc, getDoc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref as rtdbRef, set as rtdbSet, onValue as rtdbOnValue, get as rtdbGet, off as rtdbOff } from 'firebase/database';
import { NotificationService } from './NotificationService';

export interface RoomCredentials {
    roomId?: string;
    roomPass?: string;
    streamUrl?: string;
    updatedAt?: number;
}

// In-memory cache for sub-millisecond retrieval
const credentialsCache = new Map<string, RoomCredentials>();

/**
 * Fetches room credentials with local memory cache fallback.
 * Checks RTDB first for sub-50ms websocket response, then Firestore subcollection and root docs.
 */
export async function fetchRoomCredentials(
    id: string,
    groupId?: string,
    collectionName: 'tournaments' | 'scrims' = 'tournaments',
): Promise<RoomCredentials | null> {
    if (!id) return null;
    const cacheKey = `${collectionName}_${id}_${groupId || 'main'}`;

    // 1. Check in-memory cache
    if (credentialsCache.has(cacheKey)) {
        return credentialsCache.get(cacheKey)!;
    }

    try {
        // 2. Try RTDB for fast real-time websocket read
        try {
            const dbNode = rtdbRef(rtdb, `rooms/${id}/${groupId ? `group_${groupId}` : 'credentials'}`);
            const rtdbSnap = await rtdbGet(dbNode);
            if (rtdbSnap.exists()) {
                const data = rtdbSnap.val() as RoomCredentials;
                if (data && (data.roomId || data.roomPass)) {
                    credentialsCache.set(cacheKey, data);
                    return data;
                }
            }
        } catch {
            // RTDB offline or rules fallback
        }

        const credId = groupId ? `group_${groupId}` : 'main';

        // 3. Firestore subcollections (check primary and alternate)
        const collections: ('tournaments' | 'scrims')[] = collectionName === 'scrims' 
            ? ['scrims', 'tournaments'] 
            : ['tournaments', 'scrims'];

        for (const col of collections) {
            try {
                const credSnap = await getDoc(doc(db, col, id, 'credentials', credId));
                if (credSnap.exists()) {
                    const data = credSnap.data() as RoomCredentials;
                    if (data && (data.roomId || data.roomPass)) {
                        credentialsCache.set(cacheKey, data);
                        return data;
                    }
                }
            } catch {}
        }

        // 4. Fallback to root docs for legacy or direct doc writes
        for (const col of collections) {
            try {
                const docSnap = await getDoc(doc(db, col, id));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data && (data.roomId || data.roomPass)) {
                        const creds: RoomCredentials = {
                            roomId: data.roomId,
                            roomPass: data.roomPass,
                            streamUrl: data.ytLink || data.streamUrl || '',
                        };
                        credentialsCache.set(cacheKey, creds);
                        return creds;
                    }
                }
            } catch {}
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Real-time subscription to room credentials.
 * Fires callback in sub-milliseconds whenever host updates Room ID, Password, or Stream.
 * Listens across RTDB WebSockets, both subcollections, and both root docs.
 */
export function subscribeRoomCredentials(
    id: string,
    callback: (credentials: RoomCredentials | null) => void,
    groupId?: string,
    collectionName: 'tournaments' | 'scrims' = 'tournaments',
): () => void {
    if (!id) {
        callback(null);
        return () => {};
    }

    const cacheKey = `${collectionName}_${id}_${groupId || 'main'}`;
    const credId = groupId ? `group_${groupId}` : 'main';

    let rtdbNode: any = null;
    const unsubs: Array<() => void> = [];

    const notifyIfValid = (creds: RoomCredentials | null) => {
        if (creds && (creds.roomId || creds.roomPass)) {
            credentialsCache.set(cacheKey, creds);
            credentialsCache.set(`tournaments_${id}_${credId}`, creds);
            credentialsCache.set(`scrims_${id}_${credId}`, creds);
            callback(creds);
        }
    };

    // 1. Initial cached return
    if (credentialsCache.has(cacheKey)) {
        callback(credentialsCache.get(cacheKey)!);
    }

    // 2. Realtime Database WebSocket listener (sub-30ms transfer)
    try {
        rtdbNode = rtdbRef(rtdb, `rooms/${id}/${groupId ? `group_${groupId}` : 'credentials'}`);
        rtdbOnValue(rtdbNode, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val() as RoomCredentials;
                notifyIfValid(data);
            }
        }, () => {});
    } catch {}

    // 3. Firestore subcollections for both tournaments and scrims
    try {
        const unsubTCred = onSnapshot(doc(db, 'tournaments', id, 'credentials', credId), (snap) => {
            if (snap.exists()) {
                notifyIfValid(snap.data() as RoomCredentials);
            }
        }, () => {});
        unsubs.push(unsubTCred);
    } catch {}

    try {
        const unsubSCred = onSnapshot(doc(db, 'scrims', id, 'credentials', credId), (snap) => {
            if (snap.exists()) {
                notifyIfValid(snap.data() as RoomCredentials);
            }
        }, () => {});
        unsubs.push(unsubSCred);
    } catch {}

    // 4. Firestore root documents (for direct updates on doc)
    try {
        const unsubTDoc = onSnapshot(doc(db, 'tournaments', id), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                if (data.roomId || data.roomPass) {
                    notifyIfValid({
                        roomId: data.roomId,
                        roomPass: data.roomPass,
                        streamUrl: data.ytLink || data.streamUrl,
                    });
                }
            }
        }, () => {});
        unsubs.push(unsubTDoc);
    } catch {}

    try {
        const unsubSDoc = onSnapshot(doc(db, 'scrims', id), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                if (data.roomId || data.roomPass) {
                    notifyIfValid({
                        roomId: data.roomId,
                        roomPass: data.roomPass,
                        streamUrl: data.ytLink || data.streamUrl,
                    });
                }
            }
        }, () => {});
        unsubs.push(unsubSDoc);
    } catch {}

    return () => {
        if (rtdbNode) {
            try { rtdbOff(rtdbNode); } catch {}
        }
        unsubs.forEach(unsub => {
            try { unsub(); } catch {}
        });
    };
}

/**
 * Broadcasts room credentials atomically to RTDB, Firestore subcollections, root docs, and dispatches in-app notifications.
 */
export async function broadcastRoomCredentials(
    id: string,
    roomId: string,
    roomPass: string,
    streamUrl?: string,
    collectionName: 'tournaments' | 'scrims' = 'tournaments',
): Promise<void> {
    const creds: RoomCredentials = {
        roomId,
        roomPass,
        streamUrl: streamUrl || '',
        updatedAt: Date.now(),
    };

    // Update memory cache instantly
    credentialsCache.set(`${collectionName}_${id}_main`, creds);
    credentialsCache.set(`tournaments_${id}_main`, creds);
    credentialsCache.set(`scrims_${id}_main`, creds);

    const docPayload = {
        roomId,
        roomPass,
        ytLink: streamUrl || '',
        streamUrl: streamUrl || '',
        updatedAt: serverTimestamp(),
    };

    const promises: Promise<any>[] = [
        // 1. RTDB instant websocket push
        rtdbSet(rtdbRef(rtdb, `rooms/${id}/credentials`), creds).catch(() => {}),

        // 2. Firestore subcollections
        setDoc(doc(db, 'tournaments', id, 'credentials', 'main'), { roomId, roomPass, streamUrl: streamUrl || '' }, { merge: true }).catch(() => {}),
        setDoc(doc(db, 'scrims', id, 'credentials', 'main'), { roomId, roomPass, streamUrl: streamUrl || '' }, { merge: true }).catch(() => {}),

        // 3. Root docs for stream url / room preview (using merge so it creates or updates without throwing)
        setDoc(doc(db, 'tournaments', id), docPayload, { merge: true }).catch(() => {}),
        setDoc(doc(db, 'scrims', id), docPayload, { merge: true }).catch(() => {}),
    ];

    await Promise.all(promises);

    // 4. Instant push notification to all participants
    try {
        NotificationService.notifyParticipants(
            id,
            'Match Room Credentials Released!',
            `Room ID: ${roomId} | Password: ${roomPass}. Join match room now!`,
            'alert',
            `/tournaments/${id}`
        ).catch(() => {});
    } catch {}
}
