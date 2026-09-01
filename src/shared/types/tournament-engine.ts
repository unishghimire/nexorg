// ═══════════════════════════════════════════════════════════════
// TOURNAMENT ENGINE TYPES
// Extends existing Tournament/Group/RoundConfig types with lifecycle fields.
// ponytail: all new fields optional — existing tournaments don't break.
// ═══════════════════════════════════════════════════════════════

import { Timestamp } from 'firebase/firestore';
import { Team, Match } from './types';
import { TournamentScoringSnapshot, TournamentStanding } from './scoring';

/**
 * Extended group status — tracks lifecycle within a round.
 * Existing groups have no status → treated as 'draft' by the engine.
 */
export type GroupStatus = 'draft' | 'preview' | 'locked' | 'active' | 'completed';

/**
 * Qualification status per participant per round.
 * Stored in the participant's progression array, not on the participant record itself.
 */
export type QualificationStatus = 'qualified' | 'eliminated' | 'pending' | 'disqualified' | 'withdrawn';

/**
 * Distribution method for group assignment.
 */
export type DistributionMethod = 'random' | 'seeded' | 'balanced';

/**
 * Group naming style.
 */
export type GroupNamingStyle = 'alpha' | 'numeric';

/**
 * Participant mode — determines whether participants are teams or individual players.
 */
export type ParticipantMode = 'team' | 'solo';

/**
 * Qualification rule type.
 */
export type QualificationRuleType = 'top_n_per_group' | 'total_top_n' | 'final_ranking';

/**
 * Tournament lifecycle status — the state machine.
 * Extended from the existing 4-value TournamentStage to support full lifecycle.
 * Stored on tournament.stageStatus; old tournament.stage field remains for backward compat.
 */
export type TournamentLifecycleStatus =
    | 'draft'
    | 'registration_open'
    | 'registration_closed'
    | 'check_in'
    | 'group_allocation'
    | 'round_active'
    | 'results_pending'
    | 'qualification'
    | 'next_round_preparation'
    | 'completed'
    | 'cancelled';

/**
 * Extended RoundConfig — adds fields needed for the tournament engine.
 * All new fields optional for backward compat with existing roadmap configs.
 */
export interface ExtendedRoundConfig {
    roundNumber: number;
    numGroups: number;
    qualificationRule: number;          // Top N per group (existing field)
    maps: string[];
    stageName?: string;
    status?: 'upcoming' | 'current' | 'completed';
    description?: string;
    date?: any;
    // ─── New engine fields (all optional) ───
    matchesPerGroup?: number;           // How many matches to generate per group
    teamsPerGroup?: number;              // Configured capacity per group
    qualificationType?: QualificationRuleType;
    distributionMethod?: DistributionMethod;
    groupNamingStyle?: GroupNamingStyle;
    locked?: boolean;                    // Once locked, groups can't be regenerated
}

/**
 * Participant qualification record — one per round per participant.
 * Stored in a progression array on the tournament doc or participant doc.
 */
export interface ParticipantRoundResult {
    roundNumber: number;
    groupId: string;
    groupName: string;
    teamId: string;
    teamName: string;
    rank: number;
    kills: number;
    placementPoints: number;
    killPoints: number;
    totalPoints: number;
    qualificationStatus: QualificationStatus;
    matches: number;
}

/**
 * Audit log entry for tournament operations.
 */
export interface TournamentAuditEntry {
    timestamp: Timestamp | any;
    userId: string;
    userName: string;
    action: string;        // 'groups_generated', 'groups_locked', 'results_published', 'qualification_published', etc.
    details?: string;
    roundNumber?: number;
    targetId?: string;     // team/group/match ID affected
}

/**
 * Roadmap stage info — computed dynamically from tournament state.
 * This is NOT stored; it's derived by the engine for the UI.
 */
export interface RoadmapStageInfo {
    label: string;          // "Registration", "Round 1", "Grand Final", etc.
    type: 'registration' | 'check_in' | 'group_allocation' | 'round' | 'qualification' | 'final' | 'completed';
    status: 'pending' | 'active' | 'completed' | 'upcoming' | 'current';
    roundNumber?: number;
    participantCount?: number;
    groupCount?: number;
    matchCount?: number;
    completedMatches?: number;
    qualifiedCount?: number;
    eliminatedCount?: number;
    progressPercent: number;  // 0-100
}

/**
 * Qualification preview — generated before publishing.
 */
export interface QualificationPreview {
    roundNumber: number;
    groups: {
        groupId: string;
        groupName: string;
        standings: (TournamentStanding & { qualificationStatus: QualificationStatus })[];
    }[];
    totalQualified: number;
    totalEliminated: number;
    tiesRequiringReview: { groupId: string; groupName: string; teamId: string; teamName: string; points: number }[];
}

/**
 * Group generation result — what the engine produces.
 */
export interface GroupGenerationResult {
    groups: {
        id: string;
        name: string;
        teamLimit: number;
        teams: Team[];
        matches: Match[];
        isPublic: boolean;
        status: GroupStatus;
        roundNumber: number;
    }[];
    distributionMethod: DistributionMethod;
    totalAssigned: number;
}
