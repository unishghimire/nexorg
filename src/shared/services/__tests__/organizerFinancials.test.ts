/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * TEST SUITE: ORGANIZER FINANCIALS, LOCK AMOUNT & DASHBOARD METRICS ENGINE
 * ═══════════════════════════════════════════════════════════════════════════════
 * Authoritatively validates:
 * 1. Paid Tournament Lock Amount calculation & start blocking on shortfall
 * 2. Paid Scrim Lock Amount calculation & slot requirement validation
 * 3. Free Tournament & Scrim security deposit lock amount enforcement (Rs. 200)
 * 4. Lock Status transitions (LOCK_PENDING -> FULLY_COLLECTED -> LOCKED -> RELEASED/REFUNDED)
 * 5. Single Source of Truth Main Wallet derivation
 * 6. 8-Metric Event Overview calculations across tournaments & scrims
 * 7. 5-Metric Financial Overview calculations
 * 8. Actionable Event Alert generation (incomplete lock, 48h deadline, disputes)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import {
  getEventLockDetails,
  computeOrganizerEventOverview,
  computeOrganizerFinancialOverview,
  computeOrganizerAlerts,
} from '../organizerFinancialsService.ts';
import { Tournament, Transaction } from '../../types/types.ts';
import { DEFAULT_FREE_LOCK_AMOUNT } from '../eventSettlementService.ts';

