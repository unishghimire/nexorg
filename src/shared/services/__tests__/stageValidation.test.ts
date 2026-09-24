/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * TEST SUITE: TOURNAMENT STAGE RESULT VALIDATION & PROCESSING RULES
 * ═══════════════════════════════════════════════════════════════════════════════
 * Validates all 15 critical core business rules specified in the requirements.
 */

import {
  validateTournamentStage,
  resolveTournamentScoringConfig,
  getGroupsForRound,
} from '../tournamentStageValidationService.ts';
import { Tournament, TournamentGroup, Match, Team } from '../../types/types.ts';

function createMockTeam(id: string, name: string): Team {
  return { id, name };
}

function createMockGroup(
  id: string,
  name: string,
  roundNumber: number,
  teams: Team[],
  matchesCount: number = 1
): TournamentGroup {
  const matches: Match[] = [];
  for (let m = 1; m <= matchesCount; m++) {
    matches.push({
      id: `${id}_m${m}`,
      round: roundNumber,
      matchNumber: m,
      status: 'scheduled',
      results: [],
    });
  }

  return {
    id,
    name,
    roundNumber,
    teams,
    matches,
  };
}

function runTests() {
  console.log('🧪 Starting Tournament Stage Result Validation Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}${detail ? ` - ${detail}` : ''}`);
      failed++;
    }
  }

  // Common Teams
  const teamsA = [createMockTeam('t1', 'Team Alpha'), createMockTeam('t2', 'Team Bravo')];
  const teamsB = [createMockTeam('t3', 'Team Charlie'), createMockTeam('t4', 'Team Delta')];

  // ─── TEST 1: All groups complete → Process Stage works ─────────────────────
  {
    const groupA = createMockGroup('gA', 'Group A', 1, teamsA, 1);
    groupA.matches[0].results = [
      { teamId: 't1', teamName: 'Team Alpha', placement: 1, kills: 5, totalPoints: 17 },
      { teamId: 't2', teamName: 'Team Bravo', placement: 2, kills: 2, totalPoints: 11 },
    ];
    groupA.matches[0].status = 'completed';

    const groupB = createMockGroup('gB', 'Group B', 1, teamsB, 1);
    groupB.matches[0].results = [
      { teamId: 't3', teamName: 'Team Charlie', placement: 1, kills: 4, totalPoints: 16 },
      { teamId: 't4', teamName: 'Team Delta', placement: 2, kills: 1, totalPoints: 10 },
    ];
    groupB.matches[0].status = 'completed';

    const tournament: Tournament = {
      id: 'tour_1',
      title: 'NexPlay Championship',
      game: 'Free Fire',
      stage: 'group_stage',
      status: 'live',
      currentRound: 1,
      groups: [groupA, groupB],
      roadmap: [
        { roundNumber: 1, stageName: 'Group Stage', numGroups: 2, qualificationRule: 1, maps: ['Bermuda'] },
        { roundNumber: 2, stageName: 'Grand Finals', numGroups: 1, qualificationRule: 1, maps: ['Purgatory'] },
      ],
    } as any;

    const report = validateTournamentStage(tournament, 1);
    assert(report.canProcess === true, '1. All groups complete → Stage ready to process');
    assert(report.missingResultsCount === 0, '1b. No missing results');
    assert(report.stageStatus === 'VALIDATED', '1c. Status is VALIDATED');
  }

  // ─── TEST 2: One group incomplete → Process blocked ────────────────────────
  {
    const groupA = createMockGroup('gA', 'Group A', 1, teamsA, 1);
    groupA.matches[0].results = [
      { teamId: 't1', teamName: 'Team Alpha', placement: 1, kills: 5, totalPoints: 17 },
      { teamId: 't2', teamName: 'Team Bravo', placement: 2, kills: 2, totalPoints: 11 },
    ];

    const groupB = createMockGroup('gB', 'Group B', 1, teamsB, 1);
    // Group B has 0 results!

    const tournament: Tournament = {
      id: 'tour_2',
      stage: 'group_stage',
      status: 'live',
      currentRound: 1,
      groups: [groupA, groupB],
    } as any;

    const report = validateTournamentStage(tournament, 1);
    assert(report.canProcess === false, '2. One group incomplete → Process blocked');
    assert(report.pendingGroups === 1, '2b. Pending groups count is 1');
  }

  // ─── TEST 3: One team missing result → Process blocked ─────────────────────
  {
    const groupA = createMockGroup('gA', 'Group A', 1, teamsA, 1);
    // Only Team Alpha has result, Team Bravo is missing!
    groupA.matches[0].results = [
      { teamId: 't1', teamName: 'Team Alpha', placement: 1, kills: 5, totalPoints: 17 },
    ];

    const tournament: Tournament = {
      id: 'tour_3',
      stage: 'group_stage',
      status: 'live',
      currentRound: 1,
      groups: [groupA],
    } as any;

    const report = validateTournamentStage(tournament, 1);
    assert(report.canProcess === false, '3. One team missing result → Process blocked');
    assert(report.missingResultsCount === 1, '3b. Exactly 1 missing result reported');
    assert(report.missingList[0].teamName === 'Team Bravo', '3c. Missing list identifies Team Bravo');
  }

  // ─── TEST 4: One player/team missing in 2nd match → Process blocked ─────────
  {
    const groupA = createMockGroup('gA', 'Group A', 1, teamsA, 2); // 2 matches
    // Match 1 has both teams
    groupA.matches[0].results = [
      { teamId: 't1', teamName: 'Team Alpha', placement: 1, kills: 5, totalPoints: 17 },
      { teamId: 't2', teamName: 'Team Bravo', placement: 2, kills: 2, totalPoints: 11 },
    ];
    // Match 2 has only Team Alpha
    groupA.matches[1].results = [
      { teamId: 't1', teamName: 'Team Alpha', placement: 1, kills: 4, totalPoints: 16 },
    ];

    const tournament: Tournament = {
      id: 'tour_4',
      stage: 'group_stage',
      status: 'live',
      currentRound: 1,
      groups: [groupA],
    } as any;

    const report = validateTournamentStage(tournament, 1);
    assert(report.canProcess === false, '4. Match 2 missing Team Bravo → Process blocked');
    assert(report.missingList[0].matchNumber === 2, '4b. Correctly flags Match #2');
  }

  // ─── TEST 5: One match incomplete → Process blocked ────────────────────────
  {
    const groupA = createMockGroup('gA', 'Group A', 1, teamsA, 2);
    // Match 1 is filled
    groupA.matches[0].results = [
      { teamId: 't1', teamName: 'Team Alpha', placement: 1, kills: 5, totalPoints: 17 },
      { teamId: 't2', teamName: 'Team Bravo', placement: 2, kills: 2, totalPoints: 11 },
    ];
    // Match 2 is completely empty

    const tournament: Tournament = {
      id: 'tour_5',
      stage: 'group_stage',
      status: 'live',
      currentRound: 1,
      groups: [groupA],
    } as any;

    const report = validateTournamentStage(tournament, 1);
    assert(report.canProcess === false, '5. Match 2 completely empty → Process blocked');
    assert(report.missingResultsCount === 2, '5b. 2 missing results for Match #2');
  }

  // ─── TEST 6: Invalid result (Placement = 0 or negative kills) → Blocked ─────
  {
    const groupA = createMockGroup('gA', 'Group A', 1, teamsA, 1);
    groupA.matches[0].results = [
      { teamId: 't1', teamName: 'Team Alpha', placement: 0, kills: 5, totalPoints: 5 }, // Invalid placement!
      { teamId: 't2', teamName: 'Team Bravo', placement: 2, kills: -1, totalPoints: 8 }, // Invalid negative kills!
    ];

    const tournament: Tournament = {
      id: 'tour_6',
      stage: 'group_stage',
      status: 'live',
      currentRound: 1,
      groups: [groupA],
    } as any;

    const report = validateTournamentStage(tournament, 1);
    assert(report.canProcess === false, '6. Invalid placement & negative kills → Process blocked');
    assert(report.invalidResultsCount === 2, '6b. Invalid results count is 2');
  }

  // ─── TEST 7: Duplicate placement shared in match → Blocked ─────────────────
  {
    const groupA = createMockGroup('gA', 'Group A', 1, teamsA, 1);
    groupA.matches[0].results = [
      { teamId: 't1', teamName: 'Team Alpha', placement: 1, kills: 5, totalPoints: 17 },
      { teamId: 't2', teamName: 'Team Bravo', placement: 1, kills: 2, totalPoints: 14 }, // Duplicate placement #1!
    ];

    const tournament: Tournament = {
      id: 'tour_7',
      stage: 'group_stage',
      status: 'live',
      currentRound: 1,
      groups: [groupA],
    } as any;

    const report = validateTournamentStage(tournament, 1);
    assert(report.canProcess === false, '7. Duplicate placement rank #1 → Process blocked');
    assert(report.groups[0].duplicatePlacements.length > 0, '7b. Duplicate placement detected in group');
  }

  // ─── TEST 8: Wrong team ID / non-registered team → Blocked ─────────────────
  {
    const groupA = createMockGroup('gA', 'Group A', 1, teamsA, 1);
    groupA.matches[0].results = [
      { teamId: 't1', teamName: 'Team Alpha', placement: 1, kills: 5, totalPoints: 17 },
      { teamId: 't999_wrong', teamName: 'Impostor Team', placement: 2, kills: 1, totalPoints: 10 },
    ];

    const tournament: Tournament = {
      id: 'tour_8',
      stage: 'group_stage',
      status: 'live',
      currentRound: 1,
      groups: [groupA],
    } as any;

    const report = validateTournamentStage(tournament, 1);
    assert(report.canProcess === false, '8. Team Bravo has no result (wrong team in match) → Process blocked');
    assert(report.missingList.some((m) => m.teamId === 't2'), '8b. Team Bravo flagged as missing');
  }

  // ─── TEST 9: All results validated → Qualification preview generated ───────
  {
    const groupA = createMockGroup('gA', 'Group A', 1, teamsA, 1);
    groupA.matches[0].results = [
      { teamId: 't1', teamName: 'Team Alpha', placement: 1, kills: 5, totalPoints: 17 },
      { teamId: 't2', teamName: 'Team Bravo', placement: 2, kills: 1, totalPoints: 10 },
    ];

    const tournament: Tournament = {
      id: 'tour_9',
      stage: 'group_stage',
      status: 'live',
      currentRound: 1,
      groups: [groupA],
      roadmap: [
        { roundNumber: 1, stageName: 'Round 1', numGroups: 1, qualificationRule: 1, maps: ['Bermuda'] },
        { roundNumber: 2, stageName: 'Round 2', numGroups: 1, qualificationRule: 1, maps: ['Purgatory'] },
      ],
    } as any;

    const report = validateTournamentStage(tournament, 1);
    assert(report.qualificationPreview !== undefined, '9. Qualification preview exists');
    assert(report.qualificationPreview?.totalQualified === 1, '9b. Exactly 1 team qualifies per rule');
  }

  // ─── TEST 10: Stage already processed → Cannot process again ───────────────
  {
    const groupA = createMockGroup('gA', 'Group A', 1, teamsA, 1);
    groupA.matches[0].results = [
      { teamId: 't1', teamName: 'Team Alpha', placement: 1, kills: 5, totalPoints: 17 },
      { teamId: 't2', teamName: 'Team Bravo', placement: 2, kills: 1, totalPoints: 10 },
    ];

    const tournament: Tournament = {
      id: 'tour_10',
      stage: 'group_stage',
      status: 'live',
      currentRound: 2, // Already advanced to Round 2!
      stageStatus: { '1': 'PROCESSED' },
      groups: [groupA],
    } as any;

    const report = validateTournamentStage(tournament, 1);
    assert(report.stageStatus === 'PROCESSED', '10. Stage status is PROCESSED');
    assert(report.canProcess === false, '10b. Cannot process already processed stage');
  }

  // ─── TEST 11: Result corrected after processing → Revalidation required ────
  {
    const groupA = createMockGroup('gA', 'Group A', 1, teamsA, 1);
    groupA.matches[0].results = [
      { teamId: 't1', teamName: 'Team Alpha', placement: 1, kills: 5, totalPoints: 17 },
      { teamId: 't2', teamName: 'Team Bravo', placement: 2, kills: 1, totalPoints: 10 },
    ];

    const tournament: Tournament = {
      id: 'tour_11',
      stage: 'group_stage',
      status: 'live',
      currentRound: 1,
      stageStatus: { '1': 'RESULTS_REVALIDATION_REQUIRED' },
      groups: [groupA],
    } as any;

    const report = validateTournamentStage(tournament, 1);
    assert(
      report.stageStatus === 'RESULTS_REVALIDATION_REQUIRED',
      '11. Correctly flags RESULTS_REVALIDATION_REQUIRED'
    );
  }

  // ─── TEST 12: Scoring calculations are server-side authoritative ───────────
  {
    const config = resolveTournamentScoringConfig({
      scoringSnapshot: {
        killPoints: 2,
        placementPoints: { '1': 15, '2': 10 },
        scoringVersion: 1,
      },
    } as any);

    assert(config.killPoints === 2, '12. Resolves frozen snapshot kill points = 2');
    assert(config.placementPoints['1'] === 15, '12b. Resolves frozen placement points #1 = 15');
  }

  // ─── TEST 13: Client attempts to pass allResultsComplete: true bypassed ────
  {
    const groupA = createMockGroup('gA', 'Group A', 1, teamsA, 1);
    // Empty results but malicious client sets allResultsComplete: true
    const tournament: any = {
      id: 'tour_13',
      stage: 'group_stage',
      status: 'live',
      currentRound: 1,
      allResultsComplete: true, // Spoofed client property!
      groups: [groupA],
    };

    const report = validateTournamentStage(tournament, 1);
    assert(report.canProcess === false, '13. Spoofed allResultsComplete: true is ignored');
    assert(report.missingResultsCount === 2, '13b. Missing results detected regardless of client flag');
  }

  // ─── TEST 14: Multiple groups → All groups must complete ───────────────────
  {
    const groupA = createMockGroup('gA', 'Group A', 1, teamsA, 1);
    groupA.matches[0].results = [
      { teamId: 't1', teamName: 'Team Alpha', placement: 1, kills: 5, totalPoints: 17 },
      { teamId: 't2', teamName: 'Team Bravo', placement: 2, kills: 2, totalPoints: 11 },
    ];

    const groupB = createMockGroup('gB', 'Group B', 1, teamsB, 1);
    groupB.matches[0].results = [
      { teamId: 't3', teamName: 'Team Charlie', placement: 1, kills: 4, totalPoints: 16 },
      { teamId: 't4', teamName: 'Team Delta', placement: 2, kills: 1, totalPoints: 10 },
    ];

    const teamsC = [createMockTeam('t5', 'Team Echo'), createMockTeam('t6', 'Team Foxtrot')];
    const groupC = createMockGroup('gC', 'Group C', 1, teamsC, 1);
    // Group C is incomplete!
    groupC.matches[0].results = [
      { teamId: 't5', teamName: 'Team Echo', placement: 1, kills: 2, totalPoints: 14 },
    ];

    const tournament: Tournament = {
      id: 'tour_14',
      stage: 'group_stage',
      status: 'live',
      currentRound: 1,
      groups: [groupA, groupB, groupC],
    } as any;

    const report = validateTournamentStage(tournament, 1);
    assert(report.canProcess === false, '14. 2/3 groups complete → Stage remains blocked');
    assert(report.completedGroups === 2, '14b. Completed groups is 2');
    assert(report.totalGroups === 3, '14c. Total groups is 3');
  }

  // ─── TEST 15: Multiple tournament stages → Each stage independently validated
  {
    const groupR1 = createMockGroup('g1', 'Round 1 Group', 1, teamsA, 1);
    groupR1.matches[0].results = [
      { teamId: 't1', teamName: 'Team Alpha', placement: 1, kills: 5, totalPoints: 17 },
      { teamId: 't2', teamName: 'Team Bravo', placement: 2, kills: 2, totalPoints: 11 },
    ];

    const groupR2 = createMockGroup('g2', 'Round 2 Group', 2, teamsA, 1);
    // Round 2 is incomplete!

    const tournament: Tournament = {
      id: 'tour_15',
      stage: 'group_stage',
      status: 'live',
      currentRound: 1,
      groups: [groupR1, groupR2],
    } as any;

    const reportR1 = validateTournamentStage(tournament, 1);
    const reportR2 = validateTournamentStage(tournament, 2);

    assert(reportR1.canProcess === true, '15. Round 1 is validated independently (can process)');
    assert(reportR2.canProcess === false, '15b. Round 2 is incomplete independently (cannot process)');

    // When advanced to Round 2, Round 1 becomes PROCESSED and cannot be re-processed
    const advancedTournament = { ...tournament, currentRound: 2 };
    const reportR1Advanced = validateTournamentStage(advancedTournament as any, 1);
    assert(reportR1Advanced.stageStatus === 'PROCESSED', '15c. Round 1 marked PROCESSED when tournament is on Round 2');
    assert(reportR1Advanced.canProcess === false, '15d. Round 1 cannot be processed again once advanced');
  }

  console.log(`\n📊 TEST SUMMARY: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
