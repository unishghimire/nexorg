// ═══════════════════════════════════════════════════════════════
// PER-KILL REWARD ENGINE
// The one and only per-kill reward calculation service.
// ponytail: pure functions, no deps, zero side-effects.
// Reuses existing Tournament/Team types — no duplicate implementations.
// ═══════════════════════════════════════════════════════════════

import {
    RewardConfig,
    RewardSnapshot,
    PlayerKillReward,
    TeamRewardSummary,
    PerKillLeaderboardEntry,
    PerKillTournamentSummary,
    KillVerificationStatus,
    RewardStatus,
} from '../types/per-kill';

/**
 * Validate a kill count entry.
 * Kills must be a non-negative integer. Reject -1, 1.5, "abc", null.
 * null means "not submitted" — treated as 0 for calculation but flagged.
 */
export function validateKills(kills: unknown): { valid: boolean; value: number; errors: string[] } {
    const errors: string[] = [];

    if (kills === null || kills === undefined) {
        return { valid: false, value: 0, errors: ['Kills not submitted (null)'] };
    }

    if (typeof kills !== 'number' || isNaN(kills)) {
        return { valid: false, value: 0, errors: [`Kills must be a number, got ${typeof kills}`] };
    }

    if (!Number.isInteger(kills)) {
        return { valid: false, value: 0, errors: [`Kills must be an integer, got ${kills}`] };
    }

    if (kills < 0) {
        return { valid: false, value: 0, errors: [`Kills must be >= 0, got ${kills}`] };
    }

    return { valid: true, value: kills, errors: [] };
}

/**
 * Calculate individual player reward.
 * Formula: verifiedKills × rewardPerKill
 * Applies minimum kills threshold and optional caps.
 * ponytail: integer math for financial safety — NPR stored in paisa (×100) internally.
 */
export function calculatePlayerReward(params: {
    verifiedKills: number;
    rewardPerKill: number;
    minimumKillsForReward: number;
    maximumRewardPerMatch?: number;
    maximumRewardPerPlayer?: number;  // per tournament total
    currentTournamentReward?: number; // already earned this tournament (for cap check)
}): { rewardAmount: number; capped: boolean } {
    const { verifiedKills, rewardPerKill, minimumKillsForReward } = params;

    // Below minimum threshold — no reward
    if (verifiedKills < minimumKillsForReward) {
        return { rewardAmount: 0, capped: false };
    }

    // Base calculation: verifiedKills × rewardPerKill
    // ponytail: use Math.round for safety with integer paisa representation
    let reward = Math.round(verifiedKills * rewardPerKill);

    let capped = false;

    // Per-match cap
    if (params.maximumRewardPerMatch !== undefined && reward > params.maximumRewardPerMatch) {
        reward = params.maximumRewardPerMatch;
        capped = true;
    }

    // Per-player-per-tournament cap (consider existing earnings)
    if (params.maximumRewardPerPlayer !== undefined) {
        const totalWithThis = (params.currentTournamentReward ?? 0) + reward;
        if (totalWithThis > params.maximumRewardPerPlayer) {
            reward = Math.max(0, params.maximumRewardPerPlayer - (params.currentTournamentReward ?? 0));
            capped = true;
        }
    }

    return { rewardAmount: reward, capped };
}

/**
 * Create a reward snapshot from game defaults at tournament creation time.
 * Same pattern as scoring snapshot — frozen, never changes.
 */
export function createRewardSnapshot(params: {
    gameId: string;
    gameName: string;
    rewardConfig: RewardConfig;
}): RewardSnapshot {
    return {
        ...params.rewardConfig,
        gameId: params.gameId,
        gameName: params.gameName,
        snapshotAt: new Date() as any,
    };
}

/**
 * Create a PlayerKillReward ledger entry.
 * Called when admin submits individual kill results.
 */