function runTests() {
  console.log('🧪 Starting Organizer Financials & Lock Amount Test Suite...\n');
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

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. PAID TOURNAMENTS: LOCK AMOUNT & CAN START VALIDATION
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- Category 1: Paid Tournament Lock Amount & Start Invariants ---');

  const paidTournamentUnderfunded = {
    id: 'pt_1',
    title: 'Pro Championship 2026',
    entryFee: 100,
    prizePool: 1200,
    totalSlots: 12,
    filledSlots: 6, // 6 * 100 = 600 collected; 1200 required; 600 shortfall
    status: 'upcoming',
  };

  const lockUnderfunded = getEventLockDetails(paidTournamentUnderfunded);
  assert(lockUnderfunded.isPaid === true, 'Identifies as paid event');
  assert(lockUnderfunded.requiredLockAmount === 1200, 'Requires full prize pool liability (Rs. 1200)');
  assert(lockUnderfunded.collectedAmount === 600, 'Calculates 6 filled slots * Rs. 100 = Rs. 600');
  assert(lockUnderfunded.remainingAmount === 600, 'Calculates Rs. 600 remaining shortfall');
  assert(lockUnderfunded.collectionPercentage === 50, 'Collection percentage is 50%');
  assert(lockUnderfunded.canStart === false, 'CORE RULE: Event CANNOT start when collected < required');
  assert(
    typeof lockUnderfunded.cannotStartReason === 'string' &&
      lockUnderfunded.cannotStartReason.includes('6 more registered slots'),
    'Detailed cannotStartReason explains exact shortfall and slot count'
  );
  assert(lockUnderfunded.status === 'PARTIALLY_COLLECTED', 'Status is PARTIALLY_COLLECTED');

  const paidTournamentFullyFunded = {
    id: 'pt_2',
    title: 'Elite Squad Battle',
    entryFee: 100,
    prizePool: 1200,
    totalSlots: 12,
    filledSlots: 12, // 12 * 100 = 1200 collected; 1200 required
    status: 'open',
  };

  const lockFullyFunded = getEventLockDetails(paidTournamentFullyFunded);
  assert(lockFullyFunded.collectedAmount === 1200, 'Calculates Rs. 1200 collected');
  assert(lockFullyFunded.remainingAmount === 0, 'Remaining shortfall is 0');
  assert(lockFullyFunded.collectionPercentage === 100, 'Collection percentage is 100%');
  assert(lockFullyFunded.canStart === true, 'Event CAN start when collected >= required');
  assert(lockFullyFunded.status === 'FULLY_COLLECTED', 'Status is FULLY_COLLECTED');

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. FREE TOURNAMENTS & SCRIMS: SECURITY DEPOSIT LOCK ENFORCEMENT
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- Category 2: Free Event Security Deposit Lock Invariants ---');

  const freeScrimNoDeposit = {
    id: 'fs_1',
    title: 'Free Community Scrim',
    entryFee: 0,
    prizePool: 500,
    totalSlots: 12,
    filledSlots: 12,
    status: 'open',
    isScrim: true,
  };

  const lockFreeNoDeposit = getEventLockDetails(freeScrimNoDeposit);
  assert(lockFreeNoDeposit.isFree === true, 'Identifies as free event');
  assert(
    lockFreeNoDeposit.requiredLockAmount === DEFAULT_FREE_LOCK_AMOUNT,
    `Requires default platform security deposit (Rs. ${DEFAULT_FREE_LOCK_AMOUNT})`
  );
  assert(lockFreeNoDeposit.collectedAmount === 0, 'Collected is 0 before host security deposit');
  assert(lockFreeNoDeposit.canStart === false, 'Free event CANNOT start without security deposit');
  assert(
    typeof lockFreeNoDeposit.cannotStartReason === 'string' &&
      lockFreeNoDeposit.cannotStartReason.includes('deposit Rs. 200 security lock amount'),
    'Detailed reason guides organizer to deposit security lock amount'
  );
  assert(lockFreeNoDeposit.status === 'LOCK_PENDING', 'Status is LOCK_PENDING');

  const freeScrimWithDeposit = {
    id: 'fs_2',
    title: 'Free Verified Scrim',
    entryFee: 0,
    prizePool: 500,
    totalSlots: 12,
    filledSlots: 10,
    lockAmountDeposited: true,
    lockAmount: 200,
    status: 'open',
    isScrim: true,
  };

  const lockFreeDeposited = getEventLockDetails(freeScrimWithDeposit);
  assert(lockFreeDeposited.collectedAmount === 200, 'Collected amount reflects deposited security lock');
  assert(lockFreeDeposited.canStart === true, 'Free event CAN start once security lock is deposited');
  assert(lockFreeDeposited.status === 'FULLY_COLLECTED', 'Status is FULLY_COLLECTED');

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. LOCK STATUS TRANSITIONS (LIVE, COMPLETED, RELEASED, REFUNDED)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- Category 3: Lifecycle Lock Status State Machine ---');

  const liveEvent = {
    id: 'live_1',
    title: 'Live Scrim',
    entryFee: 50,
    prizePool: 600,
    totalSlots: 12,
    filledSlots: 12,
    status: 'live',
  };
  assert(getEventLockDetails(liveEvent).status === 'LOCKED', 'Active live event status is LOCKED');

  const completedSettledEvent = {
    id: 'settled_1',
    title: 'Settled Tournament',
    entryFee: 100,
    prizePool: 1000,
    filledSlots: 12,
    status: 'completed',
    settlementStatus: 'settled',
    payoutCompleted: true,
  };
  assert(
    getEventLockDetails(completedSettledEvent).status === 'RELEASED',
    'Settled completed event status is RELEASED'
  );

  const cancelledRefundedEvent = {
    id: 'cancelled_1',
    title: 'Cancelled Match',
    entryFee: 100,
    prizePool: 1000,
    filledSlots: 10,
    status: 'cancelled',
  };
  assert(
    getEventLockDetails(cancelledRefundedEvent).status === 'REFUNDED',
    'Cancelled event status is REFUNDED'
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. ORGANIZER EVENT OVERVIEW (8 METRICS)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- Category 4: 8-Metric Organizer Event Overview ---');

  const sampleTournaments: any[] = [
    { id: 't1', status: 'live' },
    { id: 't2', status: 'upcoming' },
    { id: 't3', status: 'draft' },
    { id: 't4', status: 'completed' },
  ];

  const sampleScrims: any[] = [
    { id: 's1', status: 'live' },
    { id: 's2', status: 'live' },
    { id: 's3', status: 'upcoming' },
    { id: 's4', status: 'completed' },
    { id: 's5', status: 'finalized' },
  ];

  const eventOverview = computeOrganizerEventOverview({
    tournaments: sampleTournaments,
    scrims: sampleScrims,
  });

  assert(eventOverview.totalTournaments === 4, 'Tournaments total count is 4');
  assert(eventOverview.activeTournaments === 1, 'Tournaments active count is 1');
  assert(eventOverview.upcomingTournaments === 2, 'Tournaments upcoming count is 2');
  assert(eventOverview.completedTournaments === 1, 'Tournaments completed count is 1');

  assert(eventOverview.totalScrims === 5, 'Scrims total count is 5');
  assert(eventOverview.activeScrims === 2, 'Scrims active count is 2');
  assert(eventOverview.upcomingScrims === 1, 'Scrims upcoming count is 1');
  assert(eventOverview.completedScrims === 2, 'Scrims completed count is 2 (completed + finalized)');

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. ORGANIZER FINANCIAL OVERVIEW (5 SINGLE-SOURCE-OF-TRUTH METRICS)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- Category 5: Financial Overview Derived From Main Wallet ---');

  const profile = {
    uid: 'host_1',
    balance: 5400, // Main Wallet Balance
  };

  const sampleTransactions: any[] = [
    { id: 'tx1', type: 'commission_payout', amount: 850, status: 'completed' },
    { id: 'tx2', type: 'org_share', amount: 425, status: 'pending' },
    { id: 'tx3', type: 'fine_penalty', amount: 200, status: 'completed', createdAt: new Date() },
  ];

  const financialOverview = computeOrganizerFinancialOverview({
    tournaments: [
      { id: 't1', entryFee: 100, prizePool: 1000, totalSlots: 10, filledSlots: 10, status: 'live' },
    ] as any[],
    scrims: [
      {
        id: 's1',
        entryFee: 50,
        prizePool: 400,
        totalSlots: 12,
        filledSlots: 10,
        status: 'completed',
        settlementStatus: 'pending',
      }, // 10 * 50 = 500 gross; 500 - 400 = 100 profit; 85% = 85 upcoming settlement
    ],
    transactions: sampleTransactions as any[],
    profile,
  });

  assert(
    financialOverview.mainWalletBalance === 5400,
    'Main Wallet balance matches user profile.balance (Single Source of Truth)'
  );
  assert(
    financialOverview.totalLockedAmount === 1500,
    'Calculates Rs. 1500 total locked (Rs. 1000 tournament + Rs. 500 collected entry fees in completed scrim)'
  );
  assert(
    financialOverview.tournamentLocks === 1000,
    'Calculates Rs. 1000 locked in active live tournament'
  );
  assert(
    financialOverview.scrimLocks === 500,
    'Calculates Rs. 500 locked in completed scrim awaiting settlement'
  );
  assert(
    financialOverview.releasedCommission === 850,
    'Calculates released commission of Rs. 850'
  );
  assert(
    financialOverview.pendingCommission === 425,
    'Calculates pending commission of Rs. 425'
  );
  assert(
    financialOverview.upcomingSettlement === 85,
    'Calculates 85% host profit upcoming settlement (Rs. 85)'
  );
  assert(
    financialOverview.fineAmountToday === 200,
    'Calculates today fine amount of Rs. 200'
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. ACTIONABLE EVENT ALERTS (INCOMPLETE LOCK, 48H DEADLINE, DISPUTES)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- Category 6: Actionable Event Alerts Generation ---');

  const alerts = computeOrganizerAlerts({
    tournaments: [
      {
        id: 't_need_lock',
        title: 'Needs Funding Cup',
        entryFee: 100,
        prizePool: 1200,
        totalSlots: 12,
        filledSlots: 4,
        status: 'upcoming',
      } as any,
    ],
    scrims: [
      {
        id: 's_overdue',
        title: 'Overdue Result Scrim',
        entryFee: 50,
        prizePool: 500,
        filledSlots: 10,
        status: 'completed',
        completedAt: new Date(Date.now() - 50 * 3600 * 1000), // 50 hours ago (> 48h)
        resultStatus: 'draft',
      },
    ],
    disputes: [
      { id: 'disp_1', status: 'pending' },
      { id: 'disp_2', status: 'pending' },
    ],
  });

  const lockAlert = alerts.find((a) => a.type === 'LOCK_INCOMPLETE');
  assert(Boolean(lockAlert), 'Generates LOCK_INCOMPLETE alert for underfunded upcoming tournament');
  assert(lockAlert?.targetTab === 'locks', 'Routes lock alert to tab=locks');

  const deadlineAlert = alerts.find((a) => a.type === 'DEADLINE_OVERDUE');
  assert(Boolean(deadlineAlert), 'Generates DEADLINE_OVERDUE alert for completed event past 48 hours');
  assert(deadlineAlert?.targetTab === 'results', 'Routes deadline alert to tab=results');

  const disputeAlert = alerts.find((a) => a.type === 'DISPUTE_PENDING');
  assert(Boolean(disputeAlert), 'Generates DISPUTE_PENDING alert when unresolved disputes exist');
  assert(disputeAlert?.targetTab === 'disputes', 'Routes dispute alert to tab=disputes');

  // ─── FINAL SUMMARY ────────────────────────────────────────────────────────────
  console.log(`\n═════════════════════════════════════════════════════════════════`);
  console.log(`TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log(`═════════════════════════════════════════════════════════════════\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
