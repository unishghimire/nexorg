import { db, rtdb } from '../config/firebase';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref as rtdbRef, set as rtdbSet, onValue as rtdbOnValue, off as rtdbOff } from 'firebase/database';

export interface LiveMatchState {
    status: 'upcoming' | 'live' | 'in_progress' | 'completed' | 'paused';
    matchTime?: number;
    currentRound?: number;
    totalRounds?: number;
    streamUrl?: string;
    roomId?: string;
    roomPass?: string;
    announcement?: string;
    updatedAt: number;
}

/**
 * Subscribes to live match status and clock in sub-50ms via RTDB WebSockets + Firestore.
 */
export function subscribeLiveMatchSync(
    tournamentId: string,
    callback: (state: LiveMatchState | null) => void,
    collectionName: 'tournaments' | 'scrims' = 'tournaments'
): () => void {
    if (!tournamentId) {
        callback(null);
        return () => {};
    }

    let rtdbNode: any = null;
    let unsubFirestore: (() => void) | null = null;

    try {
        // 1. RTDB instant WebSocket synchronization
        rtdbNode = rtdbRef(rtdb, `matches/${tournamentId}/liveState`);
        rtdbOnValue(rtdbNode, (snap) => {
            if (snap.exists()) {
                callback(snap.val() as LiveMatchState);
            }
        }, () => {});
    } catch {}

    try {
        // 2. Firestore real-time doc synchronization
        unsubFirestore = onSnapshot(doc(db, collectionName, tournamentId), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                callback({
                    status: (data.status || 'upcoming') as any,
                    matchTime: data.startTime ? (data.startTime.toMillis?.() || Date.now()) : Date.now(),
                    roomId: data.roomId,
                    roomPass: data.roomPass,
                    streamUrl: data.ytLink,
                    updatedAt: Date.now(),
                });
            }
        }, () => {});
    } catch {}

    return () => {
        if (rtdbNode) {
            try { rtdbOff(rtdbNode); } catch {}
        }
        if (unsubFirestore) {
            try { unsubFirestore(); } catch {}
        }
    };
}

/**
 * Updates live match state across RTDB and Firestore in milliseconds
 */
export async function updateLiveMatchSync(
    tournamentId: string,
    state: Partial<LiveMatchState>,
    collectionName: 'tournaments' | 'scrims' = 'tournaments'
): Promise<void> {
    const payload: LiveMatchState = {
        status: state.status || 'live',
        matchTime: state.matchTime || Date.now(),
        roomId: state.roomId || '',
        roomPass: state.roomPass || '',
        streamUrl: state.streamUrl || '',
        updatedAt: Date.now(),
        ...state,
    };

    await Promise.all([
        rtdbSet(rtdbRef(rtdb, `matches/${tournamentId}/liveState`), payload).catch(() => {}),
        updateDoc(doc(db, collectionName, tournamentId), {
            status: payload.status,
            roomId: payload.roomId,
            roomPass: payload.roomPass,
            ytLink: payload.streamUrl,
            updatedAt: serverTimestamp(),
        }).catch(() => {}),
    ]);
}
