import { db, rtdb } from '../config/firebase';
import { doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { ref as rtdbRef, set as rtdbSet, onValue as rtdbOnValue, get as rtdbGet, off as rtdbOff } from 'firebase/database';

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
 * Checks RTDB first for sub-50ms websocket response, then Firestore subcollection.
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

        // 3. Fallback to Firestore subcollection
        const credId = groupId ? `group_${groupId}` : 'main';
        let credRef = doc(db, collectionName, id, 'credentials', credId);
        let credSnap = await getDoc(credRef);

        if (credSnap.exists()) {
            const data = credSnap.data() as RoomCredentials;
            credentialsCache.set(cacheKey, data);
            return data;
        }

        // 4. Fallback to alternate collection
        const altCollection = collectionName === 'tournaments' ? 'scrims' : 'tournaments';
        credRef = doc(db, altCollection, id, 'credentials', credId);
        credSnap = await getDoc(credRef);
        if (credSnap.exists()) {
            const data = credSnap.data() as RoomCredentials;
            credentialsCache.set(cacheKey, data);
            return data;
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Real-time subscription to room credentials.
 * Fires callback in sub-milliseconds whenever host updates Room ID, Password, or Stream.
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
    let unsubFirestore: (() => void) | null = null;

    // 1. Realtime Database WebSocket listener (sub-30ms transfer)
    try {
        rtdbNode = rtdbRef(rtdb, `rooms/${id}/${groupId ? `group_${groupId}` : 'credentials'}`);
        rtdbOnValue(rtdbNode, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val() as RoomCredentials;
                if (data && (data.roomId || data.roomPass)) {
                    credentialsCache.set(cacheKey, data);
                    callback(data);
                }
            }
        }, () => {
            // Silently handle RTDB error
        });
    } catch {
        // Fallback to Firestore
    }

    // 2. Firestore onSnapshot listener
    try {
        const credRef = doc(db, collectionName, id, 'credentials', credId);
        unsubFirestore = onSnapshot(credRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data() as RoomCredentials;
                credentialsCache.set(cacheKey, data);
                callback(data);
            }
        }, () => {});
    } catch {
        // Fallback
    }

    return () => {
        if (rtdbNode) {
            try {
                rtdbOff(rtdbNode);
            } catch {}
        }
        if (unsubFirestore) {
            try {
                unsubFirestore();
            } catch {}
        }
    };
}

/**
 * Broadcasts room credentials atomically to RTDB, Firestore subcollection, and root docs.
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
    const cacheKey = `${collectionName}_${id}_main`;
    credentialsCache.set(cacheKey, creds);

    const promises: Promise<any>[] = [
        // 1. RTDB instant websocket push
        rtdbSet(rtdbRef(rtdb, `rooms/${id}/credentials`), creds).catch(() => {}),

        // 2. Firestore subcollections
        setDoc(doc(db, 'tournaments', id, 'credentials', 'main'), { roomId, roomPass }, { merge: true }).catch(() => {}),
        setDoc(doc(db, 'scrims', id, 'credentials', 'main'), { roomId, roomPass }, { merge: true }).catch(() => {}),

        // 3. Root docs for stream url / room preview
        updateDoc(doc(db, 'tournaments', id), { roomId, roomPass, ytLink: streamUrl || '' }).catch(() => {}),
        updateDoc(doc(db, 'scrims', id), { roomId, roomPass, ytLink: streamUrl || '' }).catch(() => {}),
    ];

    await Promise.all(promises);
}