export function createKillRewardEntry(params: {
    tournamentId: string;
    groupId: string;
    matchId: string;
    teamId: string;
    playerId: string;
    playerName: string;
    submittedKills: number;
    rewardPerKill: number;
    currency: string;
    minimumKillsForReward: number;
    stageId?: string;
    roundId?: string;
    maximumRewardPerMatch?: number;
}): PlayerKillReward {
    const validation = validateKills(params.submittedKills);
    const kills = validation.valid ? validation.value : 0;

    const { rewardAmount } = calculatePlayerReward({
        verifiedKills: kills,
        rewardPerKill: params.rewardPerKill,
        minimumKillsForReward: params.minimumKillsForReward,
        maximumRewardPerMatch: params.maximumRewardPerMatch,
    });

    return {
        id: `${params.tournamentId}_${params.matchId}_${params.playerId}`,
        tournamentId: params.tournamentId,
        stageId: params.stageId,
        roundId: params.roundId,
        groupId: params.groupId,
        matchId: params.matchId,
        teamId: params.teamId,
        playerId: params.playerId,
        playerName: params.playerName,
        submittedKills: kills,
        verifiedKills: 0,     // Starts unverified — admin must verify
        rewardPerKill: params.rewardPerKill,
        rewardAmount: 0,       // No reward until verified
        currency: params.currency,
        killStatus: 'submitted',
        rewardStatus: 'pending_verification',
        resultVersion: 1,
        createdAt: new Date() as any,
    };
}

/**
 * Verify a kill reward entry — admin confirms kill count.
 * Sets verifiedKills = submittedKills and calculates the actual reward.
 * Idempotent: verifying an already-verified entry with same kills is a no-op.
 */
export function verifyKillReward(params: {
    entry: PlayerKillReward;
    verifiedKills?: number;       // Optional: admin can adjust during verification
    verifiedBy: string;
    minimumKillsForReward: number;
    maximumRewardPerMatch?: number;
    maximumRewardPerPlayer?: number;
    currentTournamentReward?: number;
}): PlayerKillReward {
    const kills = params.verifiedKills !== undefined
        ? (validateKills(params.verifiedKills).valid ? params.verifiedKills : 0)
        : params.entry.submittedKills;

    const { rewardAmount } = calculatePlayerReward({
        verifiedKills: kills,
        rewardPerKill: params.entry.rewardPerKill,
        minimumKillsForReward: params.minimumKillsForReward,
        maximumRewardPerMatch: params.maximumRewardPerMatch,
        maximumRewardPerPlayer: params.maximumRewardPerPlayer,
        currentTournamentReward: params.currentTournamentReward,
    });

    return {
        ...params.entry,
        verifiedKills: kills,
        rewardAmount,
        killStatus: 'verified',
        rewardStatus: 'verified',
        verifiedAt: new Date() as any,
        verifiedBy: params.verifiedBy,
        updatedAt: new Date() as any,
    };
}

/**
 * Reject a kill reward entry.
 */
export function rejectKillReward(entry: PlayerKillReward, reason?: string): PlayerKillReward {
    return {
        ...entry,
        verifiedKills: 0,
        rewardAmount: 0,
        killStatus: 'rejected',
        rewardStatus: 'rejected',
        updatedAt: new Date() as any,
    };
}

/**
 * Aggregate individual kill rewards into team summary.
 * Team kills = sum(individualPlayerKills). Team reward = sum(individual rewards).
 */
export function aggregateTeamRewards(params: {
    killRewards: PlayerKillReward[];
    onlyVerified?: boolean;         // Default: true — only count verified entries
}): TeamRewardSummary[] {
    const entries = params.onlyVerified === false
        ? params.killRewards
        : params.killRewards.filter(r => r.killStatus === 'verified');

    const teamMap: Record<string, TeamRewardSummary> = {};

    for (const entry of entries) {
        if (!teamMap[entry.teamId]) {
            teamMap[entry.teamId] = {
                teamId: entry.teamId,
                teamName: entry.playerName, // Will be overridden below
                totalKills: 0,
                totalReward: 0,
                playerBreakdown: [],
            };
        }
        const team = teamMap[entry.teamId];
        team.totalKills += entry.verifiedKills;
        team.totalReward += entry.rewardAmount;
        team.playerBreakdown.push({
            playerId: entry.playerId,
            playerName: entry.playerName,
            kills: entry.verifiedKills,
            reward: entry.rewardAmount,
        });
    }

    // Sort teams by total kills desc
    return Object.values(teamMap).sort((a, b) => b.totalKills - a.totalKills);
}

/**
 * Build per-kill leaderboard — individual player ranking by verified kills.
 * Ranking based on verified kills (default) or total reward.
 */
