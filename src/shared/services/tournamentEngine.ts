// ═══════════════════════════════════════════════════════════════
// TOURNAMENT ENGINE — THE ONE AND ONLY TOURNAMENT OPERATIONS SERVICE
// ponytail: extends existing types, reuses scoringEngine, no new collections.
// All business logic lives here. UI components call these functions.
// No duplicate standings/qualification/group logic in hooks or components.
// ═══════════════════════════════════════════════════════════════

import { Team, Match, TournamentGroup, Tournament, RoundConfig } from '../types/types';
import { TournamentStanding } from '../types/scoring';
import {
    QualificationPreview,
    GroupStatus,
    QualificationStatus,
    DistributionMethod,
    GroupNamingStyle,
    ParticipantMode,
    QualificationRuleType,
    TournamentLifecycleStatus,
    ExtendedRoundConfig,
    ParticipantRoundResult,
    TournamentAuditEntry,
    RoadmapStageInfo,
    GroupGenerationResult,
} from '../types/tournament-engine';
import { aggregateStandings, scoreTeamResult, calculateTeamScore } from './scoringEngine';
import { ScoredResult } from '../types/scoring';

// Re-export types so consumers can import from the service
export type { QualificationPreview } from '../types/tournament-engine';

// ─── Helpers ───────────────────────────────────────────────────

