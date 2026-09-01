// ═══════════════════════════════════════════════════════════════
// SCORING ENGINE — THE ONE AND ONLY SCORING CALCULATION SERVICE
// Every part of NexPlay uses this. No duplicate implementations.
// ponytail: pure functions, no deps, zero side-effects.
// ═══════════════════════════════════════════════════════════════

import { GameScoringConfig, TournamentScoringSnapshot, ScoredResult, TournamentStanding } from '../types/scoring';

/**
 * Calculate a single team's score from position + kills + scoring config.
 * Works with both GameScoringConfig and TournamentScoringSnapshot (both have the same shape).
 */
export function calculateTeamScore(params: {
    position: number;
    kills: number;
    scoring: {
        killPoints: number;
        placementPoints: Record<string, number>;
        maxPlacement?: number;
    };
}): { placementPoints: number; killPoints: number; totalPoints: number } {
    const { position, kills, scoring } = params;

    // ponytail: validation at trust boundary — position must be >= 1 integer
    const pos = Math.floor(position);
    const kls = Math.floor(kills);

    if (pos < 1) {
        return { placementPoints: 0, killPoints: 0, totalPoints: 0 };
    }
    if (kls < 0) {
        return {
            placementPoints: getPlacementPoints(pos, scoring),
            killPoints: 0,
            totalPoints: getPlacementPoints(pos, scoring),
        };
    }

    const placementPoints = getPlacementPoints(pos, scoring);
    const killPoints = kls * scoring.killPoints;
    const totalPoints = placementPoints + killPoints;

    return { placementPoints, killPoints, totalPoints };
}

/**
 * Look up placement points for a position.
 * Positions beyond maxPlacement get 0 (explicit, not silent).
 */
function getPlacementPoints(
    position: number,
    scoring: { placementPoints: Record<string, number>; maxPlacement?: number }
): number {
    const key = String(position);

    // If position is defined in the table, use it
    if (key in scoring.placementPoints) {
        return scoring.placementPoints[key];
    }

    // If maxPlacement is set and position exceeds it, return 0
    if (scoring.maxPlacement && position > scoring.maxPlacement) {
        return 0;
    }

    // Position not in table and no maxPlacement — return 0
    return 0;
}

/**
 * Validate a result entry before saving.
 * Returns { valid: boolean, errors: string[] }.
 */
