export interface ScrimSlot {
  slotNumber: number;
  status: 'open' | 'filled' | 'locked';
  teamName?: string | null;
  teamId?: string | null;
  userId?: string | null;
  captainUid?: string | null;
  reservedBy?: string | null;
  leader?: string | null;
  inGameId?: string | null;
  entryFee?: number;
}

export const SCRIM_FORMAT_SLOTS = {
  Squad: 12,
  Duo: 25,
  Solo: 48,
} as const;

export function getScrimSlotCount(format?: string | null): number {
  if (format === 'Solo') return 48;
  if (format === 'Duo') return 25;
  return 12; // Squad & default
}

const toPositiveInteger = (value: unknown, fallback = 0) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
};

/**
 * Supports both legacy numeric slot counts and the newer per-slot documents.
 * All callers can safely edit the returned representation.
 */
export const normalizeScrimSlots = (
  slots: unknown,
  totalSlots?: unknown,
  filledSlots?: unknown,
): ScrimSlot[] => {
  if (Array.isArray(slots)) {
    return slots.map((slot, index) => {
      const record = slot && typeof slot === 'object' ? slot as Record<string, unknown> : {};
      const rawStatus = record.status;
      const status: 'open' | 'filled' | 'locked' =
        rawStatus === 'filled' ? 'filled' : rawStatus === 'locked' ? 'locked' : 'open';

      const resolvedUserId = (
        (typeof record.userId === 'string' && record.userId) ||
        (typeof record.captainUid === 'string' && record.captainUid) ||
        (typeof record.reservedBy === 'string' && record.reservedBy) ||
        (typeof record.playerUid === 'string' && record.playerUid) ||
        (typeof record.uid === 'string' && record.uid) ||
        (typeof record.captainId === 'string' && record.captainId) ||
        (typeof record.teamOwnerId === 'string' && record.teamOwnerId) ||
        null
      );

      return {
        slotNumber: toPositiveInteger(record.slotNumber, index + 1),
        status,
        teamName: typeof record.teamName === 'string' ? record.teamName : null,
        teamId: typeof record.teamId === 'string' ? record.teamId : null,
        userId: resolvedUserId,
        captainUid: typeof record.captainUid === 'string' ? record.captainUid : (typeof record.userId === 'string' ? record.userId : null),
        reservedBy: typeof record.reservedBy === 'string' ? record.reservedBy : null,
        leader: typeof record.leader === 'string' ? record.leader : null,
        inGameId: typeof record.inGameId === 'string' ? record.inGameId : null,
        entryFee: typeof record.entryFee === 'number' ? record.entryFee : null,
      };
    });
  }

  const count = toPositiveInteger(slots, toPositiveInteger(totalSlots));
  const filled = Math.min(count, Math.max(0, Math.floor(Number(filledSlots) || 0)));
  return Array.from({ length: count }, (_, index) => ({
    slotNumber: index + 1,
    status: index < filled ? ('filled' as const) : ('open' as const),
    teamName: index < filled ? `Team ${index + 1}` : null,
    teamId: null,
  }));
};

export const countFilledScrimSlots = (slots: ScrimSlot[]) =>
  slots.filter(slot => slot.status === 'filled').length;

export const getSlotCount = (t: any): number => {
  if (!t) return 0;
  if (typeof t.totalSlots === 'number' && !isNaN(t.totalSlots) && t.totalSlots > 0) return t.totalSlots;
  if (typeof t.slots === 'number' && !isNaN(t.slots) && t.slots > 0) return t.slots;
  if (Array.isArray(t.slots)) return t.slots.length;
  const num = Number(t.totalSlots ?? t.slots);
  return !isNaN(num) && num > 0 ? num : 0;
};

export const getFilledSlotCount = (t: any): number => {
  if (!t) return 0;
  if (typeof t.currentPlayers === 'number' && !isNaN(t.currentPlayers) && t.currentPlayers >= 0) return t.currentPlayers;
  if (typeof t.filledSlots === 'number' && !isNaN(t.filledSlots) && t.filledSlots >= 0) return t.filledSlots;
  if (Array.isArray(t.slots)) {
    return t.slots.filter((s: any) => s && s.status === 'filled').length;
  }
  const num = Number(t.currentPlayers ?? t.filledSlots);
  return !isNaN(num) && num >= 0 ? num : 0;
};

/**
 * Creates a clean, empty array of open slots for a new or reset scrim lobby.
 * Used when a scrim match is finalized to release all slots for the next scrim.
 */
export const createResetScrimSlots = (count: number): ScrimSlot[] => {
  const safeCount = Math.max(1, toPositiveInteger(count, 12));
  return Array.from({ length: safeCount }, (_, index) => ({
    slotNumber: index + 1,
    status: 'open' as const,
    teamName: null,
    teamId: null,
    userId: null,
    leader: null,
    inGameId: null,
    entryFee: null,
  }));
};

/**
 * Strict check to ensure match points and kills have been entered/updated
 * before an event (tournament or scrim) can be finalized.
 */
export const hasEventUpdatedStats = (event: any): boolean => {
  if (!event) return false;

  // 1. Check winners or podium array
  const winnersList = Array.isArray(event.winners) && event.winners.length > 0
    ? event.winners
    : Array.isArray(event.podium) && event.podium.length > 0
    ? event.podium
    : null;

  if (winnersList && winnersList.length > 0) {
    const hasValidStats = winnersList.some((w: any) => {
      const kills = Number(w.kills);
      const points = Number(w.points ?? w.score);
      return (!isNaN(kills) && kills > 0) || (!isNaN(points) && points > 0);
    });
    if (hasValidStats) return true;
  }

  // 2. Check manualResults / leaderboard array
  if (Array.isArray(event.manualResults) && event.manualResults.length > 0) {
    const hasValidStats = event.manualResults.some((r: any) => {
      const kills = Number(r.kills);
      const score = Number(r.score ?? r.points);
      return (!isNaN(kills) && kills > 0) || (!isNaN(score) && score > 0);
    });
    if (hasValidStats) return true;
  }

  // 3. Check completed matches in tournament groups
  if (Array.isArray(event.groups) && event.groups.length > 0) {
    const hasMatchScores = event.groups.some((g: any) =>
      Array.isArray(g.matches) && g.matches.some((m: any) =>
        m.status === 'completed' && (
          (Number(m.score1) > 0 || Number(m.score2) > 0) ||
          (Array.isArray(m.results) && m.results.some((res: any) => Number(res.score ?? res.points) > 0 || Number(res.kills) > 0))
        )
      )
    );
    if (hasMatchScores) return true;
  }

  // 4. Check bracket matches if knockout
  if (Array.isArray(event.bracketMatches) && event.bracketMatches.length > 0) {
    const hasBracketScores = event.bracketMatches.some((m: any) =>
      m.status === 'completed' && (Number(m.score1) > 0 || Number(m.score2) > 0)
    );
    if (hasBracketScores) return true;
  }

  return false;
};

