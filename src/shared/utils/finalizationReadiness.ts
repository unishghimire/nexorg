/**
 * finalizationReadiness.ts
 *
 * NOTE: Tournaments and scrims are two DIFFERENT formats/engines that work
 * separately, with different data models and functionality:
 *
 *   • TOURNAMENT engine → groups → matches → per-team results (kills + points).
 *     Results are entered per match (ResultUploader / PerKillResultUploader).
 *
 *   • SCRIM engine → lobby slots (slots/finalRoster) + registered participants.
 *     Results are compiled by the scrimResults engine (winners/podium →
 *     resolveAllScrimResults → manualResults).
 *
 * Each engine therefore has its OWN readiness check:
 *   - checkTournamentResultsReadiness()
 *   - checkScrimResultsReadiness()
 *
 * Rule enforced everywhere: an event must NOT be finalized (status → 'completed')
 * until points & kills have been entered/updated for that engine's results.
 */

export interface ResultsReadiness {
  ready: boolean;
  mode: 'matches' | 'competitors' | 'none';
  totalMatches: number;
  missingMatches: number;
  totalCompetitors: number;
  missingCompetitors: number;
  missingNames: string[];
  statusText: string;
}

/** Scrim engine detection — scrims are stored/flagged separately from tournaments. */
export const isScrimEvent = (event: any): boolean =>
  Boolean(event) &&
  (event.matchType === 'scrims' ||
    event.isScrim === true ||
    event.type === 'scrim');

const isFilledSlot = (s: any) =>
  Boolean(s) &&
  (s.status === 'filled' ||
    (s.teamName && s.teamName !== 'Reserved') ||
    Boolean(s.userId));

/** A stored result entry counts as "updated" when both kills and points are present numbers. */
const entryHasScores = (e: any): boolean => {
  if (!e) return false;
  const kills = Number(e.kills);
  const points = Number(e.points ?? e.score ?? e.totalPoints);
  return Number.isFinite(kills) && kills >= 0 && Number.isFinite(points);
};

/** Stable identity keys for matching a competitor against stored results. */
const makeKeys = (
  teamName?: string,
  userId?: string,
  teamId?: string,
  slotNumber?: any
): string[] => {
  const keys: string[] = [];
  const uid = userId?.trim?.();
  const tid = teamId?.trim?.();
  const name = teamName?.trim?.();
  if (uid) keys.push(`uid:${uid.toLowerCase()}`);
  if (tid) keys.push(`tid:${tid.toLowerCase()}`);
  if (typeof slotNumber === 'number' && slotNumber > 0) keys.push(`slot:${slotNumber}`);
  if (name) keys.push(`name:${name.toLowerCase()}`);
  return keys;
};

const READY_EMPTY: ResultsReadiness = {
  ready: true,
  mode: 'none',
  totalMatches: 0,
  missingMatches: 0,
  totalCompetitors: 0,
  missingCompetitors: 0,
  missingNames: [],
  statusText: '',
};

// ═══════════════════════════════════════════════════════════════
// TOURNAMENT ENGINE
// Groups → matches → per-team results (kills + points per match).
// ═══════════════════════════════════════════════════════════════
export function checkTournamentResultsReadiness(
  tournament: any,
  participants: any[] = []
): ResultsReadiness {
  if (!tournament) return READY_EMPTY;

  const groups = Array.isArray(tournament.groups) ? tournament.groups : [];
  const allMatches = groups.flatMap((g: any) =>
    Array.isArray(g?.matches) ? g.matches : []
  );

  // ─── Group/match format: every match must have points & kills entered ───
  if (allMatches.length > 0) {
    let missing = 0;
    for (const m of allMatches) {
      const results = Array.isArray(m?.results) ? m.results : [];
      const hasScores =
        results.length > 0 && results.every((r: any) => entryHasScores(r));
      if (!hasScores) missing++;
    }
    return {
      ready: missing === 0,
      mode: 'matches',
      totalMatches: allMatches.length,
      missingMatches: missing,
      totalCompetitors: 0,
      missingCompetitors: 0,
      missingNames: [],
      statusText:
        missing === 0
          ? ''
          : `Cannot finalize tournament: points & kills are missing for ${missing} of ${allMatches.length} match${allMatches.length === 1 ? '' : 'es'}. Please update results (points & kills) for all matches before finalizing.`,
    };
  }

  // ─── No group stage: tournament results come from manualResults/winners ───
  // Every registered team (participants) must be covered by a stored entry
  // with kills & points.
  return checkCompetitorCoverage(tournament, participants, {
    eventLabel: 'tournament',
  });
}

// ═══════════════════════════════════════════════════════════════
// SCRIM ENGINE
// Lobby slots (slots/finalRoster) + registered participants;
// results compiled by the scrimResults engine (winners/podium/manualResults).
// ═══════════════════════════════════════════════════════════════
export function checkScrimResultsReadiness(
  scrim: any,
  participants: any[] = []
): ResultsReadiness {
  if (!scrim) return READY_EMPTY;

  // Every filled lobby slot + registered participant must have a results
  // entry with kills & points (winners/podium/manualResults).
  return checkCompetitorCoverage(scrim, participants, {
    eventLabel: 'scrim',
    useSlots: true,
  });
}