export function validateResult(params: {
    position: number;
    kills: number;
    maxPlacement?: number;
}): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const { position, kills, maxPlacement } = params;

    if (!Number.isInteger(position) || position < 1) {
        errors.push('Position must be a positive integer (>= 1)');
    }
    if (!Number.isInteger(kills) || kills < 0) {
        errors.push('Kills must be a non-negative integer (>= 0)');
    }
    if (maxPlacement && position > maxPlacement) {
        errors.push(`Position ${position} exceeds maximum placement ${maxPlacement}`);
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validate a scoring configuration before saving.
 */
export function validateScoringConfig(config: GameScoringConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (typeof config.killPoints !== 'number' || config.killPoints < 0) {
        errors.push('Kill points must be a non-negative number');
    }

    if (!config.placementPoints || typeof config.placementPoints !== 'object') {
        errors.push('Placement points must be an object');
    } else {
        const positions = Object.keys(config.placementPoints);
        const seen = new Set<number>();
        for (const key of positions) {
            const pos = parseInt(key);
            const pts = config.placementPoints[key];
            if (isNaN(pos) || pos < 1) {
                errors.push(`Invalid position key: "${key}"`);
            }
            if (seen.has(pos)) {
                errors.push(`Duplicate position: ${pos}`);
            }
            seen.add(pos);
            if (typeof pts !== 'number' || pts < 0) {
                errors.push(`Invalid points for position ${pos}: must be non-negative number`);
            }
        }
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Create a tournament scoring snapshot from a game's scoring config.
 * Called when a tournament is created.
 */
export function createScoringSnapshot(params: {
    gameId: string;
    gameName: string;
    scoring: GameScoringConfig;
}): TournamentScoringSnapshot {
    return {
        gameId: params.gameId,
        gameName: params.gameName,
        killPoints: params.scoring.killPoints,
        placementPoints: { ...params.scoring.placementPoints },
        maxPlacement: params.scoring.maxPlacement,
        scoringVersion: params.scoring.scoringVersion,
        source: 'game-default',
        snapshotAt: new Date() as any,
    };
}

/**
 * Score a single team's result using a tournament's scoring snapshot.
 * Server-side authoritative calculation.
 */
export function scoreTeamResult(params: {
    teamId: string;
    teamName: string;
    position: number;
    kills: number;
    scoring: TournamentScoringSnapshot | { killPoints: number; placementPoints: Record<string, number>; maxPlacement?: number };
}): ScoredResult {
    const { placementPoints, killPoints, totalPoints } = calculateTeamScore({
        position: params.position,
        kills: params.kills,
        scoring: params.scoring,
    });

    return {
        teamId: params.teamId,
        teamName: params.teamName,
        placement: params.position,
        kills: params.kills,
        placementPoints,
        killPoints,
        totalPoints,
        scoringVersion: (params.scoring as TournamentScoringSnapshot).scoringVersion ?? 1,
    };
}

/**
 * Aggregate match results into tournament standings.
 * Multi-match: sums kills, placementPoints, killPoints, totalPoints across all matches.
 */
export function aggregateStandings(params: {
    matchResults: ScoredResult[][];  // Array of matches, each with team results
    teams?: { id: string; name: string; logoUrl?: string }[];
}): TournamentStanding[] {
    const { matchResults, teams } = params;
    const map: Record<string, TournamentStanding> = {};

    // Initialize teams that exist in the teams list (optional — also auto-creates from results)
    if (teams) {
        for (const t of teams) {
            map[t.id] = {
                teamId: t.id,
                teamName: t.name,
                logoUrl: t.logoUrl,
                matches: 0,
                kills: 0,
                placementPoints: 0,
                killPoints: 0,
                totalPoints: 0,
                bestPlacement: Infinity,
                rank: 0,
            };
        }
    }

    // Aggregate each match's results
    for (const matchResult of matchResults) {
        for (const res of matchResult) {
            if (!map[res.teamId]) {
                map[res.teamId] = {
                    teamId: res.teamId,
                    teamName: res.teamName,
                    matches: 0,
                    kills: 0,
                    placementPoints: 0,
                    killPoints: 0,
                    totalPoints: 0,
                    bestPlacement: Infinity,
                    rank: 0,
                };
            }
            const s = map[res.teamId];
            s.matches += 1;
            s.kills += res.kills;
            s.placementPoints += res.placementPoints;
            s.killPoints += res.killPoints;
            s.totalPoints += res.totalPoints;
            s.bestPlacement = Math.min(s.bestPlacement, res.placement);
        }
    }

    // Sort with tie-breakers:
    // 1. Total points (desc)
    // 2. Placement points (desc)
    // 3. Kill points (desc)
    // 4. Best placement (asc — lower is better)
    // 5. Team name (asc — stable deterministic fallback)
    const sorted = Object.values(map).sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        if (b.placementPoints !== a.placementPoints) return b.placementPoints - a.placementPoints;
        if (b.killPoints !== a.killPoints) return b.killPoints - a.killPoints;
        if (a.bestPlacement !== b.bestPlacement) return a.bestPlacement - b.bestPlacement;
        return a.teamName.localeCompare(b.teamName);
    });

    // Assign ranks
    sorted.forEach((s, i) => {
        s.rank = i + 1;
    });

    return sorted;
}

/**
 * Generate preview examples for the admin scoring config UI.
 * Uses the SAME scoring engine — no separate preview implementation.
 */
export function generateScoringPreview(config: GameScoringConfig): string[] {
    const lines: string[] = [];
    const positions = config.maxPlacement ? [1, 5, 10, 12, config.maxPlacement] : [1, 5, 10, 12];
    const killValues = [0, 5, 10];

    // Show a few representative combinations
    for (const pos of positions.slice(0, 4)) {
        for (const kills of killValues) {
            const { totalPoints } = calculateTeamScore({
                position: pos,
                kills,
                scoring: config,
            });
            const suffix = pos === 1 ? 'st' : pos === 2 ? 'nd' : pos === 3 ? 'rd' : 'th';
            lines.push(`${pos}${suffix} + ${kills} kills = ${totalPoints}`);
        }
    }

    return lines;
}
