/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * NEXPLAY TOURNAMENT STAGE RESULT VALIDATION & PROCESSING SERVICE
 * ═══════════════════════════════════════════════════════════════════════════════
 * Authoritative Server-Side Engine for:
 * 1. Deep validation of all groups, teams, matches, and results in a stage
 * 2. Automatic scoring engine calculations (Placement + Kill points)
 * 3. Prevention of partial/incomplete/duplicate stage processing
 * 4. Qualification rule evaluation & preview generation
 * 5. Atomic next-stage progression and result correction workflow
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  runTransaction,
  collection,
  setDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  Tournament,
  TournamentGroup,
  Match,
  Team,
  TeamMatchResult,
} from '../types/types';
import { GameScoringConfig, TournamentScoringSnapshot, ScoredResult } from '../types/scoring';
import {
  calculateTeamScore,
  validateResult,
} from './scoringEngine';
import {
  calculateRoundStandings,
  generateQualificationPreview,
  getQualifiedTeams,
  createNextRound,
  createAuditEntry,
  isBRTournament,
  QualificationPreview,
} from './tournamentEngine';
import { cleanFirestoreData } from '../utils/utils';

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type StageProcessingStatus =
  | 'RESULTS_INCOMPLETE'
  | 'VALIDATED'
  | 'PROCESSED'
  | 'RESULTS_REVALIDATION_REQUIRED';

export interface StageResultItem {
  teamId: string;
  teamName: string;
  groupId: string;
  groupName: string;
  matchId: string;
  matchNumber: number;
  roundNumber: number;
  placement?: number;
  kills?: number;
  placementPoints?: number;
  killPoints?: number;
  totalPoints?: number;
  status: 'complete' | 'missing' | 'invalid';
  error?: string;
}

export interface GroupValidationSummary {
  groupId: string;
  groupName: string;
  roundNumber: number;
  totalTeams: number;
  totalMatches: number;
  requiredResults: number;
  completedResults: number;
  missingResults: number;
  invalidResults: number;
  isComplete: boolean;
  teams: Team[];
  matches: Match[];
  items: StageResultItem[];
  duplicatePlacements: { matchId: string; matchNumber: number; placement: number; teams: string[] }[];
}

export interface MissingResultDetail {
  groupId: string;
  groupName: string;
  teamId: string;
  teamName: string;
  matchId: string;
  matchNumber: number;
  roundNumber: number;
  reason: string;
}

