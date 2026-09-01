// ═══════════════════════════════════════════════════════════════
// PER-KILL REWARD TYPES
// Individual kill tracking + reward calculation for PER_KILL_REWARD tournaments.
// ponytail: extends existing Tournament/Team types, no new collections.
// All new fields optional — existing POINTS tournaments don't break.
// ═══════════════════════════════════════════════════════════════

import { Timestamp } from 'firebase/firestore';

/**
 * Tournament mode — determines scoring/reward calculation strategy.
 * POINTS: Position + Kills → Tournament Points → Team Ranking
 * PER_KILL_REWARD: Individual Kills × Reward → Individual Player Earnings
 */
export type TournamentMode = 'POINTS' | 'PER_KILL_REWARD';

/**
 * Reward configuration for PER_KILL_REWARD tournaments.
 * Stored on game defaults AND frozen as snapshot on tournament at creation.
 */
export interface RewardConfig {
    enabled: boolean;
    rewardPerKill: number;           // e.g. 10 (in NPR)
    currency: string;                 // e.g. "NPR"
    minimumKillsForReward: number;    // 0 = reward from first kill; 1 = must have at least 1 kill
    maximumRewardPerPlayer?: number;  // optional cap per player per tournament
    maximumRewardPerMatch?: number;   // optional cap per player per match
    maximumRewardPerTournament?: number; // optional global cap
}

/**
 * Default reward config — no artificial caps unless admin sets them.
 */
export const DEFAULT_REWARD_CONFIG: Omit<RewardConfig, never> = {
    enabled: false,
    rewardPerKill: 0,
    currency: 'NPR',
    minimumKillsForReward: 0,
};

/**
 * Frozen reward snapshot copied from game defaults into tournament at creation.
 * Same shape as RewardConfig — ensures historical tournaments never change
 * when admin updates game-level defaults.
 */
export type RewardSnapshot = RewardConfig & {
    gameId: string;
    gameName: string;
    snapshotAt: Timestamp | any;
};

/**
 * Kill verification status — tracks the verification lifecycle.
 * Only VERIFIED kills generate payable rewards.
 */
export type KillVerificationStatus =
    | 'submitted'    // Admin entered the kill count, not yet reviewed
    | 'verified'     // Admin verified the kills
    | 'rejected'     // Admin rejected the submission
    | 'disputed';    // Player disputed the count

/**
 * Reward payout status — tracks the financial lifecycle.
 * A reward being calculated does NOT mean money is withdrawable.
 */
export type RewardStatus =
    | 'pending_verification'  // Kill count submitted, awaiting verification
    | 'verified'              // Kill count verified by admin
    | 'approved'              // Reward approved for payout
    | 'processing'            // Payout in progress
    | 'paid'                  // Payout confirmed by payment system
    | 'rejected'              // Reward rejected
    | 'disputed'              // Player disputed the reward
    | 'cancelled';            // Tournament cancelled or result voided

/**
 * Individual kill ledger entry — one per player per match.
 * This is the auditable record. Do NOT rely only on a calculated UI number.
 */
export interface PlayerKillReward {
    id: string;                      // Unique ID for this ledger entry
    tournamentId: string;
    stageId?: string;
    roundId?: string;
    groupId: string;
    matchId: string;
    teamId: string;                  // Team the player belongs to (solo = solo team)
    playerId: string;                // The actual player who performed the kills
    playerName: string;
    submittedKills: number;          // What admin entered
    verifiedKills: number;           // What admin verified (used for reward calc)
    rewardPerKill: number;           // Frozen from tournament snapshot
    rewardAmount: number;            // verifiedKills × rewardPerKill (server-calculated)
    currency: string;
    killStatus: KillVerificationStatus;
    rewardStatus: RewardStatus;
    resultVersion: number;           // Incremented on each edit (idempotency key)
    createdAt: Timestamp | any;
    verifiedAt?: Timestamp | any;
    verifiedBy?: string;
    updatedAt?: Timestamp | any;
}

/**
 * Team reward summary — aggregated from individual PlayerKillRewards.
 * Derived, not stored separately (computed on read).
 */
export interface TeamRewardSummary {
    teamId: string;
    teamName: string;
    totalKills: number;
    totalReward: number;
    playerBreakdown: {
        playerId: string;
        playerName: string;
        kills: number;
        reward: number;
    }[];
}

/**
 * Per-kill leaderboard entry — individual player ranking.
 */
export interface PerKillLeaderboardEntry {
    rank: number;
    playerId: string;
    playerName: string;
    teamId: string;
    teamName: string;
    kills: number;
    reward: number;
    currency: string;
}

/**
 * Audit entry for reward changes.
 * Records corrections when verified results are edited.
 */
export interface RewardAuditEntry {
    timestamp: Timestamp | any;
    changedBy: string;
    changedByName: string;
    playerId: string;
    playerName: string;
    matchId: string;
    oldKills: number;
    newKills: number;
    oldReward: number;
    newReward: number;
    adjustment: number;              // newReward - oldReward (can be negative)
    reason: string;
}

/**
 * Per-kill tournament completion summary.
 */
export interface PerKillTournamentSummary {
    totalParticipants: number;
    totalMatches: number;
    totalVerifiedKills: number;
    totalRewardsGenerated: number;
    topKiller?: { playerId: string; playerName: string; kills: number; reward: number };
    topTeam?: { teamId: string; teamName: string; kills: number; reward: number };
    currency: string;
}
