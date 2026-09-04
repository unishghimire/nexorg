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
        entryFee: typeof record.entryFee === 'number' ? record.entryFee : undefined,
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
