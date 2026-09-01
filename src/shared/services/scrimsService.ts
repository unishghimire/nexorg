import {
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    updateDoc,
    setDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
    onSnapshot,
    Timestamp,
    Unsubscribe
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ═══════════════════════════════════════════════════════════════
// TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════

export type ScrimStatus = 'open' | 'full' | 'in_progress' | 'completed' | 'cancelled';

export interface ScrimRequirements {
    minTier?: string;
    discordRequired?: boolean;
    entryFee?: number;
    minRank?: string;
    levelRequired?: number;
    teamSize?: number;
    platform?: 'mobile' | 'pc' | 'crossplay';
    customRules?: string[];
    [key: string]: unknown;
}

export interface RoomDetails {
    roomId: string;
    roomPassword?: string;
    streamUrl?: string;
}

export interface ScrimSlot {
    slotNumber: number;
    teamName?: string | null;
    teamId?: string | null;
    status: 'open' | 'filled' | 'locked';
    reservedBy?: string | null;
}

export interface Scrim {
    id: string;
    title: string;
    game: string;
    hostUid: string;
    hostName?: string;
    matchTime: Timestamp | Date | string;
    status: ScrimStatus;
    slots: ScrimSlot[];
    totalSlots: number;
    filledSlots: number;
    map?: string;
    format?: 'Battle Royale' | '5v5' | 'Clash Squad' | string;
    prizePool?: number;
    requirements?: ScrimRequirements;
    roomDetails?: RoomDetails;
    bannerUrl?: string;
    createdAt: Timestamp | Date | string;
    updatedAt: Timestamp | Date | string;
}

export interface CreateScrimInput {
    title: string;
    game: string;
    hostUid: string;
    hostName?: string;
    matchTime: Date | Timestamp | string;
    totalSlots?: number;
    map?: string;
    format?: 'Battle Royale' | '5v5' | 'Clash Squad' | string;
    prizePool?: number;
    requirements?: ScrimRequirements;
    roomDetails?: RoomDetails;
    bannerUrl?: string;
    slots?: ScrimSlot[];
}

export const SCRIMS_COLLECTION = 'scrims';

// ═══════════════════════════════════════════════════════════════
// HELPER UTILITIES
// ═══════════════════════════════════════════════════════════════

/**
 * Initializes a default array of open scrim slots based on the total slot count.
 */
export function generateInitialSlots(totalSlots: number): ScrimSlot[] {
    const safeTotal = Math.max(1, Math.min(100, Math.floor(totalSlots || 12)));
    return Array.from({ length: safeTotal }, (_, i) => ({
        slotNumber: i + 1,
        teamName: null,
        teamId: null,
        status: 'open' as const,
        reservedBy: null,
    }));
}

/**
 * Maps a Firestore document snapshot to a clean, strongly-typed Scrim object.
 */
export function mapDocToScrim(id: string, data: Record<string, any>): Scrim {
    const rawSlots = Array.isArray(data.slots) ? data.slots : generateInitialSlots(data.totalSlots || 12);
    const filledCount = rawSlots.filter((s: ScrimSlot) => s.status === 'filled').length;

    return {
        id,
        title: data.title || 'Untitled Scrim',
        game: data.game || 'Free Fire',
        hostUid: data.hostUid || data.orgId || '',
        hostName: data.hostName || '',
        matchTime: data.matchTime || data.startTime || new Date().toISOString(),
        status: (data.status as ScrimStatus) || 'open',
        slots: rawSlots,
        totalSlots: data.totalSlots || rawSlots.length || 12,
        filledSlots: data.filledSlots ?? filledCount,
        map: data.map || 'Bermuda',
        format: data.format || 'Battle Royale',
        prizePool: data.prizePool ?? 0,
        requirements: {
            minTier: data.requirements?.minTier ?? data.minTier,
            discordRequired: data.requirements?.discordRequired ?? data.discordRequired ?? false,
            entryFee: data.requirements?.entryFee ?? data.entryFee ?? 0,
            minRank: data.requirements?.minRank ?? data.minRank,
            levelRequired: data.requirements?.levelRequired ?? data.levelRequired,
            teamSize: data.requirements?.teamSize ?? data.teamSize ?? 4,
            platform: data.requirements?.platform ?? data.platform ?? 'mobile',
            customRules: data.requirements?.customRules ?? data.customRules ?? [],
        },
        roomDetails: {
            roomId: data.roomDetails?.roomId || data.roomId || '',
            roomPassword: data.roomDetails?.roomPassword || data.roomPass || '',
            streamUrl: data.roomDetails?.streamUrl || data.streamUrl || data.ytLink || '',
        } as RoomDetails,
        bannerUrl: data.bannerUrl || '',
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
    };
}

// ═══════════════════════════════════════════════════════════════
// SCRIMS SERVICE MODULE
// ═══════════════════════════════════════════════════════════════

export const ScrimsService = {
    /**
     * Create a new scrim with auto-timestamp, normalized slots, and default requirements.
     *
     * @param data The initial parameters for the scrim.
     * @returns The created Scrim object with its generated Firestore ID.
     */
    async createScrim(data: CreateScrimInput): Promise<Scrim> {
        if (!data.title?.trim()) {
            throw new Error('Scrim title is required.');
        }
        if (!data.game?.trim()) {
            throw new Error('Game title is required.');
        }
        if (!data.hostUid?.trim()) {
            throw new Error('Host UID is required to create a scrim.');
        }

        const totalSlots = Math.max(2, Math.min(100, Number(data.totalSlots) || 12));
        const initialSlots = data.slots && data.slots.length === totalSlots
            ? data.slots
            : generateInitialSlots(totalSlots);
        const filledSlots = initialSlots.filter(s => s.status === 'filled').length;

        const matchTimeSafe = data.matchTime instanceof Date
            ? Timestamp.fromDate(data.matchTime)
            : data.matchTime;

        const scrimPayload = {
            title: data.title.trim(),
            game: data.game.trim(),
            hostUid: data.hostUid.trim(),
            hostName: data.hostName?.trim() || '',
            matchTime: matchTimeSafe,
            status: 'open' as ScrimStatus,
            slots: initialSlots,
            totalSlots,
            filledSlots,
            map: data.map?.trim() || 'Bermuda',
            format: data.format || 'Battle Royale',
            prizePool: Math.max(0, Number(data.prizePool) || 0),
            requirements: {
                minTier: data.requirements?.minTier || 'Bronze',
                discordRequired: Boolean(data.requirements?.discordRequired),
                entryFee: Math.max(0, Number(data.requirements?.entryFee) || 0),
                minRank: data.requirements?.minRank || '',
                levelRequired: Number(data.requirements?.levelRequired) || 0,
                teamSize: Number(data.requirements?.teamSize) || 4,
                platform: data.requirements?.platform || 'mobile',
                customRules: Array.isArray(data.requirements?.customRules) ? data.requirements?.customRules : [],
            },
            // AUD-013: credentials must NOT be stored in the public scrim doc.
            // Only streamUrl is public — roomId/roomPassword go to credentials subcollection.
            ytLink: data.roomDetails?.streamUrl || '',
            streamUrl: data.roomDetails?.streamUrl || '',
            bannerUrl: data.bannerUrl || '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        try {
            const docRef = await addDoc(collection(db, SCRIMS_COLLECTION), scrimPayload);
            // AUD-013: write credentials to protected subcollection, not public doc
            if (data.roomDetails?.roomId || data.roomDetails?.roomPassword) {
                await setDoc(doc(db, SCRIMS_COLLECTION, docRef.id, 'credentials', 'main'), {
                    roomId: data.roomDetails.roomId || '',
                    roomPass: data.roomDetails.roomPassword || '',
                });
            }
            return {
                id: docRef.id,
                ...scrimPayload,
                createdAt: new Date(),
                updatedAt: new Date(),
            } as Scrim;
        } catch (error: any) {
            console.error('Error creating scrim in Firestore:', error);
            throw new Error(`Failed to create scrim: ${error?.message || 'Database write error'}`);
        }
    },

    /**
     * Update status (open, full, in_progress, completed, cancelled) and optionally attach roomId and roomPassword.
     *
     * @param scrimId The ID of the scrim document to update.
     * @param status The new status for the scrim.
     * @param roomDetails Optional room credentials (roomId, roomPassword, streamUrl).
     */
    async updateScrimStatus(
        scrimId: string,
        status: ScrimStatus,
        roomDetails?: RoomDetails
    ): Promise<void> {
        if (!scrimId?.trim()) {
            throw new Error('Invalid Scrim ID provided.');
        }

        const validStatuses: ScrimStatus[] = ['open', 'full', 'in_progress', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            throw new Error(`Invalid status "${status}". Allowed values: ${validStatuses.join(', ')}`);
        }

        const updatePayload: Record<string, any> = {
            status,
            updatedAt: serverTimestamp(),
        };

        // AUD-013: only streamUrl goes to the public doc — credentials go to subcollection
        if (roomDetails?.streamUrl) {
            updatePayload.ytLink = roomDetails.streamUrl;
            updatePayload.streamUrl = roomDetails.streamUrl;
        }

        try {
            const docRef = doc(db, SCRIMS_COLLECTION, scrimId);
            await updateDoc(docRef, updatePayload);
            // Write credentials to protected subcollection
            if (roomDetails?.roomId || roomDetails?.roomPassword) {
                await setDoc(doc(db, SCRIMS_COLLECTION, scrimId, 'credentials', 'main'), {
                    roomId: roomDetails.roomId || '',
                    roomPass: roomDetails.roomPassword || '',
                }, { merge: true });
            }
        } catch (error: any) {
            console.error(`Error updating scrim status for ${scrimId}:`, error);
            throw new Error(`Failed to update scrim status: ${error?.message || 'Database update error'}`);
        }
    },

    /**
     * Update dynamic requirements like minTier, discordRequired, or entryFee.
     *
     * @param scrimId The ID of the scrim document.
     * @param requirements Partial requirements object to merge with existing settings.
     */
    async updateScrimRequirements(
        scrimId: string,
        requirements: Partial<ScrimRequirements>
    ): Promise<void> {
        if (!scrimId?.trim()) {
            throw new Error('Invalid Scrim ID provided.');
        }
        if (!requirements || typeof requirements !== 'object') {
            throw new Error('Requirements payload must be a non-empty object.');
        }

        const sanitizedRequirements: Record<string, any> = {};
        if (requirements.minTier !== undefined) sanitizedRequirements['requirements.minTier'] = String(requirements.minTier);
        if (requirements.discordRequired !== undefined) sanitizedRequirements['requirements.discordRequired'] = Boolean(requirements.discordRequired);
        if (requirements.entryFee !== undefined) sanitizedRequirements['requirements.entryFee'] = Math.max(0, Number(requirements.entryFee) || 0);
        if (requirements.minRank !== undefined) sanitizedRequirements['requirements.minRank'] = String(requirements.minRank);
        if (requirements.levelRequired !== undefined) sanitizedRequirements['requirements.levelRequired'] = Math.max(0, Number(requirements.levelRequired) || 0);
        if (requirements.teamSize !== undefined) sanitizedRequirements['requirements.teamSize'] = Math.max(1, Number(requirements.teamSize) || 4);
        if (requirements.platform !== undefined) sanitizedRequirements['requirements.platform'] = requirements.platform;
        if (requirements.customRules !== undefined) sanitizedRequirements['requirements.customRules'] = requirements.customRules;

        // Keep root-level entryFee synced if provided
        if (requirements.entryFee !== undefined) {
            sanitizedRequirements.entryFee = Math.max(0, Number(requirements.entryFee) || 0);
        }

        sanitizedRequirements.updatedAt = serverTimestamp();

        try {
            const docRef = doc(db, SCRIMS_COLLECTION, scrimId);
            await updateDoc(docRef, sanitizedRequirements);
        } catch (error: any) {
            console.error(`Error updating scrim requirements for ${scrimId}:`, error);
            throw new Error(`Failed to update scrim requirements: ${error?.message || 'Database update error'}`);
        }
    },

    /**
     * Query open scrims optionally filtered by game, ordered by matchTime.
     *
     * @param game Optional game filter (e.g. 'Free Fire', 'PUBG Mobile', 'Valorant').
     * @returns Array of open Scrim objects sorted by upcoming matchTime.
     */
    async getOpenScrims(game?: string): Promise<Scrim[]> {
        try {
            const constraints: any[] = [
                where('status', '==', 'open'),
                orderBy('matchTime', 'asc')
            ];

            if (game && game.trim() !== '' && game.toLowerCase() !== 'all') {
                constraints.unshift(where('game', '==', game.trim()));
            }

            const q = query(collection(db, SCRIMS_COLLECTION), ...constraints);
            const snapshot = await getDocs(q);

            return snapshot.docs.map(docSnap => mapDocToScrim(docSnap.id, docSnap.data()));
        } catch (error: any) {
            console.error('Error fetching open scrims:', error);
            // Fallback query without compound order constraint in case indexes are building
            try {
                const fallbackQ = game && game.toLowerCase() !== 'all'
                    ? query(collection(db, SCRIMS_COLLECTION), where('game', '==', game.trim()))
                    : query(collection(db, SCRIMS_COLLECTION));
                const snap = await getDocs(fallbackQ);
                return snap.docs
                    .map(d => mapDocToScrim(d.id, d.data()))
                    .filter(s => s.status === 'open')
                    .sort((a, b) => {
                        const aTime = new Date(a.matchTime as any).getTime() || 0;
                        const bTime = new Date(b.matchTime as any).getTime() || 0;
                        return aTime - bTime;
                    });
            } catch (fallbackErr) {
                console.error('Fallback scrim query also failed:', fallbackErr);
                throw new Error(`Failed to load open scrims: ${error?.message || 'Query failed'}`);
            }
        }
    },

    /**
     * Fetch a single scrim document by ID.
     */
    async getScrimById(scrimId: string): Promise<Scrim | null> {
        if (!scrimId?.trim()) return null;
        try {
            const docSnap = await getDoc(doc(db, SCRIMS_COLLECTION, scrimId.trim()));
            if (!docSnap.exists()) return null;
            return mapDocToScrim(docSnap.id, docSnap.data());
        } catch (error) {
            console.error(`Error fetching scrim ${scrimId}:`, error);
            return null;
        }
    },

    /**
     * Subscribe to real-time updates for a single scrim document.
     */
    subscribeToScrim(scrimId: string, callback: (scrim: Scrim | null) => void): Unsubscribe {
        if (!scrimId?.trim()) {
            callback(null);
            return () => {};
        }

        return onSnapshot(
            doc(db, SCRIMS_COLLECTION, scrimId.trim()),
            (docSnap) => {
                if (docSnap.exists()) {
                    callback(mapDocToScrim(docSnap.id, docSnap.data()));
                } else {
                    callback(null);
                }
            },
            (error) => {
                console.error(`Realtime error on scrim ${scrimId}:`, error);
                callback(null);
            }
        );
    }
};

// Named function exports for direct import convenience:
export const createScrim = ScrimsService.createScrim;
export const updateScrimStatus = ScrimsService.updateScrimStatus;
export const updateScrimRequirements = ScrimsService.updateScrimRequirements;
export const getOpenScrims = ScrimsService.getOpenScrims;
export const getScrimById = ScrimsService.getScrimById;
export const subscribeToScrim = ScrimsService.subscribeToScrim;
