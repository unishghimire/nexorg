import { Timestamp } from 'firebase/firestore';

export const formatCurrency = (amount: number | string, prefix: string = 'Rs. ') => {
    const num = Number(amount);
    if (amount === null || amount === undefined || isNaN(num)) return `${prefix}0`;
    return `${num < 0 ? '-' : ''}${prefix}${new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(Math.abs(num))}`;
};

type FirestoreTimestamp = { seconds: number; nanoseconds: number; toDate?: () => Date };
type TimestampInput = import('firebase/firestore').Timestamp | FirestoreTimestamp | Date | string | number | null | undefined;

export const toDateSafe = (ts: TimestampInput): Date | null => {
    if (!ts) return null;

    if (ts instanceof Timestamp) return ts.toDate();

    if ((ts as FirestoreTimestamp).seconds !== undefined) {
        return new Timestamp((ts as FirestoreTimestamp).seconds, (ts as FirestoreTimestamp).nanoseconds).toDate();
    }

    const date = new Date(ts as string | number | Date);
    return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDate = (ts: TimestampInput): string => {
    const date = toDateSafe(ts);
    return date ? date.toLocaleString('en-NP') : 'N/A';
};

export const timeAgo = (ts: TimestampInput): string => {
    const date = toDateSafe(ts);
    if (!date) return 'Just now';
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m ago";
    return "Just now";
};

export const getYoutubeId = (url: string | undefined) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

// ─────────────────────────────────────────────────────────────────────────────
// 100-LEVEL PROGRESSION SYSTEM (Linear Arithmetic Sequence: 100 + Level * 200)
// ─────────────────────────────────────────────────────────────────────────────
export const MAX_LEVEL = 100;
export const MAX_LEVEL_XP = 20100; // 100 + 100 * 200 = 20,100 EXP

/**
 * Organization EXP Rewards:
 * - Scrim Created: +20 EXP
 * - Scrim Completed: +60 EXP
 * - Tournament Created: +40 EXP
 * - Tournament Completed: +80 EXP
 */
export const ORG_EXP_REWARDS = {
    SCRIM_CREATED: 20,
    SCRIM_COMPLETED: 60,
    TOURNAMENT_CREATED: 40,
    TOURNAMENT_COMPLETED: 80,
} as const;

/**
 * Calculates Level (1–100) based on accumulated EXP.
 * Exact thresholds (milestone to reach Level L): 100 + (L - 1) * 200
 * - Level 1: 0 - 299 EXP (Target to reach Level 2 is 300 EXP)
 * - Level 2: 300 - 499 EXP (Target to reach Level 3 is 500 EXP)
 * - Level 3: 500 - 699 EXP (Target to reach Level 4 is 700 EXP)
 * - ...
 * - Level 100: 19,900 - 20,100+ EXP (Capped at 100)
 */
export const calculateLevel = (xp: number = 0): number => {
    const validXP = Math.max(0, Number(xp) || 0);
    if (validXP < 300) return 1;
    const lvl = Math.floor((validXP - 100) / 200) + 1;
    return Math.min(MAX_LEVEL, Math.max(1, lvl));
};

/**
 * Returns the target EXP required to complete the specified level and level up.
 * Level 1 target = 300, Level 2 = 500, ..., Level 100 = 20,100.
 */
export const getXPForNextLevel = (level: number): number => {
    const validLevel = Math.max(1, Math.floor(Number(level) || 1));
    if (validLevel >= MAX_LEVEL) return MAX_LEVEL_XP;
    return 100 + validLevel * 200;
};

/**
 * Calculates current progress percentage (0 - 100%) through the active level.
 */
export const getLevelProgress = (xp: number = 0): number => {
    const validXP = Math.max(0, Number(xp) || 0);
    if (validXP >= MAX_LEVEL_XP) return 100;
    const level = calculateLevel(validXP);
    if (level === 1) {
        const progress = (validXP / 300) * 100;
        return Math.min(100, Math.max(0, progress));
    }
    const prevThreshold = 100 + (level - 1) * 200;
    const nextThreshold = 100 + level * 200;
    const progress = ((validXP - prevThreshold) / (nextThreshold - prevThreshold)) * 100;
    return Math.min(100, Math.max(0, progress));
};

const GAME_MODE_LABELS: Record<string, string> = {
    battelroyal: 'Battle Royale',
    battleroyale: 'Battle Royale',
    'battle royale': 'Battle Royale',
    clashsquad: 'Clash Squad',
    'clash squad': 'Clash Squad',
    lionwolf: 'Lone Wolf',
    lonewolf: 'Lone Wolf',
    'lone wolf': 'Lone Wolf',
};

export const formatGameModeLabel = (mode: string) => {
    const normalized = mode.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
    const compact = normalized.replace(/\s+/g, '');
    const mappedLabel = GAME_MODE_LABELS[normalized] || GAME_MODE_LABELS[compact];

    if (mappedLabel) return mappedLabel;
    if (!normalized) return mode;

    return normalized
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

const GAME_NAME_LABELS: Record<string, string> = {
    'free fire': 'Free Fire',
    'pubg mobile': 'PUBG Mobile',
    pubg: 'PUBG',
    'mobile legends': 'Mobile Legends',
};

export const formatGameName = (name: string) => {
    const normalized = name.trim().toLowerCase().replace(/\s+/g, ' ');
    const mappedLabel = GAME_NAME_LABELS[normalized];

    if (mappedLabel) return mappedLabel;
    if (!normalized) return name;

    return normalized
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

/**
 * Sanitizes a user-supplied URL to prevent javascript: / data: protocol injection.
 * Only allows http, https, and relative URLs.
 * Returns '#' for anything dangerous or empty.
 */
export function sanitizeUrl(url: string | undefined | null): string {
    if (!url) return '#';
    const trimmed = url.trim();
    // Allow relative URLs
    if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return trimmed;
        return '#';
    } catch {
        return '#';
    }
}

/**
 * Validates a client-supplied internal redirect target (e.g. the `from`
 * location passed by ProtectedRoute). Only same-app absolute paths are
 * allowed; protocol-relative, backslash, scheme and auth-page targets are
 * rejected to avoid open redirects and redirect loops.
 */
export function isSafeInternalPath(pathname: unknown): pathname is string {
    if (typeof pathname !== 'string' || !pathname) return false;
    if (!pathname.startsWith('/')) return false;
    if (pathname.startsWith('//') || pathname.startsWith('/\\')) return false;
    if (pathname.includes('://')) return false;
    if (pathname === '/login' || pathname === '/register' || pathname === '/complete-profile') return false;
    return true;
}

/**
 * Recursively cleans an object or array for Firestore writes, removing any `undefined` values.
 * Firestore rejects documents containing `undefined` with:
 * "Unsupported field value: undefined"
 * Preserves Firestore FieldValue instances (serverTimestamp, increment), Timestamps, Dates, and primitives.
 */
export function cleanFirestoreData<T = any>(data: T): T {
    if (data === null || data === undefined) {
        return null as unknown as T;
    }

    if (typeof data !== 'object') {
        return data;
    }

    // Preserve Firestore Timestamp & FieldValue objects
    if (
        data instanceof Timestamp ||
        (data as any)._methodName ||
        typeof (data as any).isEqual === 'function' ||
        (data as any).seconds !== undefined ||
        (data as any).nanoseconds !== undefined ||
        (data as any).toDate !== undefined
    ) {
        return data;
    }

    if (data instanceof Date) {
        return data;
    }

    if (Array.isArray(data)) {
        return data.map(item => (item === undefined ? null : cleanFirestoreData(item))) as unknown as T;
    }

    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data as Record<string, any>)) {
        if (value !== undefined) {
            cleaned[key] = cleanFirestoreData(value);
        }
    }
    return cleaned as T;
}

