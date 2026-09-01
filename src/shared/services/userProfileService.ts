import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

export interface UserDocumentInput {
    uid: string;
    email: string;
    username: string;
    role?: 'player' | 'organizer' | 'admin';
    inGameId?: string;
    inGameName?: string;
    teamName?: string;
    phone?: string;
    profilePicUrl?: string;
    isBanned?: boolean;
    isOrganizer?: boolean;
    createdAt?: unknown;
}

export interface PublicProfileInput {
    uid: string;
    username: string;
    role?: 'player' | 'organizer' | 'admin';
    inGameId?: string;
    inGameName?: string;
    profilePicUrl?: string;
}

/**
 * Base shape for a new /users/{uid} document.
 *
 * The create rule (firestore.rules) requires role 'player', balance 0,
 * totalEarnings 0 and a valid username/email, so those are always present.
 * isBanned/isOrganizer/createdAt are ONLY written when explicitly provided:
 * a merge-write over a document just created by Register.tsx becomes an
 * UPDATE, and the users update rule only permits a fixed key set — adding
 * those fields (or a fresh createdAt) would make the write fail the rule.
 */
export function buildUserDocument(input: UserDocumentInput): Record<string, unknown> {
    const data: Record<string, unknown> = {
        uid: input.uid,
        email: input.email,
        username: input.username,
        role: input.role ?? 'player',
        balance: 0,
        totalEarnings: 0,
    };
    if (input.inGameId !== undefined) data.inGameId = input.inGameId;
    if (input.inGameName !== undefined) data.inGameName = input.inGameName;
    if (input.teamName !== undefined) data.teamName = input.teamName;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.profilePicUrl !== undefined) data.profilePicUrl = input.profilePicUrl;
    if (input.isBanned !== undefined) data.isBanned = input.isBanned;
    if (input.isOrganizer !== undefined) data.isOrganizer = input.isOrganizer;
    if (input.createdAt !== undefined) data.createdAt = input.createdAt;
    return data;
}

/**
 * Base shape for a new /users_public/{uid} document. The field set is
 * strictly constrained by isValidPublicProfile() (keys().hasOnly) in
 * firestore.rules, so only allowed keys may be written.
 */
export function buildPublicProfile(input: PublicProfileInput): Record<string, unknown> {
    const data: Record<string, unknown> = {
        uid: input.uid,
        username: input.username,
        role: input.role ?? 'player',
        totalEarnings: 0,
        updatedAt: serverTimestamp(),
    };
    if (input.inGameId !== undefined) data.inGameId = input.inGameId;
    if (input.inGameName !== undefined) data.inGameName = input.inGameName;
    if (input.profilePicUrl !== undefined) data.profilePicUrl = input.profilePicUrl;
    return data;
}

/**
 * Merge-writes are used for the AuthContext auto-provision path. If the
 * document was just created by Register.tsx this becomes an update with an
 * empty (or rule-allowed) field diff; if the user is brand-new (e.g. first
 * Google sign-in) it is a compliant create.
 */
export async function ensureUserDocument(input: UserDocumentInput): Promise<void> {
    try {
        await setDoc(doc(db, 'users', input.uid), buildUserDocument(input), { merge: true });
    } catch (e:any) {
        console.error('ensureUserDocument failed:', e);
        if (import.meta.env.VITE_DEBUG_AUTH === 'true') {
            throw e;
        }
    }
}

export async function ensurePublicProfile(input: PublicProfileInput): Promise<void> {
    try {
        await setDoc(doc(db, 'users_public', input.uid), buildPublicProfile(input), { merge: true });
    } catch (e:any) {
        console.error('ensurePublicProfile failed:', e);
        if (import.meta.env.VITE_DEBUG_AUTH === 'true') {
            throw e;
        }
    }
}
