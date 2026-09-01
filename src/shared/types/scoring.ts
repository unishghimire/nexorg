// ═══════════════════════════════════════════════════════════════
// GAME-BASED SCORING TYPES
// Centralized, versioned, snapshotted scoring architecture.
// ponytail: extends existing Game/Tournament/TeamMatchResult, no new collections.
// ═══════════════════════════════════════════════════════════════

import { Timestamp } from 'firebase/firestore';
import { RewardConfig } from './per-kill';

/**
 * Scoring configuration stored on the Game document.
 * Admin configures this once per game. New tournaments inherit it.
 */
export interface GameScoringConfig {
    enabled: boolean;
    killPoints: number;          // Points per kill
    placementPoints: Record<string, number>;  // "1" → 12, "2" → 9, etc.
    maxPlacement?: number;       // Highest position with defined points (e.g. 12)
    scoringVersion: number;      // Incremented on every admin change
    // ─── Per-Kill Reward defaults (optional, game-level) ───
    rewardConfig?: RewardConfig;  // Default per-kill reward for this game
    updatedAt?: Timestamp | any;
    updatedBy?: string;
}

/**
 * Snapshot of game scoring frozen into a tournament at creation time.
 * This ensures historical results never change when admin updates game scoring.
 */
export interface TournamentScoringSnapshot {
    gameId: string;
    gameName: string;
    killPoints: number;
    placementPoints: Record<string, number>;
    maxPlacement?: number;
    scoringVersion: number;
    source: 'game-default' | 'custom';
    snapshotAt: Timestamp | any;
}

/**
 * Extended team match result with server-calculated scoring breakdown.
 * Backward compat: `totalPoints` stays (old code reads it).
 * New fields: `placementPoints`, `killPoints` for transparency.
 */
export interface ScoredResult {
    teamId: string;
    teamName: string;
    placement: number;
    kills: number;
    placementPoints: number;   // Server-calculated
    killPoints: number;        // Server-calculated
    totalPoints: number;       // Server-calculated = placementPoints + killPoints
    scoringVersion: number;
    updatedAt?: Timestamp | any;
    updatedBy?: string;
}

/**
 * Audit entry for result changes.
 */
export interface ResultAuditEntry {
    timestamp: Timestamp | any;
    updatedBy: string;
    teamId: string;
    teamName: string;
    previousPosition: number;
    newPosition: number;
    previousKills: number;
    newKills: number;
    previousTotal: number;
    newTotal: number;
}

/**
 * Aggregated tournament standings for a team across all matches.
 */
export interface TournamentStanding {
    teamId: string;
    teamName: string;
    logoUrl?: string;
    matches: number;
    kills: number;
    placementPoints: number;
    killPoints: number;
    totalPoints: number;
    bestPlacement: number;     // Best (lowest) placement across matches
    rank: number;               // Final rank after sorting + tie-breakers
}

/**
 * Default Free Fire scoring configuration.
 * Used when admin enables scoring for Free Fire without manual config.
 */
export const FREE_FIRE_DEFAULT_SCORING: Omit<GameScoringConfig, 'updatedAt' | 'updatedBy'> = {
    enabled: true,
    killPoints: 1,
    placementPoints: {
        '1': 12, '2': 9, '3': 8, '4': 7, '5': 6,
        '6': 5, '7': 4, '8': 3, '9': 2, '10': 1,
        '11': 0, '12': 0,
    },
    maxPlacement: 12,
    scoringVersion: 1,
    rewardConfig: {
        enabled: false,
        rewardPerKill: 10,
        currency: 'NPR',
        minimumKillsForReward: 0,
    },
};