// ═══════════════════════════════════════════════════════════════
// SCRIM ENGINE — winning payout confirmation
// A scrim with a cash prize pool can only be finalized AFTER the winning
// payout has been distributed and CONFIRMED (payoutCompleted /
// payoutStatus 'paid'). Merely declaring winners is NOT enough.
// ═══════════════════════════════════════════════════════════════
export interface PayoutConfirmation {
  /** A payout is only required when the scrim has a cash prize pool. */
  required: boolean;
  /** True only when the payout has actually been distributed & confirmed. */
  confirmed: boolean;
  statusText: string;
}

export function checkScrimPayoutConfirmation(scrim: any): PayoutConfirmation {
  const hasCashPrize = Number(scrim?.prizePool) > 0;
  if (!hasCashPrize) {
    return { required: false, confirmed: true, statusText: '' };
  }
  const confirmed =
    scrim?.payoutCompleted === true ||
    scrim?.payoutStatus === 'paid' ||
    scrim?.payoutStatus === 'confirmed';
  return {
    required: true,
    confirmed,
    statusText:
      confirmed
        ? ''
        : "Cannot finalize this match: the winning payout has not been confirmed yet. Declare the winners and distribute the prize payout first — finalizing stays blocked until the payout is marked as paid.",
  };
}

// ═══════════════════════════════════════════════════════════════
// Shared coverage internals (used by both engine checks)
// ═══════════════════════════════════════════════════════════════
function checkCompetitorCoverage(
  event: any,
  participants: any[],
  opts: { eventLabel: 'tournament' | 'scrim'; useSlots?: boolean }
): ResultsReadiness {
  const competitors: { name: string; keys: string[] }[] = [];
  const seenCompetitorKeys = new Set<string>();
  const addCompetitor = (c: any) => {
    if (!c) return;
    const name = c.teamName || c.leader || c.username || c.inGameName || '';
    const keys = makeKeys(c.teamName, c.userId || c.uid, c.teamId, c.slotNumber);
    if (keys.length === 0) return;
    const primaryKey = keys[0];
    if (seenCompetitorKeys.has(primaryKey)) return;
    seenCompetitorKeys.add(primaryKey);
    competitors.push({ name: name || primaryKey, keys });
  };

  // Scrim engine registers competitors via lobby slots / final roster;
  // the tournament engine registers them as participants.
  if (opts.useSlots) {
    const slotsSource =
      Array.isArray(event.finalRoster) && event.finalRoster.length > 0
        ? event.finalRoster
        : Array.isArray(event.slots)
          ? event.slots
          : [];
    slotsSource.filter(isFilledSlot).forEach(addCompetitor);
  }
  participants.forEach(addCompetitor);

  if (competitors.length === 0) return READY_EMPTY;

  // Stored result entries for this engine: manualResults + winners/podium.
  const resultEntries: any[] = [
    ...(Array.isArray(event.manualResults) ? event.manualResults : []),
    ...(Array.isArray(event.winners) ? event.winners : []),
    ...(Array.isArray(event.podium) ? event.podium : []),
  ].filter(entryHasScores);

  const resultKeys = new Set<string>();
  resultEntries.forEach((e: any) => {
    makeKeys(e.team || e.teamName || e.username, e.userId || e.uid, e.teamId, e.slotNumber).forEach(
      (k) => resultKeys.add(k)
    );
  });

  const missingNames: string[] = [];
  competitors.forEach((c) => {
    const covered = c.keys.some((k) => resultKeys.has(k));
    if (!covered) missingNames.push(c.name);
  });

  return {
    ready: missingNames.length === 0,
    mode: 'competitors',
    totalMatches: 0,
    missingMatches: 0,
    totalCompetitors: competitors.length,
    missingCompetitors: missingNames.length,
    missingNames,
    statusText:
      missingNames.length === 0
        ? ''
        : `Cannot finalize ${opts.eventLabel}: points & kills are not updated for ${missingNames.length} of ${competitors.length} registered team${competitors.length === 1 ? '' : 's'}/player${competitors.length === 1 ? '' : 's'}. Please enter points & kills for all registered teams before finalizing.`,
  };
}

/**
 * Router: picks the correct ENGINE check for an event.
 * Tournaments and scrims are separate engines — this only decides which one
 * the event belongs to, based on how the app flags scrims.
 */
export function checkResultsReadiness(
  event: any,
  participants: any[] = []
): ResultsReadiness {
  if (!event) return READY_EMPTY;
  return isScrimEvent(event)
    ? checkScrimResultsReadiness(event, participants)
    : checkTournamentResultsReadiness(event, participants);
}

/**
 * Check the winner tiers collected in a payout/finalize modal:
 * every declared winner must have BOTH kills and points entered.
 * (Used by the prize distribution UI for both engines.)
 * Returns the first offending tier (or null when all good).
 */
export function findTierMissingScores(tiers: any[]): any | null {
  for (const t of tiers || []) {
    if (!t) continue;
    const hasTeam = Boolean((t.teamName || '').trim() || t.userId || t.teamId);
    if (!hasTeam) continue; // unselected tiers are skipped by the caller
    if (!Number(t.kills) || !Number(t.points)) return t;
  }
  return null;
}