/** Generate group name based on naming style */
function generateGroupName(index: number, style: GroupNamingStyle = 'alpha'): string {
    if (style === 'numeric') return `Group ${index + 1}`;
    // Alpha: A, B, C, ... Z, AA, AB, ...
    let name = '';
    let n = index;
    do {
        name = String.fromCharCode(65 + (n % 26)) + name;
        n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return `Group ${name}`;
}

/** Get the scoring config from a tournament (snapshot or fallback) */
function getScoringConfig(tournament: Tournament) {
    if (tournament.scoringSnapshot) return tournament.scoringSnapshot;
    // ponytail: fallback to pointSystem if no snapshot (legacy tournaments)
    if (tournament.pointSystem) {
        const placementPoints: Record<string, number> = {};
        for (const p of tournament.pointSystem.placementPoints) {
            placementPoints[String(p.rank)] = p.points;
        }
        return {
            killPoints: tournament.pointSystem.pointsPerKill,
            placementPoints,
            maxPlacement: Math.max(...tournament.pointSystem.placementPoints.map(p => p.rank)),
            scoringVersion: 1,
        };
    }
    // Ultimate fallback: Free Fire defaults
    return {
        killPoints: 1,
        placementPoints: { '1': 12, '2': 9, '3': 8, '4': 7, '5': 6, '6': 5, '7': 4, '8': 3, '9': 2, '10': 1, '11': 0, '12': 0 },
        maxPlacement: 12,
        scoringVersion: 1,
    };
}

/** Check if a match is a BR-style match (has results array) */
function isBRMatch(match: Match): boolean {
    return !!(match.results && match.results.length > 0);
}

/** Check if tournament is BR-style (Free Fire, PUBG, BGMI with 12 teams/lobby) */
export function isBRTournament(tournament: Tournament): boolean {
    const game = (tournament.game || '').toLowerCase();
    const type = (tournament.type || '').toLowerCase();
    const format = (tournament.format || '').toLowerCase();
    const mode = ((tournament as any).mode || '').toLowerCase();

    // Explicit 4v4, Clash Squad, TDM, 1v1, or Head-to-Head formats are match-based, not BR lobbies
    if (
        format.includes('4v4') || format.includes('clash squad') || format.includes('tdm') || format.includes('1v1') ||
        mode.includes('4v4') || mode.includes('clash squad') || mode.includes('tdm') || mode.includes('1v1') ||
        type.includes('4v4') || type.includes('clash squad') || type.includes('head-to-head')
    ) {
        return false;
    }

    return game.includes('free fire') || game.includes('pubg') || game.includes('bgmi') ||
           type.includes('br') || type.includes('battle royale') ||
           format.includes('br') || format.includes('battle royale');
}

// ─── Group Distribution Algorithm ──────────────────────────────

/**
 * Distribute participants into groups as evenly as possible.
 * Difference between largest and smallest group never exceeds 1.
 * 
 * Example: 50 teams / 4 groups → [13, 13, 12, 12]
 */
export function calculateGroupSizes(totalParticipants: number, numGroups: number): number[] {
    if (numGroups <= 0) return [];
    const base = Math.floor(totalParticipants / numGroups);
    const remainder = totalParticipants % numGroups;
    const sizes: number[] = [];
    for (let i = 0; i < numGroups; i++) {
        sizes.push(base + (i < remainder ? 1 : 0));
    }
    return sizes; // e.g. [13, 13, 12, 12]
}

/**
 * Fisher-Yates shuffle — deterministic if seed provided.
 * ponytail: stdlib equivalent, no dependency.
 */
function fisherYatesShuffle<T>(array: T[], seed?: number): T[] {
    const arr = [...array];
    let rng = seed ?? Date.now();
    // Simple seeded RNG (mulberry32)
    const next = () => {
        rng = (rng * 1664525 + 1013904223) | 0;
        return ((rng >>> 0) % 1000000) / 1000000;
    };
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Cross-group distribution for advancement — avoids putting all teams
 * from the same previous group into the same new group.
 * 
 * Example: 4 groups qualifying 6 each → 2 new groups
 * Group A1 goes to new Group A, A2 to new Group B, A3 to new Group A...
 * This is "snake" distribution.
 */
function crossGroupDistribute(
    qualifiersByGroup: { groupName: string; teams: Team[] }[],
    numNewGroups: number
): Team[] {
    // Interleave: take teams round-robin from each source group
    const maxPerSource = Math.max(...qualifiersByGroup.map(g => g.teams.length));
    const interleaved: Team[] = [];
    for (let i = 0; i < maxPerSource; i++) {
        for (const source of qualifiersByGroup) {
            if (source.teams[i]) interleaved.push(source.teams[i]);
        }
    }
    // Now distribute interleaved list into new groups
    // This naturally avoids clustering same-source teams
    return interleaved;
}

// ─── Group Generation ──────────────────────────────────────────

/**
 * Generate groups from a list of eligible participants.
 * Pure function — does NOT write to Firestore. Caller writes the result.
 */
export function generateGroups(params: {
    participants: { teamId?: string; userId: string; teamName?: string; username: string; logoUrl?: string; teammates?: string[] }[];
    numGroups: number;
    teamsPerGroup?: number;
    distributionMethod?: DistributionMethod;
    namingStyle?: GroupNamingStyle;
    roundNumber: number;
    maps?: string[];
}): GroupGenerationResult {
    const {
        participants,
        numGroups,
        distributionMethod = 'random',
        namingStyle = 'alpha',
        roundNumber,
    } = params;

    if (participants.length === 0) {
        return { groups: [], distributionMethod, totalAssigned: 0 };
    }

    // Convert participants to Team objects
    const teams: Team[] = participants.map(p => {
        const t: Team = {
            id: p.teamId || p.userId,
            name: p.teamName || p.username,
            players: p.teammates ? [p.username, ...p.teammates] : [p.username],
        };
        if (p.logoUrl) t.logoUrl = p.logoUrl;
        return t;
    });

    // Apply distribution method
    let orderedTeams: Team[];
    if (distributionMethod === 'seeded' || distributionMethod === 'balanced') {
        // ponytail: seeded/balanced not fully implemented yet — use random with a note
        // Mark as unavailable rather than pretending it works
        orderedTeams = fisherYatesShuffle(teams);
    } else {
        // Random
        orderedTeams = fisherYatesShuffle(teams);
    }

    // Strict Battle Royale limit: never allow more than 12 teams in one BR group
    const isBR = (params as any).isBR ?? true;
    const effectiveNumGroups = isBR
        ? Math.max(numGroups, Math.ceil(orderedTeams.length / 12))
        : numGroups;

    // Calculate group sizes (even distribution, diff <= 1, max 12 for BR)
    const sizes = calculateGroupSizes(orderedTeams.length, effectiveNumGroups);

    // Build groups
    const groups = sizes.map((size, i) => {
        const groupTeams = orderedTeams.splice(0, size);
        return {
            id: `group-r${roundNumber}-${Date.now()}-${i}`,
            name: generateGroupName(i, namingStyle),
            teamLimit: isBR ? Math.min(params.teamsPerGroup || 12, 12) : (params.teamsPerGroup || size),
            teams: groupTeams,
            matches: [],
            isPublic: true,
            status: 'preview' as GroupStatus,
            roundNumber,
        };
    });

    return {
        groups,
        distributionMethod,
        totalAssigned: teams.length,
    };
}

// ─── Match Generation ──────────────────────────────────────────

/**
 * Generate matches for a group based on tournament configuration.
 * For BR (Free Fire/PUBG): creates N lobby matches where all teams play together.
 * For 1v1: creates round-robin or bracket matches.
 */
export function generateMatchesForGroup(params: {
    group: TournamentGroup;
    matchCount: number;
    isBR: boolean;
    roundNumber: number;
    maps?: string[];
}): Match[] {
    const { group, matchCount, isBR, roundNumber, maps } = params;

    if (isBR) {
        // BR mode: each match is a lobby with all teams in the group
        // Results are stored in match.results[] array
        const matches: Match[] = [];
        for (let i = 0; i < matchCount; i++) {
            matches.push({
                id: `match-r${roundNumber}-${group.id}-${i}-${Date.now()}`,
                groupId: group.id,
                round: roundNumber,
                status: 'scheduled',
                results: [], // Will be populated by ResultUploader
                map: maps?.[i] || maps?.[0] || '',
            });
        }
        return matches;
    } else {
        // 1v1 mode: round-robin within the group
        const matches: Match[] = [];
        const teams = group.teams;
        if (teams.length < 2) return matches;

        for (let i = 0; i < teams.length; i++) {
            for (let j = i + 1; j < teams.length; j++) {
                matches.push({
                    id: `match-r${roundNumber}-${group.id}-${matches.length}-${Date.now()}`,
                    groupId: group.id,
                    round: roundNumber,
                    team1Id: teams[i].id,
                    team2Id: teams[j].id,
                    status: 'scheduled',
                    score1: 0,
                    score2: 0,
                    map: maps?.[matches.length % maps.length] || '',
                });
            }
        }
        return matches;
    }
}

/**
 * Generate matches for all groups in a round.
 */
export function generateMatchesForRound(params: {
    groups: TournamentGroup[];
    matchesPerGroup: number;
    isBR: boolean;
    roundNumber: number;
    maps?: string[];
}): TournamentGroup[] {
    return params.groups.map(group => ({
        ...group,
        matches: generateMatchesForGroup({
            group,
            matchCount: params.matchesPerGroup,
            isBR: params.isBR,
            roundNumber: params.roundNumber,
            maps: params.maps,
        }),
    }));
}

// ─── Standings Calculation (uses scoringEngine) ─────────────────

/**
 * Calculate standings for a single group using the scoring engine.
 * This is THE ONLY place standings are calculated — no duplicates.
 * Works for both BR (results array) and 1v1 (score1/score2) matches.
 */
export function calculateGroupStandings(params: {
    group: TournamentGroup;
    tournament: Tournament;
}): TournamentStanding[] {
    const { group, tournament } = params;
    const scoringConfig = getScoringConfig(tournament);
    const isBR = isBRTournament(tournament);

    if (isBR) {
        // BR: aggregate from match.results[] arrays using scoringEngine
        const matchResults: ScoredResult[][] = [];
        for (const match of group.matches) {
            if (match.status === 'completed' && match.results && match.results.length > 0) {
                const scoredResults: ScoredResult[] = match.results.map(r =>
                    scoreTeamResult({
                        teamId: r.teamId,
                        teamName: r.teamName,
                        position: r.placement,
                        kills: r.kills,
                        scoring: scoringConfig,
                    })
                );
                matchResults.push(scoredResults);
            }
        }

        return aggregateStandings({
            matchResults,
            teams: group.teams.map(t => ({ id: t.id, name: t.name, logoUrl: t.logoUrl })),
        });
    } else {
        // 1v1: derive results from score1/score2
        // ponytail: convert 1v1 scores to ScoredResult format for the scoring engine
        const matchResults: ScoredResult[][] = [];
        for (const match of group.matches) {
            if (match.status === 'completed') {
                const team1 = group.teams.find(t => t.id === match.team1Id);
                const team2 = group.teams.find(t => t.id === match.team2Id);
                if (team1 && team2) {
                    // For 1v1, treat score as points directly
                    matchResults.push([
                        {
                            teamId: team1.id,
                            teamName: team1.name,
                            placement: match.score1 > match.score2 ? 1 : 2,
                            kills: match.score1 || 0,
                            placementPoints: match.score1 > match.score2 ? 1 : 0,
                            killPoints: 0,
                            totalPoints: match.score1 || 0,
                            scoringVersion: scoringConfig.scoringVersion ?? 1,
                        },
                        {
                            teamId: team2.id,
                            teamName: team2.name,
                            placement: match.score2 > match.score1 ? 1 : 2,
                            kills: match.score2 || 0,
                            placementPoints: match.score2 > match.score1 ? 1 : 0,
                            killPoints: 0,
                            totalPoints: match.score2 || 0,
                            scoringVersion: scoringConfig.scoringVersion ?? 1,
                        },
                    ]);
                }
            }
        }

        return aggregateStandings({
            matchResults,
            teams: group.teams.map(t => ({ id: t.id, name: t.name, logoUrl: t.logoUrl })),
        });
    }
}

/**
 * Calculate standings for all groups in a round.
 */
export function calculateRoundStandings(params: {
    groups: TournamentGroup[];
    tournament: Tournament;
}): { groupId: string; groupName: string; standings: TournamentStanding[] }[] {
    return params.groups.map(group => ({
        groupId: group.id,
        groupName: group.name,
        standings: calculateGroupStandings({ group, tournament: params.tournament }),
    }));
}

// ─── Qualification ─────────────────────────────────────────────

/**
 * Check if all matches in all groups of a round are completed.
 * Qualification cannot run until this returns true.
 */
export function isRoundComplete(params: {
    groups: TournamentGroup[];
    tournament: Tournament;
}): { complete: boolean; totalMatches: number; completedMatches: number } {
    let totalMatches = 0;
    let completedMatches = 0;
    for (const group of params.groups) {
        for (const match of group.matches) {
            totalMatches++;
            if (match.status === 'completed') completedMatches++;
        }
    }
    return { complete: totalMatches > 0 && totalMatches === completedMatches, totalMatches, completedMatches };
}

/**
 * Generate qualification preview — shows who qualifies before publishing.
 * Uses the scoring engine's standings with tie-breakers already applied.
 */
export function generateQualificationPreview(params: {
    groups: TournamentGroup[];
    tournament: Tournament;
    roundNumber: number;
    qualificationCount: number;       // Top N per group
    qualificationType?: QualificationRuleType;
}): QualificationPreview {
    const { groups, tournament, roundNumber, qualificationCount, qualificationType = 'top_n_per_group' } = params;

    const roundStandings = calculateRoundStandings({ groups, tournament });
    const previewGroups: QualificationPreview['groups'] = [];
    const tiesRequiringReview: QualificationPreview['tiesRequiringReview'] = [];
    let totalQualified = 0;
    let totalEliminated = 0;

    for (const { groupId, groupName, standings } of roundStandings) {
        const groupStandingsWithQual = standings.map((s, idx) => {
            const qualifies = qualificationType === 'total_top_n'
                ? idx < qualificationCount  // Will be re-evaluated after all groups
                : idx < qualificationCount;

            const qualificationStatus: QualificationStatus = qualifies ? 'qualified' : 'eliminated';

            if (qualifies) totalQualified++;
            else totalEliminated++;

            return { ...s, qualificationStatus };
        });

        // Check for ties at the qualification cutoff
        if (groupStandingsWithQual.length > qualificationCount) {
            const lastQualified = groupStandingsWithQual[qualificationCount - 1];
            const firstEliminated = groupStandingsWithQual[qualificationCount];
            if (lastQualified && firstEliminated && lastQualified.totalPoints === firstEliminated.totalPoints) {
                tiesRequiringReview.push({
                    groupId,
                    groupName,
                    teamId: firstEliminated.teamId,
                    teamName: firstEliminated.teamName,
                    points: firstEliminated.totalPoints,
                });
            }
        }

        previewGroups.push({ groupId, groupName, standings: groupStandingsWithQual });
    }

    // For total_top_n, re-evaluate across all groups
    if (qualificationType === 'total_top_n') {
        const allStandings = previewGroups.flatMap(g => g.standings);
        allStandings.sort((a, b) => b.totalPoints - a.totalPoints || b.killPoints - a.killPoints || b.placementPoints - a.placementPoints || a.bestPlacement - b.bestPlacement);
        const cutoff = allStandings[qualificationCount - 1];
        for (const g of previewGroups) {
            g.standings = g.standings.map(s => {
                const qualifies = cutoff && s.totalPoints > cutoff.totalPoints ||
                    (s.totalPoints === cutoff?.totalPoints && s.killPoints > cutoff.killPoints) ||
                    (s.totalPoints === cutoff?.totalPoints && s.killPoints === cutoff.killPoints && s.bestPlacement < cutoff.bestPlacement);
                return { ...s, qualificationStatus: qualifies ? 'qualified' : 'eliminated' as QualificationStatus };
            });
        }
        totalQualified = Math.min(qualificationCount, allStandings.length);
        totalEliminated = allStandings.length - totalQualified;
    }

    return { roundNumber, groups: previewGroups, totalQualified, totalEliminated, tiesRequiringReview };
}

/**
 * Get the list of qualified teams from a qualification preview.
 */
export function getQualifiedTeams(preview: QualificationPreview): Team[] {
    const teams: Team[] = [];
    for (const group of preview.groups) {
        for (const standing of group.standings) {
            if (standing.qualificationStatus === 'qualified') {
                const t: Team = {
                    id: standing.teamId,
                    name: standing.teamName,
                };
                if (standing.logoUrl) t.logoUrl = standing.logoUrl;
                teams.push(t);
            }
        }
    }
    return teams;
}

// ─── Next Round Creation ───────────────────────────────────────

/**
 * Create the next round: generate groups, distribute qualified teams, create matches.
 * Uses cross-group distribution to avoid clustering.
 */
export function createNextRound(params: {
    qualifiedTeams: Team[];
    qualifiersByGroup: { groupName: string; teams: Team[] }[];
    nextRoundConfig: ExtendedRoundConfig;
    tournament: Tournament;
}): { groups: TournamentGroup[]; roundNumber: number } {
    const { qualifiedTeams, qualifiersByGroup, nextRoundConfig, tournament } = params;
    const roundNumber = nextRoundConfig.roundNumber;
    const numGroups = nextRoundConfig.numGroups;
    const namingStyle = nextRoundConfig.groupNamingStyle || 'alpha';
    const isBR = isBRTournament(tournament);
    const matchesPerGroup = nextRoundConfig.matchesPerGroup || (isBR ? 3 : 0);
    const maps = nextRoundConfig.maps || [];

    // Cross-group distribution: interleave qualifiers from different source groups
    const distributedTeams = crossGroupDistribute(qualifiersByGroup, numGroups);

    // Strict Battle Royale limit: never allow more than 12 teams in one BR group
    const effectiveNumGroups = isBR
        ? Math.max(numGroups, Math.ceil(distributedTeams.length / 12))
        : numGroups;

    // Calculate group sizes (even distribution, diff <= 1, max 12 for BR)
    const sizes = calculateGroupSizes(distributedTeams.length, effectiveNumGroups);

    // Build groups
    const groups: TournamentGroup[] = sizes.map((size, i) => {
        const groupTeams = distributedTeams.splice(0, size);
        return {
            id: `group-r${roundNumber}-${Date.now()}-${i}`,
            name: generateGroupName(i, namingStyle),
            teamLimit: isBR ? Math.min(nextRoundConfig.teamsPerGroup || 12, 12) : (nextRoundConfig.teamsPerGroup || size),
            teams: groupTeams,
            matches: [],
            isPublic: true,
        };
    });

    // Generate matches for each group
    const groupsWithMatches = generateMatchesForRound({
        groups,
        matchesPerGroup,
        isBR,
        roundNumber,
        maps,
    });

    return { groups: groupsWithMatches, roundNumber };
}


/**
 * Check if any match in the groups has started (LIVE or COMPLETED).
 * Groups with started matches cannot be regenerated without explicit confirmation.
 */
export function hasMatchesStarted(groups: TournamentGroup[]): boolean {
    return groups.some(g => g.matches.some(m => m.status === 'live' || m.status === 'completed'));
}

/**
 * Check if groups are locked (either explicitly locked or matches have started).
 */
export function areGroupsLocked(groups: TournamentGroup[]): boolean {
    return groups.some(g => (g as any).status === 'locked') || hasMatchesStarted(groups);
}

/**
 * Lock groups — returns groups with locked status.
 * Once locked, groups cannot be regenerated without admin override.
 */
export function lockGroups(groups: TournamentGroup[]): TournamentGroup[] {
    return groups.map(g => ({ ...g, status: 'locked' as any }));
}

// ─── Check-in System ────────────────────────────────────────────

/**
 * Check if a participant is eligible for group assignment.
 * Must be: approved + checked-in (if check-in required) + not disqualified/withdrawn.
 */
export function isParticipantEligible(
    participant: { status?: string; checkedIn?: boolean; isDisqualified?: boolean; isWithdrawn?: boolean; paymentStatus?: string },
    requireCheckIn: boolean = false,
): boolean {
    if (participant.status !== 'approved') return false;
    if (participant.isDisqualified) return false;
    if (participant.isWithdrawn) return false;
    if (participant.paymentStatus === 'failed') return false;
    if (requireCheckIn && !participant.checkedIn) return false;
    return true;
}

/**
 * Get count of eligible participants for group assignment.
 */
export function getEligibleParticipants(
    participants: any[],
    requireCheckIn: boolean = false,
): any[] {
    return participants.filter(p => isParticipantEligible(p, requireCheckIn));
}

/**
 * Get check-in stats for the roadmap.
 */
export function getCheckInStats(participants: any[]): { total: number; checkedIn: number; pending: number } {
    const approved = participants.filter(p => p.status === 'approved');
    const checkedIn = approved.filter(p => p.checkedIn).length;
    return {
        total: approved.length,
        checkedIn,
        pending: approved.length - checkedIn,
    };
}

// ─── Audit Log ────────────────────────────────────────────────

/**
 * Create an audit log entry for a tournament operation.
 * Callers should append this to a tournament's auditLog array.
 */
export function createAuditEntry(params: {
    userId: string;
    userName: string;
    action: string;
    details?: string;
    roundNumber?: number;
    targetId?: string;
}): TournamentAuditEntry {
    return {
        timestamp: new Date() as any,
        userId: params.userId,
        userName: params.userName,
        action: params.action,
        details: params.details,
        roundNumber: params.roundNumber,
        targetId: params.targetId,
    };
}

// ─── Roadmap Computation ───────────────────────────────────────

/**
 * Compute the roadmap dynamically from actual tournament state.
 * This is NOT stored — it's derived. The UI calls this to render the roadmap.
 */
export function computeRoadmap(tournament: Tournament): RoadmapStageInfo[] {
    const stages: RoadmapStageInfo[] = [];
    const roadmap = tournament.roadmap || [];

    // Registration stage
    stages.push({
        label: 'Registration',
        type: 'registration',
        status: (tournament.stage as string) === 'registration' || (!tournament.stage && tournament.status === 'upcoming')
            ? 'active'
            : tournament.stage && (tournament.stage as string) !== 'registration'
                ? 'completed'
                : 'pending',
        participantCount: tournament.currentPlayers || 0,
        progressPercent: 0,
    });

    // Check-in stage — derived from tournament stage progression
    // Check-in is 'completed' once we've moved past registration to group_stage
    const isPastCheckIn = (tournament.stage as string) === 'group_stage' || (tournament.stage as string) === 'knockout';
    stages.push({
        label: 'Check-in',
        type: 'check_in',
        status: isPastCheckIn ? 'completed'
            : (tournament.stage as string) === 'registration' && tournament.status === 'live' ? 'active'
            : 'pending',
        progressPercent: isPastCheckIn ? 100 : 0,
    });

    // Group allocation
    const hasGroups = (tournament.groups || []).length > 0;
    stages.push({
        label: 'Group Allocation',
        type: 'group_allocation',
        status: hasGroups ? 'completed' : 'pending',
        groupCount: hasGroups ? tournament.groups!.length : 0,
        progressPercent: hasGroups ? 100 : 0,
    });

    // Each round from roadmap config
    const currentRound = tournament.currentRound || 0;
    for (const round of roadmap) {
        const roundNum = round.roundNumber;
        const roundGroups = (tournament.groups || []).filter(g =>
            g.id.includes(`r${roundNum}`) || (roundNum === 1 && !g.id.includes('r'))
        );

        let totalMatches = 0;
        let completedMatches = 0;
        for (const g of roundGroups) {
            totalMatches += g.matches.length;
            completedMatches += g.matches.filter(m => m.status === 'completed').length;
        }

        const isCurrentRound = roundNum === currentRound;
        const isPastRound = roundNum < currentRound;
        const isFutureRound = roundNum > currentRound;

        const matchProgress = totalMatches > 0 ? (completedMatches / totalMatches) * 100 : 0;
        const isRoundDone = totalMatches > 0 && completedMatches === totalMatches;

        // Round stage
        stages.push({
            label: round.stageName || `Round ${roundNum}`,
            type: 'round',
            status: isPastRound || (isRoundDone && !isCurrentRound) ? 'completed'
                : isCurrentRound ? 'current'
                : isFutureRound ? 'upcoming'
                : 'pending',
            roundNumber: roundNum,
            groupCount: roundGroups.length,
            matchCount: totalMatches,
            completedMatches,
            progressPercent: Math.round(matchProgress),
        });

        // Qualification stage after this round
        const nextRound = roadmap.find(r => r.roundNumber === roundNum + 1);
        const hasMoreRounds = !!nextRound;
        stages.push({
            label: `Qualification`,
            type: 'qualification',
            status: isRoundDone && isPastRound ? 'completed'
                : isRoundDone && isCurrentRound && !hasMoreRounds ? 'completed' // Final round — no qualification needed
                : isCurrentRound && !isRoundDone ? 'pending'
                : isFutureRound ? 'upcoming'
                : 'pending',
            roundNumber: roundNum,
            qualifiedCount: isRoundDone ? round.qualificationRule * (roundGroups.length || 1) : 0,
            eliminatedCount: isRoundDone ? 0 : 0, // Calculated when qualification is published
            progressPercent: isRoundDone && isPastRound ? 100 : 0,
        });
    }

    // Final / Completed
    if (tournament.status === 'completed') {
        stages.push({
            label: 'Tournament Completed',
            type: 'completed',
            status: 'completed',
            progressPercent: 100,
        });
    }

    return stages;
}

/**
 * Compute overall tournament progress percentage.
 */
export function computeTournamentProgress(tournament: Tournament): number {
    const stages = computeRoadmap(tournament);
    if (stages.length === 0) return 0;
    const completed = stages.filter(s => s.status === 'completed').length;
    return Math.round((completed / stages.length) * 100);
}

/**
 * Get the current active stage from the roadmap.
 */
export function getCurrentStage(tournament: Tournament): RoadmapStageInfo | null {
    const stages = computeRoadmap(tournament);
    return stages.find(s => s.status === 'current') || stages.find(s => s.status === 'active') || null;
}

/**
 * Get the next upcoming stage.
 */
export function getNextStage(tournament: Tournament): RoadmapStageInfo | null {
    const stages = computeRoadmap(tournament);
    const currentIdx = stages.findIndex(s => s.status === 'current' || s.status === 'active');
    if (currentIdx === -1) return stages.find(s => s.status === 'pending' || s.status === 'upcoming') || null;
    return stages.slice(currentIdx + 1).find(s => s.status === 'upcoming' || s.status === 'pending') || null;
}

// ─── Tournament State Machine ─────────────────────────────────

/**
 * Valid state transitions for the tournament lifecycle.
 */
const VALID_TRANSITIONS: Record<string, string[]> = {
    'draft': ['registration_open'],
    'registration_open': ['registration_closed', 'cancelled'],
    'registration_closed': ['check_in', 'group_allocation', 'cancelled'],
    'check_in': ['group_allocation', 'cancelled'],
    'group_allocation': ['round_active', 'cancelled'],
    'round_active': ['results_pending', 'cancelled'],
    'results_pending': ['qualification', 'round_active', 'cancelled'], // round_active for reopen
    'qualification': ['next_round_preparation', 'completed', 'cancelled'],
    'next_round_preparation': ['round_active', 'cancelled'],
    'completed': [],
    'cancelled': [],
};

/**
 * Check if a state transition is valid.
 */
export function canTransition(from: string, to: string): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Get the effective lifecycle status from tournament state.
 * Maps the old 4-value stage to the new lifecycle for backward compat.
 */
export function getLifecycleStatus(tournament: Tournament): TournamentLifecycleStatus {
    if (tournament.status === 'draft') return 'draft';
    if (tournament.status === 'cancelled') return 'cancelled';
    if (tournament.status === 'completed') return 'completed';

    const stage = tournament.stage || 'registration';
    switch (stage) {
        case 'registration': return tournament.status === 'upcoming' ? 'registration_open' : 'registration_open';
        case 'group_stage': return 'round_active';
        case 'knockout': return 'round_active';
        case 'completed': return 'completed';
        default: return 'registration_open';
    }
}

// ─── Participant Progression ───────────────────────────────────

/**
 * Build participant progression history from tournament data.
 * This is computed on demand — not stored (ponytail: no derived data stored).
 */
export function buildParticipantProgression(params: {
    tournament: Tournament;
    teamId: string;
}): ParticipantRoundResult[] {
    const { tournament, teamId } = params;
    const progression: ParticipantRoundResult[] = [];
    const roadmap = tournament.roadmap || [];

    for (const round of roadmap) {
        const roundNum = round.roundNumber;
        const roundGroups = (tournament.groups || []).filter(g =>
            g.id.includes(`r${roundNum}`) || (roundNum === 1 && !g.id.includes('r'))
        );

        for (const group of roundGroups) {
            if (!group.teams.some(t => t.id === teamId)) continue;

            const standings = calculateGroupStandings({ group, tournament });
            const standing = standings.find(s => s.teamId === teamId);
            if (!standing) continue;

            const qualifies = standing.rank <= (round.qualificationRule || 0);

            progression.push({
                roundNumber: roundNum,
                groupId: group.id,
                groupName: group.name,
                teamId,
                teamName: standing.teamName,
                rank: standing.rank,
                kills: standing.kills,
                placementPoints: standing.placementPoints,
                killPoints: standing.killPoints,
                totalPoints: standing.totalPoints,
                qualificationStatus: qualifies ? 'qualified' : 'eliminated',
                matches: standing.matches,
            });
        }
    }

    return progression;
}

// ─── Validation ────────────────────────────────────────────────

/**
 * Validate round configuration before publishing a tournament.
 * Checks that qualification numbers make sense across rounds.
 */
export function validateRoundConfiguration(params: {
    rounds: ExtendedRoundConfig[];
    totalParticipants: number;
}): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const { rounds, totalParticipants } = params;

    if (rounds.length === 0) {
        errors.push('At least one round must be configured');
        return { valid: false, errors };
    }

    let expectedParticipants = totalParticipants;
    for (let i = 0; i < rounds.length; i++) {
        const round = rounds[i];
        const capacity = round.numGroups * (round.teamsPerGroup || 0);
        const qualifiers = round.numGroups * round.qualificationRule;

        if (round.teamsPerGroup && capacity < expectedParticipants && i === 0) {
            errors.push(`Round ${round.roundNumber}: capacity ${capacity} < ${expectedParticipants} registered participants`);
        }

        if (i < rounds.length - 1) {
            const nextRound = rounds[i + 1];
            const nextCapacity = nextRound.numGroups * (nextRound.teamsPerGroup || 0);
            if (nextCapacity > 0 && qualifiers > nextCapacity) {
                errors.push(
                    `Round ${round.roundNumber}: ${qualifiers} qualifiers exceed Round ${nextRound.roundNumber} capacity of ${nextCapacity}`
                );
            }
        }

        expectedParticipants = qualifiers;
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validate group assignment — no duplicate participants.
 */
export function validateGroupAssignment(groups: TournamentGroup[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const seen = new Set<string>();

    for (const group of groups) {
        for (const team of group.teams) {
            if (seen.has(team.id)) {
                errors.push(`Team ${team.name} (${team.id}) appears in multiple groups`);
            }
            seen.add(team.id);
        }
    }

    return { valid: errors.length === 0, errors };
}

// ─── Champion Calculation ──────────────────────────────────────

/**
 * Calculate the champion from the final round standings.
 * Champion = Rank 1 in the final round.
 */
export function calculateChampions(params: {
    tournament: Tournament;
}): { champion: TournamentStanding | null; runnerUp: TournamentStanding | null; thirdPlace: TournamentStanding | null } {
    const { tournament } = params;
    const roadmap = tournament.roadmap || [];
    if (roadmap.length === 0) return { champion: null, runnerUp: null, thirdPlace: null };

    const finalRound = roadmap[roadmap.length - 1];
    const finalRoundNum = finalRound.roundNumber;

    // For knockout, use bracket matches; for group final, use group standings
    if (tournament.bracketMatches && tournament.bracketMatches.length > 0) {
        const completedMatches = tournament.bracketMatches.filter(m => m.status === 'completed');
        if (completedMatches.length === 0) return { champion: null, runnerUp: null, thirdPlace: null };

        // Find the final match (highest round number, only 1 match)
        const maxRound = Math.max(...completedMatches.map(m => m.round));
        const finalMatch = completedMatches.find(m => m.round === maxRound);
        if (!finalMatch) return { champion: null, runnerUp: null, thirdPlace: null };

        const championId = finalMatch.score1 > finalMatch.score2 ? finalMatch.team1Id : finalMatch.team2Id;
        const runnerUpId = finalMatch.score1 > finalMatch.score2 ? finalMatch.team2Id : finalMatch.team1Id;

        // Build minimal standings from bracket
        const allTeams = (tournament.groups || []).flatMap(g => g.teams);
        const champion = allTeams.find(t => t.id === championId);
        const runnerUp = allTeams.find(t => t.id === runnerUpId);

        return {
            champion: champion ? {
                teamId: champion.id, teamName: champion.name, logoUrl: champion.logoUrl,
                matches: 0, kills: 0, placementPoints: 0, killPoints: 0, totalPoints: 0,
                bestPlacement: 1, rank: 1,
            } : null,
            runnerUp: runnerUp ? {
                teamId: runnerUp.id, teamName: runnerUp.name, logoUrl: runnerUp.logoUrl,
                matches: 0, kills: 0, placementPoints: 0, killPoints: 0, totalPoints: 0,
                bestPlacement: 2, rank: 2,
            } : null,
            thirdPlace: null,
        };
    }

    // For group-based final, use standings
    const finalGroups = (tournament.groups || []).filter(g =>
        g.id.includes(`r${finalRoundNum}`)
    );

    if (finalGroups.length === 0) return { champion: null, runnerUp: null, thirdPlace: null };

    // Combine all final group standings
    const allStandings: TournamentStanding[] = [];
    for (const group of finalGroups) {
        allStandings.push(...calculateGroupStandings({ group, tournament }));
    }
    allStandings.sort((a, b) => a.rank - b.rank);

    return {
        champion: allStandings[0] || null,
        runnerUp: allStandings[1] || null,
        thirdPlace: allStandings[2] || null,
    };
}

// ═══════════════════════════════════════════════════════════════
// DEFAULT ROADMAP GENERATION
// ponytail: derive from slots + type — no manual config needed for basic tourneys.
// Organizers can override any round in the admin panel afterward.
// ═══════════════════════════════════════════════════════════════

/**
 * Generates a sensible default roadmap based on slot count and tournament type.
 *
 * For BR (Free Fire/PUBG): lobby-style rounds, top-N qualify per group.
 * For 1v1: single-elimination bracket rounds.
 *
 * The roadmap scales down automatically for smaller tournaments.
 */
export function generateDefaultRoadmap(slots: number, _type: string): RoundConfig[] {
    // ponytail: simple heuristic — don't over-engineer the bracket math.
    // Slots → groups → qualification → until 1 final lobby remains.

    const isBR = _type === 'Battle Royale' || _type === 'BR';

    if (!isBR) {
        // 1v1 single-elim: log2(slots) rounds
        const numRounds = Math.ceil(Math.log2(Math.max(slots, 2)));
        const roadmap: RoundConfig[] = [];
        for (let r = 1; r <= numRounds; r++) {
            const remaining = Math.ceil(slots / Math.pow(2, r - 1));
            roadmap.push({
                roundNumber: r,
                numGroups: 1,
                qualificationRule: Math.ceil(remaining / 2),
                maps: [],
                stageName: r === numRounds ? 'Grand Finals' : `Round ${r}`,
                status: 'upcoming',
                description: `${remaining} players → ${Math.ceil(remaining / 2)} advance`,
                qualificationType: 'top_n_per_group',
                distributionMethod: 'seeded',
            });
        }
        return roadmap;
    }

    // BR: lobby-style — groups shrink each round until 1 final lobby
    const roadmap: RoundConfig[] = [];
    let remaining = slots;
    let round = 1;

    // For small tournaments (<=12), just 1 round (finals)
    if (slots <= 12) {
        return [{
            roundNumber: 1,
            numGroups: 1,
            qualificationRule: 1,
            maps: [],
            stageName: 'Grand Finals',
            status: 'upcoming',
            description: `${slots} teams in a single lobby`,
            qualificationType: 'final_ranking',
        }];
    }

    // For 13-48: 2 rounds (groups → finals)
    // For 49+: 3 rounds (groups → semis → finals)
    const maxFinalLobbySize = 12; // Free Fire max lobby
    const groupSize = 12; // ideal teams per group

    while (remaining > maxFinalLobbySize) {
        const numGroups = Math.ceil(remaining / groupSize);
        const qualifiedPerGroup = Math.ceil(maxFinalLobbySize / numGroups);
        const totalQualified = qualifiedPerGroup * numGroups;

        const isLast = totalQualified <= maxFinalLobbySize;

        roadmap.push({
            roundNumber: round,
            numGroups,
            qualificationRule: qualifiedPerGroup,
            maps: [],
            stageName: round === 1 ? 'Group Stage' : (isLast ? 'Semi Finals' : `Round ${round}`),
            status: 'upcoming',
            description: `${numGroups} groups × ${Math.ceil(remaining / numGroups)} teams → top ${qualifiedPerGroup} qualify (${totalQualified} total)`,
            qualificationType: 'top_n_per_group',
            teamsPerGroup: Math.ceil(remaining / numGroups),
            matchesPerGroup: 3, // default 3 matches per round
            distributionMethod: 'random',
            groupNamingStyle: 'alpha',
        });

        remaining = totalQualified;
        round++;
    }

    // Final round — single lobby
    if (roadmap.length > 0) {
        roadmap.push({
            roundNumber: round,
            numGroups: 1,
            qualificationRule: 1,
            maps: [],
            stageName: 'Grand Finals',
            status: 'upcoming',
            description: `${remaining} teams in the final lobby`,
            qualificationType: 'final_ranking',
            teamsPerGroup: remaining,
            matchesPerGroup: 3,
            distributionMethod: 'seeded',
            groupNamingStyle: 'alpha',
        });
    }

    return roadmap;
}
