import { db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';

/**
 * Fetches room credentials for a tournament, scrim, or specific group.
 * Uses the /{collection}/{id}/credentials subcollection which is protected
 * by Firestore rules — only host + joined participants can read.
 *
 * @param id The tournament or scrim ID
 * @param groupId Optional group ID for per-group credentials
 * @param collectionName 'tournaments' (default) or 'scrims'
 * @returns { roomId, roomPass } or null if not found / no access
 */
export async function fetchRoomCredentials(
    id: string,
    groupId?: string,
    collectionName: 'tournaments' | 'scrims' = 'tournaments',
): Promise<{ roomId?: string; roomPass?: string } | null> {
    try {
        const credId = groupId ? `group_${groupId}` : 'main';
        const credRef = doc(db, collectionName, id, 'credentials', credId);
        const credSnap = await getDoc(credRef);

        if (credSnap.exists()) {
            return credSnap.data() as { roomId?: string; roomPass?: string };
        }
        return null;
    } catch {
        // ponytail: return null on permission error — UI falls back to tournament-level creds
        return null;
    }
}