export interface StageValidationReport {
  roundNumber: number;
  stageName: string;
  stageStatus: StageProcessingStatus;
  totalGroups: number;
  completedGroups: number;
  pendingGroups: number;
  totalMatches: number;
  completedMatches: number;
  pendingMatches: number;
  totalResultsRequired: number;
  completedResults: number;
  missingResultsCount: number;
  invalidResultsCount: number;
  isValid: boolean;
  canProcess: boolean;
  statusMessage: string;
  groups: GroupValidationSummary[];
  missingList: MissingResultDetail[];
  invalidList: MissingResultDetail[];
  qualificationPreview?: QualificationPreview;
  tiesRequiringReview: { groupId: string; groupName: string; teamName: string; points: number }[];
  scoringConfig: {
    killPoints: number;
    placementPoints: Record<string, number>;
    maxPlacement?: number;
    source: string;
  };
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/** Extract authoritative scoring configuration from a tournament */
export function resolveTournamentScoringConfig(tournament: Tournament): {
  killPoints: number;
  placementPoints: Record<string, number>;
  maxPlacement?: number;
  source: string;
} {
  if (tournament.scoringSnapshot) {
    const snap = tournament.scoringSnapshot as TournamentScoringSnapshot;
    return {
      killPoints: snap.killPoints ?? 1,
      placementPoints: snap.placementPoints ?? {},
      maxPlacement: snap.maxPlacement || 12,
      source: 'Snapshot (Frozen)',
    };
  }

  if (tournament.pointSystem) {
    const placementPoints: Record<string, number> = {};
    if (Array.isArray(tournament.pointSystem.placementPoints)) {
      for (const p of tournament.pointSystem.placementPoints) {
        placementPoints[String(p.rank)] = p.points;
      }
    }
    return {
      killPoints: tournament.pointSystem.pointsPerKill ?? 1,
      placementPoints,
      maxPlacement: Object.keys(placementPoints).length > 0
        ? Math.max(...Object.keys(placementPoints).map(Number))
        : 12,
      source: 'Custom Point System',
    };
  }

  // Default Free Fire esports scoring table
  return {
    killPoints: 1,
    placementPoints: {
      '1': 12, '2': 9, '3': 8, '4': 7, '5': 6,
      '6': 5, '7': 4, '8': 3, '9': 2, '10': 1,
      '11': 0, '12': 0,
    },
    maxPlacement: 12,
    source: 'Free Fire Esports Default',
  };
}

/** Filter groups and matches belonging to a target tournament round */
export function getGroupsForRound(
  groups: TournamentGroup[] = [],
  targetRound: number
): TournamentGroup[] {
  // If groups have explicit roundNumber tag:
  const roundTagged = groups.filter((g) => g.roundNumber === targetRound);
  if (roundTagged.length > 0) return roundTagged;

  // Otherwise, filter groups that have matches for this round:
  const withRoundMatches = groups
    .map((g) => {
      const roundMatches = (g.matches || []).filter(
        (m) => (m.round || 1) === targetRound
      );
      if (roundMatches.length > 0) {
        return { ...g, matches: roundMatches };
      }
      return null;
    })
    .filter(Boolean) as TournamentGroup[];

  if (withRoundMatches.length > 0) return withRoundMatches;

  // Fallback: if no round tagging exists yet, all groups belong to Round 1
  if (targetRound === 1) return groups;

  return [];
}

// ─── 1. DEEP STAGE VALIDATION ENGINE ──────────────────────────────────────────

/**
 * Authoritatively validates every group, team, match, and result for a tournament stage.
 * Used by both UI components and server-side processing functions.
 */
export function validateTournamentStage(
  tournament: Tournament,
  targetRound?: number
): StageValidationReport {
  const roundNumber = targetRound || tournament.currentRound || 1;
  const currentRoundIdx = roundNumber - 1;
  const currentRoundConfig = tournament.roadmap?.[currentRoundIdx];
  const stageName =
    currentRoundConfig?.stageName ||
    (tournament.stage === 'group_stage' ? `Group Stage (Round ${roundNumber})` : `Round ${roundNumber}`);

  const scoringConfig = resolveTournamentScoringConfig(tournament);
  const stageGroups = getGroupsForRound(tournament.groups, roundNumber);

  const groupSummaries: GroupValidationSummary[] = [];
  const missingList: MissingResultDetail[] = [];
  const invalidList: MissingResultDetail[] = [];

  let totalResultsRequired = 0;
  let totalCompletedResults = 0;
  let totalMatchesCount = 0;
  let completedMatchesCount = 0;
  let completedGroupsCount = 0;

  for (const group of stageGroups) {
    const teams = group.teams || [];
    const matches = (group.matches || []).filter((m) => (m.round || 1) === roundNumber);

    totalMatchesCount += matches.length;

    const groupItems: StageResultItem[] = [];
    const duplicatePlacements: { matchId: string; matchNumber: number; placement: number; teams: string[] }[] = [];

    let groupRequired = 0;
    let groupCompleted = 0;
    let groupMissing = 0;
    let groupInvalid = 0;

    for (let mIdx = 0; mIdx < matches.length; mIdx++) {
      const match = matches[mIdx];
      const matchNum = match.matchNumber || mIdx + 1;
      const matchResults = Array.isArray(match.results) ? match.results : [];

      if (match.status === 'completed') {
        completedMatchesCount++;
      }

      // Check for duplicate placements within the match
      const placementOccurrences = new Map<number, string[]>();
      for (const res of matchResults) {
        if (typeof res.placement === 'number' && res.placement > 0) {
          const tName = res.teamName || res.teamId;
          const list = placementOccurrences.get(res.placement) || [];
          list.push(tName);
          placementOccurrences.set(res.placement, list);
        }
      }

      placementOccurrences.forEach((teamNames, pos) => {
        if (teamNames.length > 1) {
          duplicatePlacements.push({
            matchId: match.id,
            matchNumber: matchNum,
            placement: pos,
            teams: teamNames,
          });
        }
      });

      // Verify every registered team in the group has a result
      for (const team of teams) {
        groupRequired++;
        totalResultsRequired++;

        const resultEntry = matchResults.find(
          (r) =>
            r.teamId === team.id ||
            (r.teamName && team.name && r.teamName.trim().toLowerCase() === team.name.trim().toLowerCase())
        );

        if (!resultEntry) {
          groupMissing++;
          const missingDetail: MissingResultDetail = {
            groupId: group.id,
            groupName: group.name,
            teamId: team.id,
            teamName: team.name,
            matchId: match.id,
            matchNumber: matchNum,
            roundNumber,
            reason: `No result submitted for Match #${matchNum}`,
          };
          missingList.push(missingDetail);
          groupItems.push({
            teamId: team.id,
            teamName: team.name,
            groupId: group.id,
            groupName: group.name,
            matchId: match.id,
            matchNumber: matchNum,
            roundNumber,
            status: 'missing',
            error: missingDetail.reason,
          });
          continue;
        }

        // Validate placement and kills
        const placement = Number(resultEntry.placement);
        const kills = Number(resultEntry.kills);

        const hasValidPlacement = !isNaN(placement) && placement >= 1;
        const hasValidKills = !isNaN(kills) && kills >= 0;

        const isDuplicatePlacement = placementOccurrences.get(placement)?.length! > 1;

        if (!hasValidPlacement || !hasValidKills || isDuplicatePlacement) {
          groupInvalid++;
          let reason = '';
          if (!hasValidPlacement) reason = 'Invalid placement (must be >= 1)';
          else if (!hasValidKills) reason = 'Invalid kills count (must be >= 0)';
          else if (isDuplicatePlacement) reason = `Duplicate placement #${placement} shared with another team`;

          const invalidDetail: MissingResultDetail = {
            groupId: group.id,
            groupName: group.name,
            teamId: team.id,
            teamName: team.name,
            matchId: match.id,
            matchNumber: matchNum,
            roundNumber,
            reason,
          };
          invalidList.push(invalidDetail);
          groupItems.push({
            teamId: team.id,
            teamName: team.name,
            groupId: group.id,
            groupName: group.name,
            matchId: match.id,
            matchNumber: matchNum,
            roundNumber,
            placement: hasValidPlacement ? placement : undefined,
            kills: hasValidKills ? kills : undefined,
            status: 'invalid',
            error: reason,
          });
          continue;
        }

        // Calculate authoritative score
        const scored = calculateTeamScore({
          position: placement,
          kills,
          scoring: scoringConfig,
        });

        groupCompleted++;
        totalCompletedResults++;

        groupItems.push({
          teamId: team.id,
          teamName: team.name,
          groupId: group.id,
          groupName: group.name,
          matchId: match.id,
          matchNumber: matchNum,
          roundNumber,
          placement,
          kills,
          placementPoints: scored.placementPoints,
          killPoints: scored.killPoints,
          totalPoints: scored.totalPoints,
          status: 'complete',
        });
      }
    }

    const isGroupComplete =
      groupRequired > 0 &&
      groupCompleted === groupRequired &&
      groupMissing === 0 &&
      groupInvalid === 0 &&
      duplicatePlacements.length === 0;

    if (isGroupComplete) {
      completedGroupsCount++;
    }

    groupSummaries.push({
      groupId: group.id,
      groupName: group.name,
      roundNumber,
      totalTeams: teams.length,
      totalMatches: matches.length,
      requiredResults: groupRequired,
      completedResults: groupCompleted,
      missingResults: groupMissing,
      invalidResults: groupInvalid,
      isComplete: isGroupComplete,
      teams,
      matches,
      items: groupItems,
      duplicatePlacements,
    });
  }

  const allGroupsComplete =
    stageGroups.length > 0 && completedGroupsCount === stageGroups.length;
  const allResultsComplete =
    totalResultsRequired > 0 &&
    totalCompletedResults === totalResultsRequired &&
    missingList.length === 0 &&
    invalidList.length === 0;

  const canProcess = allGroupsComplete && allResultsComplete;

  // Determine stage status
  const existingStageStatus =
    (tournament as any).stageStatus?.[roundNumber] ||
    (tournament as any).stageStatus ||
    null;

  let stageStatus: StageProcessingStatus = 'RESULTS_INCOMPLETE';
  if (
    existingStageStatus === 'PROCESSED' ||
    (tournament.currentRound && tournament.currentRound > roundNumber)
  ) {
    stageStatus = 'PROCESSED';
  } else if (existingStageStatus === 'RESULTS_REVALIDATION_REQUIRED') {
    stageStatus = canProcess
      ? 'RESULTS_REVALIDATION_REQUIRED'
      : 'RESULTS_INCOMPLETE';
  } else if (canProcess) {
    stageStatus = 'VALIDATED';
  } else {
    stageStatus = 'RESULTS_INCOMPLETE';
  }

  let statusMessage = '';
  if (stageStatus === 'PROCESSED') {
    statusMessage = 'Stage processed. Qualification and next stage generated.';
  } else if (stageStatus === 'RESULTS_REVALIDATION_REQUIRED') {
    statusMessage = '⚠ Stage Result Changed — Revalidation required before proceeding.';
  } else if (canProcess) {
    statusMessage = 'All Results Validated ✅ — Ready to process stage.';
  } else {
    statusMessage = `Cannot process stage: ${totalResultsRequired - totalCompletedResults} result(s) missing or incomplete.`;
  }

  // Generate Qualification Preview if stage has completed matches
  let qualificationPreview: QualificationPreview | undefined;
  const tiesRequiringReview: { groupId: string; groupName: string; teamName: string; points: number }[] = [];

  if (totalCompletedResults > 0) {
    try {
      const qualRuleCount = Math.max(
        1,
        Number(currentRoundConfig?.qualificationRule || 2)
      );
      qualificationPreview = generateQualificationPreview({
        groups: stageGroups,
        tournament,
        roundNumber,
        qualificationCount: qualRuleCount,
        qualificationType:
          (currentRoundConfig as any)?.qualificationType || 'top_n_per_group',
      });

      if (qualificationPreview?.tiesRequiringReview) {
        tiesRequiringReview.push(...qualificationPreview.tiesRequiringReview);
      }
    } catch (e) {
      console.warn('[StageValidation] Qualification preview preview error:', e);
    }
  }

  return {
    roundNumber,
    stageName,
    stageStatus,
    totalGroups: stageGroups.length,
    completedGroups: completedGroupsCount,
    pendingGroups: stageGroups.length - completedGroupsCount,
    totalMatches: totalMatchesCount,
    completedMatches: completedMatchesCount,
    pendingMatches: totalMatchesCount - completedMatchesCount,
    totalResultsRequired,
    completedResults: totalCompletedResults,
    missingResultsCount: missingList.length,
    invalidResultsCount: invalidList.length,
    isValid: canProcess,
    canProcess: canProcess && stageStatus !== 'PROCESSED',
    statusMessage,
    groups: groupSummaries,
    missingList,
    invalidList,
    qualificationPreview,
    tiesRequiringReview,
    scoringConfig,
  };
}

// ─── 2. SERVER-AUTHORITATIVE RESULT UPDATE ────────────────────────────────────

/**
 * Updates a team's score in a match server-side.
 * Auto-calculates Placement Points + Kill Points = Total Points.
 * Never trusts client totals.
 */
export async function updateStageTeamResultServer(params: {
  tournamentId: string;
  roundNumber: number;
  groupId: string;
  matchId: string;
  teamId: string;
  placement: number;
  kills: number;
  actorUid: string;
  actorName: string;
  actorRole?: string;
}): Promise<{
  success: boolean;
  message: string;
  scoredResult: ScoredResult;
}> {
  const {
    tournamentId,
    roundNumber,
    groupId,
    matchId,
    teamId,
    placement,
    kills,
    actorUid,
    actorName,
    actorRole,
  } = params;

  const tournamentRef = doc(db, 'tournaments', tournamentId);
  const snap = await getDoc(tournamentRef);
  if (!snap.exists()) {
    throw new Error(`Tournament ${tournamentId} not found`);
  }

  const tournament = { id: snap.id, ...snap.data() } as Tournament;
  const scoringConfig = resolveTournamentScoringConfig(tournament);

  // Validate values
  const vPos = Math.floor(Number(placement));
  const vKills = Math.floor(Number(kills));

  if (isNaN(vPos) || vPos < 1) {
    throw new Error('Placement must be a positive number (1 or higher).');
  }
  if (isNaN(vKills) || vKills < 0) {
    throw new Error('Kills must be a non-negative number (0 or higher).');
  }

  // Calculate authoritative score
  const score = calculateTeamScore({
    position: vPos,
    kills: vKills,
    scoring: scoringConfig,
  });

  const scoredResult: ScoredResult = {
    teamId,
    teamName: '',
    placement: vPos,
    kills: vKills,
    placementPoints: score.placementPoints,
    killPoints: score.killPoints,
    totalPoints: score.totalPoints,
    scoringVersion: (tournament as any).scoringSnapshot?.scoringVersion || 1,
    updatedAt: new Date().toISOString(),
    updatedBy: actorUid,
  };

  // Update in groups
  let targetTeamName = '';
  const updatedGroups = (tournament.groups || []).map((g) => {
    if (g.id !== groupId) return g;

    const groupTeam = g.teams?.find((t) => t.id === teamId);
    if (groupTeam) {
      targetTeamName = groupTeam.name;
      scoredResult.teamName = groupTeam.name;
    }

    const updatedMatches = (g.matches || []).map((m) => {
      if (m.id !== matchId) return m;

      const existingResults = Array.isArray(m.results) ? [...m.results] : [];
      const resIdx = existingResults.findIndex((r) => r.teamId === teamId);

      if (resIdx !== -1) {
        existingResults[resIdx] = {
          ...existingResults[resIdx],
          teamName: targetTeamName || existingResults[resIdx].teamName,
          placement: vPos,
          kills: vKills,
          placementPoints: score.placementPoints,
          killPoints: score.killPoints,
          totalPoints: score.totalPoints,
          updatedAt: new Date().toISOString(),
        };
      } else {
        existingResults.push({
          teamId,
          teamName: targetTeamName || 'Team',
          placement: vPos,
          kills: vKills,
          placementPoints: score.placementPoints,
          killPoints: score.killPoints,
          totalPoints: score.totalPoints,
          updatedAt: new Date().toISOString(),
        });
      }

      // Check if all group teams now have results for this match
      const allTeamsHaveResult = (g.teams || []).every((t) =>
        existingResults.some((r) => r.teamId === t.id && r.placement > 0)
      );

      return {
        ...m,
        status: allTeamsHaveResult ? ('completed' as const) : m.status,
        results: existingResults,
      };
    });

    return { ...g, matches: updatedMatches };
  });

  const isStageProcessed =
    (tournament as any).stageStatus?.[roundNumber] === 'PROCESSED' ||
    (tournament.currentRound && tournament.currentRound > roundNumber);

  const updatePayload: Record<string, any> = {
    groups: updatedGroups,
    updatedAt: serverTimestamp(),
  };

  // If modifying a previously processed stage, trigger revalidation required
  if (isStageProcessed) {
    updatePayload[`stageStatus.${roundNumber}`] = 'RESULTS_REVALIDATION_REQUIRED';
  }

  const auditEntry = createAuditEntry({
    userId: actorUid,
    userName: actorName,
    action: 'RESULT_UPDATED',
    details: `Round ${roundNumber}, ${groupId} / Match ${matchId}: ${targetTeamName || teamId} → #${vPos} (${vKills} kills, ${score.totalPoints} pts)`,
    roundNumber,
    targetId: teamId,
  });

  updatePayload.auditLog = [
    ...(Array.isArray(tournament.auditLog) ? tournament.auditLog : []),
    auditEntry,
  ];

  await updateDoc(tournamentRef, cleanFirestoreData(updatePayload));

  return {
    success: true,
    message: `Result updated for ${targetTeamName || teamId}: Placement #${vPos}, ${vKills} kills (${score.totalPoints} pts).`,
    scoredResult,
  };
}

// ─── 3. SERVER-AUTHORITATIVE STAGE PROCESSING ─────────────────────────────────

/**
 * CORE BUSINESS RULE ENFORCEMENT:
 * An organizer MUST NOT be able to process a tournament stage until ALL required
 * results for ALL groups, teams/players, and matches in that stage have been
 * updated and validated.
 *
 * Backend independently validates the entire stage before processing.
 * Never trusts client state.
 */
export async function processTournamentStageServer(params: {
  tournamentId: string;
  roundNumber?: number;
  actorUid: string;
  actorName: string;
  actorRole?: string;
}): Promise<{
  success: boolean;
  message: string;
  nextRoundNumber?: number;
  qualifiedTeamsCount: number;
  eliminatedTeamsCount: number;
  isCompleted: boolean;
}> {
  const { tournamentId, actorUid, actorName, actorRole } = params;
  const tournamentRef = doc(db, 'tournaments', tournamentId);

  const snap = await getDoc(tournamentRef);
  if (!snap.exists()) {
    throw new Error(`Tournament ${tournamentId} does not exist`);
  }

  const tournament = { id: snap.id, ...snap.data() } as Tournament;
  const roundNumber = params.roundNumber || tournament.currentRound || 1;

  // 1. Authoritative Server-Side Validation
  const report = validateTournamentStage(tournament, roundNumber);

  if (!report.canProcess) {
    const errorDetails = report.missingList
      .slice(0, 5)
      .map((m) => `${m.groupName} → ${m.teamName} → Match #${m.matchNumber}`)
      .join('; ');

    throw new Error(
      `Cannot process stage ${roundNumber}: Missing or invalid results (${report.missingResultsCount} missing, ${report.invalidResultsCount} invalid). Details: ${errorDetails || report.statusMessage}`
    );
  }

  // 2. Prevent Duplicate Processing
  const currentStageStatus = (tournament as any).stageStatus?.[roundNumber];
  if (currentStageStatus === 'PROCESSED') {
    throw new Error(`Stage ${roundNumber} has already been processed.`);
  }

  // 3. Calculate Standings & Qualification
  const currentRoundIdx = roundNumber - 1;
  const currentRoundConfig = tournament.roadmap?.[currentRoundIdx];
  const nextRoundConfig = tournament.roadmap?.[currentRoundIdx + 1];

  const qualRule = Math.max(1, Number(currentRoundConfig?.qualificationRule || 2));
  const qualType = (currentRoundConfig as any)?.qualificationType || 'top_n_per_group';

  const preview = generateQualificationPreview({
    groups: getGroupsForRound(tournament.groups, roundNumber),
    tournament,
    roundNumber,
    qualificationCount: qualRule,
    qualificationType: qualType,
  });

  const qualifiers = getQualifiedTeams(preview);
  if (qualifiers.length < 2) {
    throw new Error(
      `Cannot process stage: Only ${qualifiers.length} teams qualified. A minimum of 2 qualified teams is required to proceed.`
    );
  }

  // 4. Determine Next Stage or Finalization
  let nextRoundNumber: number | undefined;
  let isCompleted = false;
  let updatedGroups = [...(tournament.groups || [])];
  let updatePayload: Record<string, any> = {};

  if (nextRoundConfig) {
    nextRoundNumber = nextRoundConfig.roundNumber;

    // Build qualifiersByGroup for cross-group distribution
    const qualifiersByGroup = preview.groups.map((g) => ({
      groupName: g.groupName,
      teams: g.standings
        .filter((s) => s.qualificationStatus === 'qualified')
        .map((s) => ({ id: s.teamId, name: s.teamName, logoUrl: s.logoUrl } as Team)),
    }));

    const nextRound = createNextRound({
      qualifiedTeams: qualifiers,
      qualifiersByGroup,
      nextRoundConfig: nextRoundConfig as any,
      tournament,
    });

    // Tag next round groups explicitly with roundNumber
    const taggedNextGroups = nextRound.groups.map((g) => ({
      ...g,
      roundNumber: nextRound.roundNumber,
    }));

    updatedGroups = [...updatedGroups, ...taggedNextGroups];

    updatePayload = {
      groups: updatedGroups,
      currentRound: nextRound.roundNumber,
      stage: 'group_stage',
      [`stageStatus.${roundNumber}`]: 'PROCESSED',
      [`stageStatus.${nextRound.roundNumber}`]: 'RESULTS_INCOMPLETE',
      updatedAt: serverTimestamp(),
    };
  } else {
    // Last stage in roadmap: Generate final knockout or finalize tournament
    isCompleted = true;
    updatePayload = {
      stage: 'completed',
      [`stageStatus.${roundNumber}`]: 'PROCESSED',
      updatedAt: serverTimestamp(),
    };
  }

  // 5. Create Immutable Audit Log
  const auditEntry = createAuditEntry({
    userId: actorUid,
    userName: actorName,
    action: 'STAGE_PROCESSED',
    details: `Round ${roundNumber} processed: ${qualifiers.length} qualified, ${preview.totalEliminated} eliminated. ${nextRoundNumber ? `Advanced to Round ${nextRoundNumber}` : 'Final stage completed.'}`,
    roundNumber,
  });

  updatePayload.auditLog = [
    ...(Array.isArray(tournament.auditLog) ? tournament.auditLog : []),
    auditEntry,
  ];

  await updateDoc(tournamentRef, cleanFirestoreData(updatePayload));

  return {
    success: true,
    message: nextRoundNumber
      ? `Stage ${roundNumber} processed! Advanced to Round ${nextRoundNumber} with ${qualifiers.length} qualified teams.`
      : `Final stage processed! ${qualifiers.length} teams qualified.`,
    nextRoundNumber,
    qualifiedTeamsCount: qualifiers.length,
    eliminatedTeamsCount: preview.totalEliminated,
    isCompleted,
  };
}

// ─── 4. REQUEST RESULT CORRECTION ─────────────────────────────────────────────

/**
 * Flags a processed stage for result correction.
 * Transitions stage status to RESULTS_REVALIDATION_REQUIRED.
 */
export async function requestStageCorrection(params: {
  tournamentId: string;
  roundNumber: number;
  matchId?: string;
  teamId?: string;
  reason: string;
  actorUid: string;
  actorName: string;
}): Promise<{ success: boolean; message: string }> {
  const { tournamentId, roundNumber, matchId, teamId, reason, actorUid, actorName } = params;
  const tournamentRef = doc(db, 'tournaments', tournamentId);

  const snap = await getDoc(tournamentRef);
  if (!snap.exists()) throw new Error('Tournament not found');

  const tournament = snap.data() as Tournament;

  const correctionEntry = {
    id: `corr_${Date.now()}`,
    roundNumber,
    matchId: matchId || null,
    teamId: teamId || null,
    reason,
    requestedBy: actorUid,
    requestedByName: actorName,
    requestedAt: new Date().toISOString(),
    status: 'pending',
  };

  const auditEntry = createAuditEntry({
    userId: actorUid,
    userName: actorName,
    action: 'CORRECTION_REQUESTED',
    details: `Round ${roundNumber}: Correction requested — "${reason}"`,
    roundNumber,
  });

  const updatePayload = {
    [`stageStatus.${roundNumber}`]: 'RESULTS_REVALIDATION_REQUIRED',
    correctionRequests: [
      ...(Array.isArray((tournament as any).correctionRequests)
        ? (tournament as any).correctionRequests
        : []),
      correctionEntry,
    ],
    auditLog: [
      ...(Array.isArray(tournament.auditLog) ? tournament.auditLog : []),
      auditEntry,
    ],
    updatedAt: serverTimestamp(),
  };

  await updateDoc(tournamentRef, cleanFirestoreData(updatePayload));

  return {
    success: true,
    message: 'Correction request submitted. Stage status set to RESULTS_REVALIDATION_REQUIRED.',
  };
}
