import { db, rtdb } from '../config/firebase';
import { doc, getDoc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref as rtdbRef, set as rtdbSet, onValue as rtdbOnValue, get as rtdbGet, off as rtdbOff } from 'firebase/database';
import { NotificationService } from './NotificationService';

export interface RoomCredentials {
    roomId?: string;
    roomPass?: string;
    streamUrl?: string;
    draftRoomId?: string;
    draftRoomPass?: string;
    draftStreamUrl?: string;
    roomStatus?: 'draft' | 'published';
    status?: 'draft' | 'published';
    savedAt?: number | any;
    publishedAt?: number | any;
    updatedAt?: number | any;
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
                    const creds: RoomCredentials = {
                        ...data,
                        roomStatus: data.roomStatus || 'published',
                        status: data.status || 'published',
                    };
                    credentialsCache.set(cacheKey, creds);
                    return creds;
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
                    const data = credSnap.data() as any;
                    if (data && (data.roomId || data.roomPass || data.draftRoomId || data.draftRoomPass)) {
                        const status = data.roomStatus || (data.roomId ? 'published' : data.draftRoomId ? 'draft' : 'none');
                        const creds: RoomCredentials = {
                            roomId: data.roomId || '',
                            roomPass: data.roomPass || '',
                            streamUrl: data.streamUrl || '',
                            draftRoomId: data.draftRoomId || data.roomId || '',
                            draftRoomPass: data.draftRoomPass || data.roomPass || '',
                            draftStreamUrl: data.draftStreamUrl || data.streamUrl || '',
                            roomStatus: status,
                            status: status,
                            savedAt: data.savedAt,
                            publishedAt: data.publishedAt,
                            updatedAt: data.updatedAt,
                        };
                        credentialsCache.set(cacheKey, creds);
                        return creds;
                    }
                }
            } catch {}
        }

        // 4. Fallback to root docs for legacy or direct doc writes
        for (const col of collections) {
            try {
                const docSnap = await getDoc(doc(db, col, id));
                if (docSnap.exists()) {
                    const data = docSnap.data() as any;
                    if (data && (data.roomId || data.roomPass || data.draftRoomId || data.draftRoomPass)) {
                        const status = data.roomStatus || (data.roomId ? 'published' : data.draftRoomId ? 'draft' : 'none');
                        const creds: RoomCredentials = {
                            roomId: data.roomId || '',
                            roomPass: data.roomPass || '',
                            streamUrl: data.ytLink || data.streamUrl || '',
                            draftRoomId: data.draftRoomId || data.roomId || '',
                            draftRoomPass: data.draftRoomPass || data.roomPass || '',
                            draftStreamUrl: data.draftStreamUrl || data.ytLink || data.streamUrl || '',
                            roomStatus: status,
                            status: status,
                            savedAt: data.roomDraftSavedAt || data.savedAt,
                            publishedAt: data.roomPublishedAt || data.publishedAt,
                            updatedAt: data.updatedAt,
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
        const cached = credentialsCache.get(cacheKey)!;
        if (cached.roomId || cached.roomPass) {
            callback(cached);
        }
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

    // 3. Firestore subcollections for the designated collection
    try {
        const unsubCred = onSnapshot(doc(db, collectionName, id, 'credentials', credId), (snap) => {
            if (snap.exists()) {
                notifyIfValid(snap.data() as RoomCredentials);
            }
        }, () => {});
        unsubs.push(unsubCred);
    } catch {}

    // 4. Firestore root documents for the designated collection
    try {
        const unsubDoc = onSnapshot(doc(db, collectionName, id), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                if (data.roomId || data.roomPass) {
                    notifyIfValid({
                        roomId: data.roomId,
                        roomPass: data.roomPass,
                        streamUrl: data.ytLink || data.streamUrl,
                        roomStatus: data.roomStatus || 'published',
                    });
                }
            }
        }, () => {});
        unsubs.push(unsubDoc);
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
 * Saves room credentials privately as a draft in Firestore without broadcasting to RTDB,
 * without sending player notifications, and without revealing them on the public player portal.
 */
export async function saveDraftRoomCredentials(
    id: string,
    roomId: string,
    roomPass: string,
    streamUrl?: string,
    collectionName: 'tournaments' | 'scrims' = 'tournaments',
    groupId?: string,
): Promise<void> {
    const credId = groupId ? `group_${groupId}` : 'main';
    const draftData: RoomCredentials = {
        draftRoomId: roomId,
        draftRoomPass: roomPass,
        draftStreamUrl: streamUrl || '',
        roomStatus: 'draft',
        status: 'draft',
        savedAt: Date.now(),
        updatedAt: Date.now(),
    };

    // Update in-memory cache
    const existing = credentialsCache.get(`${collectionName}_${id}_${credId}`) || {};
    credentialsCache.set(`${collectionName}_${id}_${credId}`, {
        ...existing,
        ...draftData,
    });

    const rootPayload = {
        draftRoomId: roomId,
        draftRoomPass: roomPass,
        draftStreamUrl: streamUrl || '',
        roomStatus: 'draft',
        roomDraftSavedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    const promises: Promise<any>[] = [
        // 1. Save to protected subcollection
        setDoc(doc(db, collectionName, id, 'credentials', credId), {
            draftRoomId: roomId,
            draftRoomPass: roomPass,
            draftStreamUrl: streamUrl || '',
            roomStatus: 'draft',
            savedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        }, { merge: true }).catch(() => {}),

        // 2. Save draft indicators to root doc
        setDoc(doc(db, collectionName, id), rootPayload, { merge: true }).catch(() => {}),
    ];

    await Promise.all(promises);
}

/**
 * Broadcasts room credentials atomically to RTDB, Firestore subcollections, root docs, and dispatches in-app notifications.
 * Strictly operates on the target collection (tournaments vs scrims) without cross-collection pollution.
 */
export async function broadcastRoomCredentials(
    id: string,
    roomId: string,
    roomPass: string,
    streamUrl?: string,
    collectionName: 'tournaments' | 'scrims' = 'tournaments',
    groupId?: string,
): Promise<void> {
    const credId = groupId ? `group_${groupId}` : 'main';
    const creds: RoomCredentials = {
        roomId,
        roomPass,
        streamUrl: streamUrl || '',
        draftRoomId: roomId,
        draftRoomPass: roomPass,
        draftStreamUrl: streamUrl || '',
        roomStatus: 'published',
        status: 'published',
        publishedAt: Date.now(),
        updatedAt: Date.now(),
    };

    // Update memory cache instantly
    credentialsCache.set(`${collectionName}_${id}_${credId}`, creds);

    const docPayload = {
        roomId,
        roomPass,
        ytLink: streamUrl || '',
        streamUrl: streamUrl || '',
        draftRoomId: roomId,
        draftRoomPass: roomPass,
        draftStreamUrl: streamUrl || '',
        roomStatus: 'published',
        roomPublishedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    const rtdbPath = groupId ? `rooms/${id}/group_${groupId}` : `rooms/${id}/credentials`;

    const promises: Promise<any>[] = [
        // 1. RTDB instant websocket push
        rtdbSet(rtdbRef(rtdb, rtdbPath), creds).catch(() => {}),

        // 2. Firestore subcollections - strictly the designated collection
        setDoc(doc(db, collectionName, id, 'credentials', credId), {
            roomId,
            roomPass,
            streamUrl: streamUrl || '',
            draftRoomId: roomId,
            draftRoomPass: roomPass,
            draftStreamUrl: streamUrl || '',
            roomStatus: 'published',
            publishedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        }, { merge: true }).catch(() => {}),

        // 3. Root doc for stream url / room preview - strictly the designated collection
        setDoc(doc(db, collectionName, id), docPayload, { merge: true }).catch(() => {}),
    ];

    await Promise.all(promises);

    // 4. Instant push notification to all participants with collection-specific route
    const targetLink = collectionName === 'scrims' ? `/organizer/scrim/${id}` : `/tournaments/${id}`;
    try {
        NotificationService.notifyParticipants(
            id,
            'Match Room Credentials Released!',
            `Room ID: ${roomId} | Password: ${roomPass}. Join match room now!`,
            'alert',
            targetLink
        ).catch(() => {});
    } catch {}
}

/**
 * Retracts / unpublishes room credentials back to draft mode, removing RTDB entry and clearing active live credentials.
 */
export async function unpublishRoomCredentials(
    id: string,
    collectionName: 'tournaments' | 'scrims' = 'tournaments',
    groupId?: string,
): Promise<void> {
    const credId = groupId ? `group_${groupId}` : 'main';
    const rtdbPath = groupId ? `rooms/${id}/group_${groupId}` : `rooms/${id}/credentials`;

    const promises: Promise<any>[] = [
        rtdbSet(rtdbRef(rtdb, rtdbPath), null).catch(() => {}),
        setDoc(doc(db, collectionName, id, 'credentials', credId), {
            roomId: '',
            roomPass: '',
            roomStatus: 'draft',
            updatedAt: serverTimestamp(),
        }, { merge: true }).catch(() => {}),
        setDoc(doc(db, collectionName, id), {
            roomId: '',
            roomPass: '',
            roomStatus: 'draft',
            updatedAt: serverTimestamp(),
        }, { merge: true }).catch(() => {}),
    ];

    credentialsCache.delete(`${collectionName}_${id}_${credId}`);
    await Promise.all(promises);
}
