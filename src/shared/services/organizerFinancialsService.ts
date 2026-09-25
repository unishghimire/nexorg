/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * NEXPLAY ORGANIZER FINANCIALS, LOCK AMOUNT & EVENT START VALIDATION ENGINE
 * ═══════════════════════════════════════════════════════════════════════════════
 * Authoritative Server-Side Logic for:
 * 1. Deriving financial information strictly from Main Wallet & Event Transactions
 * 2. Pure Lock Amount calculation (Required, Collected, Remaining, %, Status)
 * 3. Enforcing CORE BUSINESS RULE: Event CANNOT start until full Lock Amount is collected
 * 4. Multi-Event Overview & Alert calculations for Organizer Dashboard
 * 5. Traceable Settlement and Commission state derivation
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Tournament, Transaction } from '../types/types';
import {
  DEFAULT_FREE_LOCK_AMOUNT,
  getResultDeadlineRemaining,
  DeadlineRemaining,
} from './eventSettlementService';
import { countFilledScrimSlots, getSlotCount } from '../utils/scrimSlots';
import { cleanFirestoreData, toDateSafe } from '../utils/utils';

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type EventLockStatus =
  | 'LOCK_PENDING'
  | 'PARTIALLY_COLLECTED'
  | 'FULLY_COLLECTED'
  | 'LOCKED'
  | 'RELEASED'
  | 'REFUNDED';

export type EventSettlementStepStatus =
  | 'PENDING'
  | 'ELIGIBLE'
  | 'PROCESSING'
  | 'SETTLED'
  | 'FAILED'
  | 'REVERSED';

export interface EventLockDetails {
  eventId: string;
  eventName: string;
  eventType: 'tournament' | 'scrim';
  isPaid: boolean;
  isFree: boolean;
  entryFee: number;
  prizePool: number;
  totalSlots: number;
  filledSlots: number;
  requiredLockAmount: number;
  collectedAmount: number;
  remainingAmount: number;
  collectionPercentage: number;
  status: EventLockStatus;
  canStart: boolean;
  cannotStartReason?: string;
  eventStatus: string;
  startDate: string | null;
  lockCreatedDate: string | null;
  lockTxIds: string[];
  lockReleaseStatus: 'none' | 'pending' | 'released' | 'refunded' | 'penalized';
}

export interface OrganizerFinancialOverview {
  mainWalletBalance: number;
  totalLockedAmount: number;
  tournamentLocks: number;
  scrimLocks: number;
  pendingLocks: number;
  releasedLocks: number;
  pendingCommission: number;
  releasedCommission: number;
  upcomingSettlement: number;
  fineAmountToday: number;
  pendingFines: number;
  historicalFines: number;
  recentActivity: Transaction[];
}

export interface OrganizerEventOverview {
  totalTournaments: number;
  activeTournaments: number;
  upcomingTournaments: number;
  completedTournaments: number;
  totalScrims: number;
  activeScrims: number;
  upcomingScrims: number;
  completedScrims: number;
}

export interface OrganizerAlert {
  id: string;
  type:
    | 'LOCK_INCOMPLETE'
    | 'CANNOT_START'
    | 'RESULTS_PENDING'
    | 'DEADLINE_APPROACHING'
    | 'DEADLINE_OVERDUE'
    | 'DISPUTE_PENDING'
    | 'STAGE_VALIDATION_WAITING'
    | 'SETTLEMENT_PENDING';
  severity: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  eventId?: string;
  eventType?: 'tournament' | 'scrim';
  targetTab: string;
  targetUrl?: string;
}

// ─── 1. PURE EVENT LOCK CALCULATION ENGINE ─────────────────────────────────────

/**
 * Authoritatively calculates lock amount requirements and collection progress
 * for any tournament or scrim.
 *
 * CORE BUSINESS RULES:
 * - Paid Events: Lock amount is the required prize pool / entry fees liability.
 *   collectedAmount = filledSlots * entryFee (or host pre-funded escrow).
 * - Free Events: Lock amount is the platform security deposit (DEFAULT_FREE_LOCK_AMOUNT).
 *   collectedAmount = lockAmountDeposited ? lockAmount : 0.
 * - Event CANNOT start until collectedAmount >= requiredLockAmount.
 */
