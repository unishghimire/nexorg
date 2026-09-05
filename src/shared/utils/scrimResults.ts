/**
 * scrimResults.ts
 * Utility to resolve and compile complete results for all teams/players registered in a scrim.
 * Guarantees that every registered team/player (from slots, participants, or manualResults)
 * is represented in the final results leaderboard, not just top-3 prize winners.
 */

export interface ScrimResultEntry {
  id: string;
  rank: number;
  teamName: string;
  teamTag?: string;
  teamId?: string;
  userId?: string;
  leader?: string;
  inGameName?: string;
  inGameId?: string;
  slotNumber?: number;
  kills: number;
  score: number;
  prize: number;
  status: string;
  teammates?: any[];
  isWinner?: boolean;
}

/**
 * Resolves all registered teams and players in a scrim or tournament
 * into a complete, sorted standings leaderboard.
 */
export function resolveAllScrimResults(
  tournament: any,
  participants?: any[]
): ScrimResultEntry[] {
  if (!tournament) return [];

  // Map to hold unique competitors by normalized key
  const competitorMap = new Map<string, ScrimResultEntry>();

  // Helper key generator
  const makeKey = (teamName?: string, userId?: string, teamId?: string, slotNum?: number) => {
    if (userId) return `uid:${userId}`;
    if (teamId) return `tid:${teamId}`;
    if (slotNum && slotNum > 0) return `slot:${slotNum}`;
    if (teamName) return `name:${teamName.trim().toLowerCase()}`;
    return `rand:${Math.random()}`;
  };

  // 1. Gather all declared winners (from tournament.winners, podium, or top manualResults)
  const winnersList: any[] = Array.isArray(tournament.winners)
    ? tournament.winners
    : Array.isArray(tournament.podium)
    ? tournament.podium
    : [];

  const winnersByKey = new Map<string, any>();
  winnersList.forEach((w: any, idx: number) => {
    const rank = Number(w.rank) || idx + 1;
    const teamName = w.teamName || w.team || w.username || `Team ${rank}`;
    const key = makeKey(teamName, w.userId || w.uid, w.teamId, w.slotNumber);
    const winObj = {
      ...w,
      rank,
      teamName,
      prize: Number(w.prize ?? w.amount ?? 0),
      kills: Number(w.kills ?? 0),
      score: Number(w.points ?? w.score ?? 0),
      userId: w.userId || w.uid,
    };
    winnersByKey.set(key, winObj);
    if (teamName) winnersByKey.set(`name:${teamName.trim().toLowerCase()}`, winObj);
    if (w.userId || w.uid) winnersByKey.set(`uid:${w.userId || w.uid}`, winObj);
    if (w.teamId) winnersByKey.set(`tid:${w.teamId}`, winObj);
    if (w.slotNumber) winnersByKey.set(`slot:${w.slotNumber}`, winObj);
  });

  // 2. Gather all existing manualResults if present
  if (Array.isArray(tournament.manualResults) && tournament.manualResults.length > 0) {
    tournament.manualResults.forEach((m: any, idx: number) => {
      const rank = Number(m.rank) || idx + 1;
      const teamName = m.team || m.teamName || `Team ${rank}`;
      const key = makeKey(teamName, m.userId, m.teamId, m.slotNumber);
      
      // Check if this manual result is a known prize winner
      const matchedWinner = winnersByKey.get(key) ||
        (teamName ? winnersByKey.get(`name:${teamName.trim().toLowerCase()}`) : null) ||
        (m.userId ? winnersByKey.get(`uid:${m.userId}`) : null);

      const prize = matchedWinner ? matchedWinner.prize : Number(m.prize ?? 0);
      const isWinner = prize > 0 || rank <= 3;
      const status = m.status || (
        rank === 1 ? 'Champion' :
        rank === 2 ? 'Runner-Up' :
        rank === 3 ? '3rd Place' :
        `Rank #${rank}`
      );

      competitorMap.set(key, {
        id: m.id || `res-${rank}-${idx}`,
        rank,
        teamName,
        teamTag: m.teamTag || null,
        teamId: m.teamId || null,
        userId: m.userId || null,
        leader: m.leader || m.username || teamName || null,
        inGameName: m.inGameName || null,
        inGameId: m.inGameId || null,
        slotNumber: typeof m.slotNumber === 'number' ? m.slotNumber : null,
        kills: Number(m.kills ?? matchedWinner?.kills ?? 0),
        score: Number(m.score ?? m.points ?? matchedWinner?.score ?? 0),
        prize,
        status,
        teammates: Array.isArray(m.teammates) ? m.teammates : [],
        isWinner,
      });
    });
  }

  // 3. Gather registered slots from tournament.slots or tournament.finalRoster
  const slotsSource = Array.isArray(tournament.finalRoster) && tournament.finalRoster.length > 0
    ? tournament.finalRoster
    : Array.isArray(tournament.slots)
    ? tournament.slots
    : [];

  slotsSource.forEach((slot: any) => {
    const isFilled = slot.status === 'filled' || Boolean(slot.teamName && slot.teamName !== 'Reserved') || Boolean(slot.userId);
    if (!isFilled) return;

    const teamName = slot.teamName || slot.leader || `Slot ${slot.slotNumber}`;
    const key = makeKey(teamName, slot.userId, slot.teamId, slot.slotNumber);

    // If already in competitorMap (from manualResults), enrich slot details if missing
    if (competitorMap.has(key)) {
      const existing = competitorMap.get(key)!;
      if (!existing.slotNumber && slot.slotNumber) existing.slotNumber = slot.slotNumber;
      if (!existing.leader && slot.leader) existing.leader = slot.leader;
      if (!existing.inGameName && slot.inGameName) existing.inGameName = slot.inGameName;
      if (!existing.inGameId && slot.inGameId) existing.inGameId = slot.inGameId;
      if (!existing.teamTag && slot.teamTag) existing.teamTag = slot.teamTag;
      return;
    }

    // Check winner match
    const matchedWinner = winnersByKey.get(key) ||
      winnersByKey.get(`name:${teamName.trim().toLowerCase()}`) ||
      (slot.userId ? winnersByKey.get(`uid:${slot.userId}`) : null) ||
      (slot.slotNumber ? winnersByKey.get(`slot:${slot.slotNumber}`) : null);

    const prize = matchedWinner ? matchedWinner.prize : 0;
    const kills = matchedWinner ? matchedWinner.kills : 0;
    const score = matchedWinner ? matchedWinner.score : 0;
    const rank = matchedWinner ? matchedWinner.rank : 999;
    const isWinner = prize > 0 || (rank <= 3 && rank < 999);
    const status = isWinner
      ? (rank === 1 ? 'Champion' : rank === 2 ? 'Runner-Up' : rank === 3 ? '3rd Place' : `Rank #${rank}`)
      : 'Completed';

    competitorMap.set(key, {
      id: `slot-${slot.slotNumber || Math.random().toString(36).slice(2, 7)}`,
      rank,
      teamName,
      teamTag: slot.teamTag || null,
      teamId: slot.teamId || null,
      userId: slot.userId || null,
      leader: slot.leader || slot.inGameName || teamName || null,
      inGameName: slot.inGameName || null,
      inGameId: slot.inGameId || null,
      slotNumber: typeof slot.slotNumber === 'number' ? slot.slotNumber : null,
      kills,
      score,
      prize,
      status,
      teammates: Array.isArray(slot.teammates) ? slot.teammates : [],
      isWinner,
    });
  });

  // 4. Gather registered participants from participants array
  if (Array.isArray(participants) && participants.length > 0) {
    participants.forEach((p: any) => {
      const teamName = p.teamName || p.username || p.inGameName || 'Participant';
      const key = makeKey(teamName, p.userId, p.teamId, p.slotNumber);

      if (competitorMap.has(key)) {
        const existing = competitorMap.get(key)!;
        if (!existing.slotNumber && p.slotNumber) existing.slotNumber = p.slotNumber;
        if (!existing.leader && (p.username || p.inGameName)) existing.leader = p.username || p.inGameName;
        if (!existing.inGameId && p.inGameId) existing.inGameId = p.inGameId;
        if (!existing.inGameName && p.inGameName) existing.inGameName = p.inGameName;
        return;
      }

      const matchedWinner = winnersByKey.get(key) ||
        winnersByKey.get(`name:${teamName.trim().toLowerCase()}`) ||
        (p.userId ? winnersByKey.get(`uid:${p.userId}`) : null) ||
        (p.slotNumber ? winnersByKey.get(`slot:${p.slotNumber}`) : null);

      const prize = matchedWinner ? matchedWinner.prize : 0;
      const kills = matchedWinner ? matchedWinner.kills : 0;
      const score = matchedWinner ? matchedWinner.score : 0;
      const rank = matchedWinner ? matchedWinner.rank : 999;
      const isWinner = prize > 0 || (rank <= 3 && rank < 999);
      const status = isWinner
        ? (rank === 1 ? 'Champion' : rank === 2 ? 'Runner-Up' : rank === 3 ? '3rd Place' : `Rank #${rank}`)
        : 'Completed';

      competitorMap.set(key, {
        id: p.id || `part-${p.userId || Math.random().toString(36).slice(2, 7)}`,
        rank,
        teamName,
        teamTag: p.teamTag || null,
        teamId: p.teamId || null,
        userId: p.userId || null,
        leader: p.username || p.inGameName || teamName || null,
        inGameName: p.inGameName || null,
        inGameId: p.inGameId || null,
        slotNumber: typeof p.slotNumber === 'number' ? p.slotNumber : null,
        kills,
        score,
        prize,
        status,
        teammates: Array.isArray(p.teammates) ? p.teammates : [],
        isWinner,
      });
    });
  }

  // 5. Ensure all winners themselves are in the competitorMap even if slots were empty
  winnersByKey.forEach((w: any) => {
    const key = makeKey(w.teamName, w.userId, w.teamId, w.slotNumber);
    if (!competitorMap.has(key)) {
      competitorMap.set(key, {
        id: `win-${w.rank}-${Math.random().toString(36).slice(2, 7)}`,
        rank: w.rank,
        teamName: w.teamName,
        teamTag: w.teamTag || null,
        teamId: w.teamId || null,
        userId: w.userId || null,
        leader: w.leader || w.username || w.teamName || null,
        inGameName: w.inGameName || null,
        inGameId: w.inGameId || null,
        slotNumber: typeof w.slotNumber === 'number' ? w.slotNumber : null,
        kills: w.kills || 0,
        score: w.score || 0,
        prize: w.prize || 0,
        status: w.rank === 1 ? 'Champion' : w.rank === 2 ? 'Runner-Up' : w.rank === 3 ? '3rd Place' : `Rank #${w.rank}`,
        teammates: Array.isArray(w.teammates) ? w.teammates : [],
        isWinner: true,
      });
    }
  });

  // 6. Convert to array and assign accurate sequential ranks to unranked participants
  const allEntries = Array.from(competitorMap.values());

  // Determine highest existing assigned rank among confirmed winners/ranked entries
  let maxAssignedRank = 0;
  allEntries.forEach((e) => {
    if (e.rank < 999 && e.rank > maxAssignedRank) {
      maxAssignedRank = e.rank;
    }
  });

  // Sort: ranked entries first (by rank ascending), then unranked entries (by score/kills desc or slotNumber asc)
  const rankedEntries = allEntries.filter((e) => e.rank < 999).sort((a, b) => a.rank - b.rank);
  const unrankedEntries = allEntries
    .filter((e) => e.rank >= 999)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.kills !== a.kills) return b.kills - a.kills;
      return (a.slotNumber || 999) - (b.slotNumber || 999);
    });

  let nextRank = maxAssignedRank + 1;
  unrankedEntries.forEach((e) => {
    e.rank = nextRank++;
    e.status = `Rank #${e.rank}`;
  });

  return [...rankedEntries, ...unrankedEntries];
}