export function buildPerKillLeaderboard(params: {
    killRewards: PlayerKillReward[];
    sortBy?: 'kills' | 'reward';
    onlyVerified?: boolean;
}): PerKillLeaderboardEntry[] {
    const entries = params.onlyVerified === false
        ? params.killRewards
        : params.killRewards.filter(r => r.killStatus === 'verified');

    const playerMap: Record<string, PerKillLeaderboardEntry> = {};

    for (const entry of entries) {
        if (!playerMap[entry.playerId]) {
            playerMap[entry.playerId] = {
                rank: 0,
                playerId: entry.playerId,
                playerName: entry.playerName,
                teamId: entry.teamId,
                teamName: '', // Will be filled from team lookup if available
                kills: 0,
                reward: 0,
                currency: entry.currency,
            };
        }
        playerMap[entry.playerId].kills += entry.verifiedKills;
        playerMap[entry.playerId].reward += entry.rewardAmount;
    }

    const sortBy = params.sortBy ?? 'kills';
    const sorted = Object.values(playerMap).sort((a, b) => {
        if (sortBy === 'reward') return b.reward - a.reward;
        if (b.kills !== a.kills) return b.kills - a.kills;
        return b.reward - a.reward;
    });

    sorted.forEach((entry, i) => {
        entry.rank = i + 1;
    });

    return sorted;
}

/**
 * Generate tournament completion summary for PER_KILL_REWARD mode.
 */
export function buildPerKillSummary(params: {
    killRewards: PlayerKillReward[];
    totalParticipants: number;
    totalMatches: number;
}): PerKillTournamentSummary {
    const verified = params.killRewards.filter(r => r.killStatus === 'verified');

    const totalVerifiedKills = verified.reduce((sum, r) => sum + r.verifiedKills, 0);
    const totalRewardsGenerated = verified.reduce((sum, r) => sum + r.rewardAmount, 0);
    const currency = verified[0]?.currency ?? 'NPR';

    // Top killer
    const leaderboard = buildPerKillLeaderboard({ killRewards: verified });
    const topKiller = leaderboard[0]
        ? { playerId: leaderboard[0].playerId, playerName: leaderboard[0].playerName, kills: leaderboard[0].kills, reward: leaderboard[0].reward }
        : undefined;

    // Top team
    const teamSummaries = aggregateTeamRewards({ killRewards: verified });
    const topTeam = teamSummaries[0]
        ? { teamId: teamSummaries[0].teamId, teamName: teamSummaries[0].teamName, kills: teamSummaries[0].totalKills, reward: teamSummaries[0].totalReward }
        : undefined;

    return {
        totalParticipants: params.totalParticipants,
        totalMatches: params.totalMatches,
        totalVerifiedKills,
        totalRewardsGenerated,
        topKiller,
        topTeam,
        currency,
    };
}

/**
 * Idempotency key for reward entries — prevents duplicate rewards on re-finalize.
 * Format: tournamentId + matchId + playerId (unique per player per match).
 */
export function rewardIdempotencyKey(tournamentId: string, matchId: string, playerId: string): string {
    return `${tournamentId}_${matchId}_${playerId}`;
}

/**
 * Calculate financial display breakdown — clearly separates earned/approved/paid/pending/disputed.
 */
export function buildFinancialBreakdown(params: {
    killRewards: PlayerKillReward[];
}): {
    verified: number;
    pendingApproval: number;
    approved: number;
    paid: number;
    disputed: number;
    currency: string;
} {
    const entries = params.killRewards;
    const currency = entries[0]?.currency ?? 'NPR';

    return {
        verified: entries.filter(r => r.rewardStatus === 'verified').reduce((s, r) => s + r.rewardAmount, 0),
        pendingApproval: entries.filter(r => r.rewardStatus === 'pending_verification').reduce((s, r) => s + r.rewardAmount, 0),
        approved: entries.filter(r => r.rewardStatus === 'approved').reduce((s, r) => s + r.rewardAmount, 0),
        paid: entries.filter(r => r.rewardStatus === 'paid').reduce((s, r) => s + r.rewardAmount, 0),
        disputed: entries.filter(r => r.rewardStatus === 'disputed').reduce((s, r) => s + r.rewardAmount, 0),
        currency,
    };
}