export function getEventLockDetails(event: any): EventLockDetails {
  if (!event) {
    return {
      eventId: '',
      eventName: 'Unknown Event',
      eventType: 'tournament',
      isPaid: false,
      isFree: true,
      entryFee: 0,
      prizePool: 0,
      totalSlots: 0,
      filledSlots: 0,
      requiredLockAmount: 0,
      collectedAmount: 0,
      remainingAmount: 0,
      collectionPercentage: 100,
      status: 'FULLY_COLLECTED',
      canStart: true,
      eventStatus: 'unknown',
      startDate: null,
      lockCreatedDate: null,
      lockTxIds: [],
      lockReleaseStatus: 'none',
    };
  }

  const eventId = event.id || '';
  const eventName = event.title || event.name || 'Untitled Event';
  const isScrim =
    event.matchType === 'scrims' ||
    event.isScrim === true ||
    event.type === 'scrim' ||
    event._type === 'scrim' ||
    event._eventType === 'scrim';
  const eventType: 'tournament' | 'scrim' = isScrim ? 'scrim' : 'tournament';

  const entryFee = Math.max(
    0,
    Number(
      event.entryFee ??
      event.requirements?.entryFee ??
      event.price ??
      event.fee ??
      0
    )
  );

  const rawPrizePool = Math.max(
    0,
    Number(
      event.prizePool ??
      event.totalPrizePool ??
      event.prizes?.reduce?.((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) ??
      0
    )
  );

  const totalSlots = Math.max(
    1,
    getSlotCount(event) ||
    Number(event.totalSlots) ||
    (Array.isArray(event.slots) ? event.slots.length : 20)
  );

  // Per-Kill Scrim capacity calculation
  const isPerKill =
    event.scrimMode === 'PER_KILL' ||
    (event.rewardPerKill !== undefined && Number(event.rewardPerKill) > 0);
  let prizePool = rawPrizePool;

  if (isPerKill && Number(event.rewardPerKill) > 0) {
    const teamType = String(event.teamType || '').toLowerCase();
    const playersInMatch =
      teamType === 'solo' || totalSlots === 48
        ? totalSlots
        : teamType === 'duo' || totalSlots === 25
        ? totalSlots * 2
        : totalSlots * 4;
    const maxBountyCapacity = playersInMatch * Number(event.rewardPerKill);
    if (prizePool === 0 || prizePool > maxBountyCapacity) {
      prizePool = maxBountyCapacity;
    }
  }

  const isPaid = entryFee > 0;
  const isFree = !isPaid;

  let filledSlots = 0;
  if (Array.isArray(event.slots)) {
    filledSlots = countFilledScrimSlots(event.slots);
  } else {
    filledSlots = Number(event.filledSlots || event.currentPlayers || 0);
  }

  // Pre-funding check
  const fundingStatus = String(event.fundingStatus || '').toUpperCase();
  const isPreFunded =
    fundingStatus === 'RESERVED' ||
    fundingStatus === 'FUNDED' ||
    fundingStatus === 'ESCROW_PAID';

  let requiredLockAmount = 0;
  let collectedAmount = 0;

  if (isPaid) {
    // For paid events: required lock is the promised prize pool (or min required entry fees)
    requiredLockAmount = prizePool;
    const collectedFromSlots = filledSlots * entryFee;

    if (isPreFunded) {
      collectedAmount = Math.max(requiredLockAmount, collectedFromSlots);
    } else {
      collectedAmount = collectedFromSlots;
    }
  } else {
    // For free events: required lock is platform security deposit
    requiredLockAmount = Math.max(0, Number(event.lockAmount || DEFAULT_FREE_LOCK_AMOUNT));
    const isDeposited =
      event.lockAmountDeposited === true ||
      event.lockAmountStatus === 'deposited' ||
      event.lockAmountStatus === 'locked';
    collectedAmount = isDeposited ? requiredLockAmount : 0;
  }

  const remainingAmount = Math.max(0, requiredLockAmount - collectedAmount);
  const collectionPercentage =
    requiredLockAmount > 0
      ? Math.min(100, Math.round((collectedAmount / requiredLockAmount) * 100))
      : 100;

  // Status derivation
  const eventStatus = String(event.status || 'open').toLowerCase();
  const isCompleted = eventStatus === 'completed' || eventStatus === 'finalized';
  const isSettled = event.settlementStatus === 'settled';
  const isRefunded =
    eventStatus === 'cancelled' || event.lockAmountStatus === 'refunded';

  let status: EventLockStatus = 'LOCK_PENDING';
  if (isRefunded) {
    status = 'REFUNDED';
  } else if (isSettled || event.payoutCompleted || event.lockAmountStatus === 'refunded') {
    status = 'RELEASED';
  } else if (eventStatus === 'live' || isCompleted) {
    status = 'LOCKED';
  } else if (collectedAmount >= requiredLockAmount && requiredLockAmount > 0) {
    status = 'FULLY_COLLECTED';
  } else if (collectedAmount > 0) {
    status = 'PARTIALLY_COLLECTED';
  } else {
    status = 'LOCK_PENDING';
  }

  // Start readiness
  const canStart = collectedAmount >= requiredLockAmount;
  let cannotStartReason: string | undefined;

  if (!canStart) {
    if (isPaid) {
      const minSlotsNeeded = Math.ceil(prizePool / Math.max(1, entryFee));
      const slotsRemaining = Math.max(0, minSlotsNeeded - filledSlots);
      cannotStartReason = `Incomplete Lock Amount: Rs. ${collectedAmount.toLocaleString()} collected of Rs. ${requiredLockAmount.toLocaleString()} required (Rs. ${remainingAmount.toLocaleString()} remaining). Needs ${slotsRemaining} more registered ${slotsRemaining === 1 ? 'slot' : 'slots'} to guarantee prize funds.`;
    } else {
      cannotStartReason = `Incomplete Security Deposit: Organizer must deposit Rs. ${requiredLockAmount.toLocaleString()} security lock amount before starting this free event.`;
    }
  }

  // Transaction traces
  const lockTxIds: string[] = [];
  if (event.lockDepositTxId) lockTxIds.push(event.lockDepositTxId);
  if (event.settlementTxId) lockTxIds.push(event.settlementTxId);
  if (Array.isArray(event.settlementAuditLog)) {
    for (const log of event.settlementAuditLog) {
      if (log.walletTxId && !lockTxIds.includes(log.walletTxId)) {
        lockTxIds.push(log.walletTxId);
      }
    }
  }

  const startDate = toDateSafe(event.startTime)?.toISOString() || null;
  const lockCreatedDate = toDateSafe(event.createdAt)?.toISOString() || null;
  const lockReleaseStatus = event.lockAmountStatus || 'none';

  return {
    eventId,
    eventName,
    eventType,
    isPaid,
    isFree,
    entryFee,
    prizePool,
    totalSlots,
    filledSlots,
    requiredLockAmount,
    collectedAmount,
    remainingAmount,
    collectionPercentage,
    status,
    canStart,
    cannotStartReason,
    eventStatus,
    startDate,
    lockCreatedDate,
    lockTxIds,
    lockReleaseStatus,
  };
}

// ─── 2. SERVER-AUTHORITATIVE EVENT START VALIDATION ────────────────────────────

/**
 * Authoritatively validates and transitions a tournament or scrim to 'live' status.
 *
 * MANDATORY RULE ENFORCEMENT:
 * - A tournament/scrim MUST NOT begin until collectedAmount >= requiredLockAmount.
 * - Backend rejects the start request if the lock is incomplete.
 * - Never trusts client-side values.
 * - Verifies organizer ownership.
 */
export async function validateAndStartEventServer(params: {
  eventId: string;
  eventType: 'tournament' | 'scrim';
  actorUid: string;
  actorName: string;
  actorRole?: string;
}): Promise<{
  success: boolean;
  message: string;
  lockDetails: EventLockDetails;
}> {
  const { eventId, eventType, actorUid, actorName, actorRole } = params;

  // Determine collection name
  const collectionName = eventType === 'scrim' ? 'scrims' : 'tournaments';
  let eventRef = doc(db, collectionName, eventId);
  let snap = await getDoc(eventRef);

  // Fallback: If not found in 'scrims', check legacy 'tournaments'
  if (!snap.exists() && eventType === 'scrim') {
    eventRef = doc(db, 'tournaments', eventId);
    snap = await getDoc(eventRef);
  }

  if (!snap.exists()) {
    throw new Error(`${eventType === 'scrim' ? 'Scrim' : 'Tournament'} ${eventId} not found.`);
  }

  const eventData = { id: snap.id, ...snap.data() } as any;

  // 1. Verify Ownership / Permissions
  const hostId =
    eventData.hostUid ||
    eventData.orgId ||
    eventData.organizerId ||
    eventData.userId ||
    eventData.createdBy;

  const isOwner = Boolean(hostId && String(hostId).trim() === String(actorUid).trim());
  const isAdmin = actorRole === 'admin';

  if (!isOwner && !isAdmin) {
    throw new Error('Unauthorized: You do not own this event.');
  }

  // 2. Prevent Starting Completed / Cancelled Events
  const currentStatus = String(eventData.status || '').toLowerCase();
  if (currentStatus === 'completed' || currentStatus === 'cancelled') {
    throw new Error(
      `This ${eventType} is ${currentStatus} and archived in history. It cannot be restarted.`
    );
  }

  // 3. Authoritative Lock Amount Evaluation
  const lockDetails = getEventLockDetails(eventData);

  if (!lockDetails.canStart) {
    throw new Error(
      `Cannot start ${eventType}: ${lockDetails.cannotStartReason}`
    );
  }

  // 4. Atomic Transition to 'live'
  const auditEntry = {
    timestamp: new Date().toISOString(),
    action: 'EVENT_STARTED',
    actorUid,
    actorName,
    actorRole: actorRole || 'organizer',
    eventId,
    eventType,
    details: `Event started with full lock verified: Rs. ${lockDetails.collectedAmount} / Rs. ${lockDetails.requiredLockAmount}`,
  };

  const updatePayload: Record<string, any> = {
    status: 'live',
    updatedAt: serverTimestamp(),
    startedAt: serverTimestamp(),
    settlementAuditLog: [
      ...(Array.isArray(eventData.settlementAuditLog) ? eventData.settlementAuditLog : []),
      auditEntry,
    ],
  };

  await updateDoc(eventRef, cleanFirestoreData(updatePayload));

  return {
    success: true,
    message: `${eventType === 'scrim' ? 'Scrim' : 'Tournament'} "${lockDetails.eventName}" is now LIVE! Lock verified (Rs. ${lockDetails.collectedAmount.toLocaleString()}).`,
    lockDetails,
  };
}

// ─── 3. ORGANIZER DASHBOARD AGGREGATIONS ───────────────────────────────────────

/**
 * Aggregates production-grade Event Overview metrics (Tournaments + Scrims).
 */
export function computeOrganizerEventOverview(params: {
  tournaments: Tournament[];
  scrims: any[];
}): OrganizerEventOverview {
  const { tournaments = [], scrims = [] } = params;

  let activeTournaments = 0;
  let upcomingTournaments = 0;
  let completedTournaments = 0;

  for (const t of tournaments) {
    const s = String(t.status || '').toLowerCase();
    if (s === 'live') activeTournaments++;
    else if (s === 'completed' || s === 'finalized') completedTournaments++;
    else upcomingTournaments++;
  }

  let activeScrims = 0;
  let upcomingScrims = 0;
  let completedScrims = 0;

  for (const s of scrims) {
    const st = String(s.status || '').toLowerCase();
    if (st === 'live') activeScrims++;
    else if (st === 'completed' || st === 'finalized') completedScrims++;
    else upcomingScrims++;
  }

  return {
    totalTournaments: tournaments.length,
    activeTournaments,
    upcomingTournaments,
    completedTournaments,
    totalScrims: scrims.length,
    activeScrims,
    upcomingScrims,
    completedScrims,
  };
}

/**
 * Computes live, actionable Event Alerts across all organizer-owned events.
 */
export function computeOrganizerAlerts(params: {
  tournaments: Tournament[];
  scrims: any[];
  disputes?: any[];
}): OrganizerAlert[] {
  const { tournaments = [], scrims = [], disputes = [] } = params;
  const alerts: OrganizerAlert[] = [];

  const allEvents = [
    ...tournaments.map((t) => ({ ...t, _eventType: 'tournament' as const })),
    ...scrims.map((s) => ({ ...s, _eventType: 'scrim' as const })),
  ];

  for (const event of allEvents) {
    const lock = getEventLockDetails(event);
    const eventStatus = String(event.status || '').toLowerCase();
    const isCompleted = eventStatus === 'completed' || eventStatus === 'finalized';

    // 1. Incomplete Lock Alert for Upcoming/Open events
    if (!isCompleted && eventStatus !== 'cancelled' && !lock.canStart) {
      alerts.push({
        id: `lock_${event.id}`,
        type: 'LOCK_INCOMPLETE',
        severity: 'warning',
        title: `Lock Incomplete: ${lock.eventName}`,
        message: `Needs Rs. ${lock.remainingAmount.toLocaleString()} more to start (${lock.collectionPercentage}% collected).`,
        eventId: event.id,
        eventType: event._eventType,
        targetTab: 'locks',
        targetUrl: event._eventType === 'tournament' ? `/tournaments/${event.id}` : `/scrims/${event.id}`,
      });
    }

    // 2. Completed events: Result pending / 48-Hour Deadline
    if (isCompleted) {
      const isPublished =
        event.resultStatus === 'published' || event.resultStatus === 'verified';
      const isPenaltyApplied = event.penaltyApplied === true;

      if (!isPublished) {
        const remaining = getResultDeadlineRemaining(event);

        if (remaining.isExpired || isPenaltyApplied) {
          alerts.push({
            id: `deadline_overdue_${event.id}`,
            type: 'DEADLINE_OVERDUE',
            severity: 'error',
            title: `48h Deadline Overdue: ${lock.eventName}`,
            message: `Result submission deadline passed. 10% penalty applied. Please publish results to settle.`,
            eventId: event.id,
            eventType: event._eventType,
            targetTab: 'results',
            targetUrl: event._eventType === 'tournament' ? `/tournaments/${event.id}` : `/scrims/${event.id}`,
          });
        } else if (remaining.isWarning) {
          alerts.push({
            id: `deadline_warn_${event.id}`,
            type: 'DEADLINE_APPROACHING',
            severity: 'warning',
            title: `Result Deadline Approaching: ${lock.eventName}`,
            message: `${remaining.formatted} remaining to publish results and avoid a 10% penalty.`,
            eventId: event.id,
            eventType: event._eventType,
            targetTab: 'results',
            targetUrl: event._eventType === 'tournament' ? `/tournaments/${event.id}` : `/scrims/${event.id}`,
          });
        } else {
          alerts.push({
            id: `results_pending_${event.id}`,
            type: 'RESULTS_PENDING',
            severity: 'info',
            title: `Results Pending: ${lock.eventName}`,
            message: `Event is completed. Submit and publish final results to unlock settlement.`,
            eventId: event.id,
            eventType: event._eventType,
            targetTab: 'results',
            targetUrl: event._eventType === 'tournament' ? `/tournaments/${event.id}` : `/scrims/${event.id}`,
          });
        }
      }
    }
  }

  // 3. Disputes Alert
  const pendingDisputes = (disputes || []).filter(
    (d) => String(d.status || 'pending').toLowerCase() === 'pending'
  );
  if (pendingDisputes.length > 0) {
    alerts.push({
      id: 'disputes_pending',
      type: 'DISPUTE_PENDING',
      severity: 'error',
      title: `${pendingDisputes.length} Unresolved Dispute${pendingDisputes.length > 1 ? 's' : ''}`,
      message: 'Player match dispute filed requires organizer review.',
      targetTab: 'disputes',
    });
  }

  return alerts;
}

/**
 * Computes read-only financial metrics strictly derived from Main Wallet balance
 * and event transactions. No duplicate or mock wallet state.
 */
export function computeOrganizerFinancialOverview(params: {
  tournaments: Tournament[];
  scrims: any[];
  transactions: Transaction[];
  profile: any;
}): OrganizerFinancialOverview {
  const { tournaments = [], scrims = [], transactions = [], profile } = params;

  // Single Source of Truth: Registered Main Wallet Balance
  const mainWalletBalance =
    typeof profile?.balance === 'number'
      ? profile.balance
      : typeof profile?.orgWalletBalance === 'number'
      ? profile.orgWalletBalance
      : 0;

  let totalLockedAmount = 0;
  let tournamentLocks = 0;
  let scrimLocks = 0;
  let pendingLocks = 0;
  let releasedLocks = 0;

  const allEvents = [
    ...tournaments.map((t) => ({ ...t, _type: 'tournament' as const })),
    ...scrims.map((s) => ({ ...s, _type: 'scrim' as const })),
  ];

  for (const event of allEvents) {
    const lock = getEventLockDetails(event);
    if (lock.status === 'LOCKED' || lock.status === 'FULLY_COLLECTED') {
      totalLockedAmount += lock.collectedAmount;
      if (lock.eventType === 'tournament') tournamentLocks += lock.collectedAmount;
      else scrimLocks += lock.collectedAmount;
    } else if (lock.status === 'PARTIALLY_COLLECTED' || lock.status === 'LOCK_PENDING') {
      pendingLocks += lock.requiredLockAmount;
    } else if (lock.status === 'RELEASED') {
      releasedLocks += lock.collectedAmount;
    }
  }

  // Commissions & Fines from real wallet transactions
  let pendingCommission = 0;
  let releasedCommission = 0;
  let fineAmountToday = 0;
  let pendingFines = 0;
  let historicalFines = 0;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  for (const tx of transactions) {
    const type = String(tx.type || '').toLowerCase();
    const amount = Math.abs(Number(tx.amount || 0));
    const txDate = toDateSafe(tx.timestamp || tx.createdAt);

    if (type.includes('commission') || type.includes('org_share') || type.includes('earnings_release')) {
      if (tx.status === 'completed' || tx.status === 'success') {
        releasedCommission += amount;
      } else {
        pendingCommission += amount;
      }
    }

    if (type.includes('fine') || type.includes('penalty')) {
      historicalFines += amount;
      if (tx.status === 'pending') {
        pendingFines += amount;
      }
      if (txDate && txDate >= todayStart) {
        fineAmountToday += amount;
      }
    }
  }

  // Upcoming settlement: expected profit from completed events that are not yet settled
  let upcomingSettlement = 0;
  for (const event of allEvents) {
    const status = String(event.status || '').toLowerCase();
    if ((status === 'completed' || status === 'finalized') && event.settlementStatus !== 'settled') {
      const entryFee = Math.max(0, Number(event.entryFee || 0));
      const prizePool = Math.max(0, Number(event.prizePool || 0));
      const filled = Number(event.filledSlots || event.currentPlayers || 0);
      const gross = filled * entryFee;
      if (gross > prizePool) {
        const netProfit = gross - prizePool;
        upcomingSettlement += Math.round(netProfit * 0.85); // 85% host share
      }
    }
  }

  return {
    mainWalletBalance,
    totalLockedAmount,
    tournamentLocks,
    scrimLocks,
    pendingLocks,
    releasedLocks,
    pendingCommission,
    releasedCommission,
    upcomingSettlement,
    fineAmountToday,
    pendingFines,
    historicalFines,
    recentActivity: transactions.slice(0, 20),
  };
}
