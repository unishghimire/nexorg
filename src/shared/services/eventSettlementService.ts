/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * NEXPLAY EVENT RESULT, COMPLETION, ORGANIZER PROFIT, LOCK AMOUNT & 48-HR PENALTY ENGINE
 * ═══════════════════════════════════════════════════════════════════════════════
 * Authoritative lifecycle engine governing:
 * 1. Event Completion & 48-Hour Result Deadline initialization
 * 2. Result Validation (Standard points vs Per-Kill bounties) & Audit Log
 * 3. Paid Events: Locked Organizer Profit calculation & release
 * 4. Free Events: Rs. 0 profit rule + Lock Amount deposit & release
 * 5. 48-Hour Deadline enforcement with automated 10% penalty
 * 6. Background deadline check & settlement state machine
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
  collection,
  serverTimestamp,
  increment,
  runTransaction,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { calculateRevenueSplit } from '../constants/finance';
import { cleanFirestoreData, formatDate } from '../utils/utils';
import { NotificationService } from './NotificationService';
import { calculatePlayerReward } from './perKillEngine';
import { resolveAllScrimResults } from '../utils/scrimResults';
import { countFilledScrimSlots } from '../utils/scrimSlots';

// ─── Configuration Constants ──────────────────────────────────────────────────
export const RESULT_DEADLINE_MS = 48 * 60 * 60 * 1000; // 48 Hours in milliseconds
export const PENALTY_RATE_PERCENT = 10;                // 10% Penalty
export const MIN_PENALTY_FLOOR_PAID = 50;              // Rs. 50 minimum penalty for paid events
export const DEFAULT_FREE_LOCK_AMOUNT = 200;           // Rs. 200 standard deposit for free events

export type EventResultStatus = 'none' | 'result_pending' | 'draft' | 'published' | 'verified';
export type EventSettlementStatus = 'unfunded' | 'escrow_locked' | 'pending_results' | 'penalty_applied' | 'settled';
export type EventDeadlineStatus = 'none' | 'active' | 'met' | 'expired' | 'penalized';
export type EventLockAmountStatus = 'none' | 'required' | 'deposited' | 'refunded' | 'penalized';

export interface SettlementAuditEntry {
  timestamp: string;
  action:
    | 'EVENT_COMPLETED'
    | 'RESULT_SUBMITTED'
    | 'RESULT_EDITED'
    | 'RESULT_PUBLISHED'
    | 'PROFIT_RELEASED'
    | 'LOCK_AMOUNT_DEPOSITED'
    | 'LOCK_AMOUNT_REFUNDED'
    | 'PENALTY_APPLIED'
    | 'SETTLEMENT_COMPLETED'
    | 'ADMIN_CORRECTION';
  actorUid: string;
  actorName: string;
  actorRole?: string;
  eventId: string;
  eventType: 'tournament' | 'scrim';
  previousValue?: any;
  newValue?: any;
  reason?: string;
  walletTxId?: string;
  details?: string;
}

export interface DeadlineRemaining {
  msRemaining: number;
  hours: number;
  minutes: number;
  seconds: number;
  formatted: string;
  isExpired: boolean;
  isWarning: boolean; // true when less than 12 hours remain
}

// ─── Utility Helpers ──────────────────────────────────────────────────────────

export function parseDateSafe(input: any): Date | null {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  if (typeof input.toDate === 'function') {
    try {
      const d = input.toDate();
      return isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }
  if (typeof input === 'number') {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof input === 'string') {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Calculates time remaining until 48-hour result deadline expires.
 */
export function getResultDeadlineRemaining(event: any): DeadlineRemaining {
  const completedDate = parseDateSafe(event?.completedAt);
  const deadlineDate = parseDateSafe(event?.resultDeadlineAt) || 
    (completedDate ? new Date(completedDate.getTime() + RESULT_DEADLINE_MS) : null);

  if (!deadlineDate) {
    return {
      msRemaining: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      formatted: 'No Deadline',
      isExpired: false,
      isWarning: false,
    };
  }

  const now = Date.now();
  const diff = deadlineDate.getTime() - now;

  if (diff <= 0) {
    return {
      msRemaining: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      formatted: 'Deadline Expired',
      isExpired: true,
      isWarning: true,
    };
  }

  const totalSecs = Math.floor(diff / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;
  const isWarning = hours < 12;

  const formatted = `${hours}h ${minutes}m ${seconds}s`;

  return {
    msRemaining: diff,
    hours,
    minutes,
    seconds,
    formatted,
    isExpired: false,
    isWarning,
  };
}

/**
 * Authoritatively calculates penalty base and 10% penalty amount.
 * - Paid Events: 10% of Collected Entry Fees (or prizePool if collected < prizePool)
 * - Free Events: 10% of Lock Amount
 */
export function calculatePenaltyDetails(event: any): {
  penaltyBaseAmount: number;
  penaltyBaseDescription: string;
  penaltyAmount: number;
} {
  const entryFee = Math.max(0, Number(event?.entryFee || event?.requirements?.entryFee || 0));
  const isPaid = entryFee > 0;

  if (isPaid) {
    const filledSlots = Array.isArray(event?.slots)
      ? countFilledScrimSlots(event.slots)
      : Number(event?.filledSlots || event?.currentPlayers || 0);
    const collected = Math.max(0, Number(event?.collectedFees || event?.collectedEntryFees || (filledSlots * entryFee)));
    const prizePool = Math.max(0, Number(event?.prizePool || 0));
    const base = collected > 0 ? collected : prizePool;
    const penalty = Math.max(MIN_PENALTY_FLOOR_PAID, Math.round(base * (PENALTY_RATE_PERCENT / 100)));
    return {
      penaltyBaseAmount: base,
      penaltyBaseDescription: `10% of collected entry fees (Rs. ${base.toLocaleString()})`,
      penaltyAmount: penalty,
    };
  }

  // Free Event: Penalty base is the deposited lock amount
  const lockAmount = Math.max(0, Number(event?.lockAmount || DEFAULT_FREE_LOCK_AMOUNT));
  const penalty = Math.max(10, Math.round(lockAmount * (PENALTY_RATE_PERCENT / 100)));
  return {
    penaltyBaseAmount: lockAmount,
    penaltyBaseDescription: `10% of security lock amount (Rs. ${lockAmount.toLocaleString()})`,
    penaltyAmount: penalty,
  };
}

// ─── 1. Mark Event Completed & Start 48-Hour Deadline ────────────────────────

export async function markEventCompletedWithDeadline(params: {
  eventId: string;
  eventType: 'tournament' | 'scrim';
  actorUid: string;
  actorName: string;
  actorRole?: string;
  lockAmount?: number;
}): Promise<{ success: boolean; message: string; deadlineDate: Date }> {
  const { eventId, eventType, actorUid, actorName, actorRole } = params;
  const collectionName = eventType === 'scrim' ? 'scrims' : 'tournaments';
  const eventRef = doc(db, collectionName, eventId);

  const snap = await getDoc(eventRef);
  if (!snap.exists()) {
    throw new Error(`${eventType} document ${eventId} does not exist`);
  }

  const data = snap.data();
  if (data.status === 'completed' && data.resultDeadlineAt) {
    return {
      success: true,
      message: `${eventType} is already completed with active deadline`,
      deadlineDate: parseDateSafe(data.resultDeadlineAt) || new Date(),
    };
  }

  const now = new Date();
  const deadlineDate = new Date(now.getTime() + RESULT_DEADLINE_MS);
  const entryFee = Math.max(0, Number(data.entryFee || data.requirements?.entryFee || 0));
  const isPaid = entryFee > 0;
  const isFree = !isPaid;

  const configuredLockAmount = isFree
    ? Math.max(0, Number(params.lockAmount ?? data.lockAmount ?? DEFAULT_FREE_LOCK_AMOUNT))
    : 0;

  const auditEntry: SettlementAuditEntry = {
    timestamp: now.toISOString(),
    action: 'EVENT_COMPLETED',
    actorUid,
    actorName,
    actorRole: actorRole || 'organizer',
    eventId,
    eventType,
    newValue: {
      status: 'completed',
      resultDeadlineAt: deadlineDate.toISOString(),
      isPaid,
      lockAmount: configuredLockAmount,
    },
    reason: 'Event completed by organizer. 48-hour result publication countdown started.',
  };

  const payload: Record<string, any> = {
    status: 'completed',
    stage: 'completed',
    completedAt: serverTimestamp(),
    resultDeadlineAt: deadlineDate.toISOString(),
    deadlineStatus: 'active',
    resultStatus: data.resultStatus === 'published' ? 'published' : 'result_pending',
    settlementStatus: data.resultStatus === 'published' ? 'settled' : 'pending_results',
    profitStatus: isPaid ? (data.organizerProfitReleased ? 'released' : 'locked') : 'zero_profit',
    lockAmount: configuredLockAmount,
    lockAmountStatus: isFree
      ? (data.lockAmountStatus || (data.lockAmountDeposited ? 'deposited' : 'required'))
      : 'none',
    settlementAuditLog: [
      ...(Array.isArray(data.settlementAuditLog) ? data.settlementAuditLog : []),
      auditEntry,
    ],
    updatedAt: serverTimestamp(),
  };

  await updateDoc(eventRef, cleanFirestoreData(payload));

  // Send in-app reminder to organizer
  const hostId = data.hostUid || data.orgId || actorUid;
  if (hostId) {
    NotificationService.create(
      hostId,
      '48-Hour Result Countdown Started ⏰',
      `"${data.title || 'Event'}" has been marked completed. You have exactly 48 hours to publish official match results to avoid a 10% penalty.`,
      'alert',
      eventType === 'scrim' ? `/scrims/${eventId}` : `/tournaments/${eventId}`
    ).catch(() => {});
  }

  return {
    success: true,
    message: `Event completed! 48-hour result deadline active until ${formatDate(deadlineDate)}`,
    deadlineDate,
  };
}

// ─── 2. Free Event Lock Amount Deposit ────────────────────────────────────────

export async function depositFreeEventLockAmount(params: {
  eventId: string;
  eventType: 'tournament' | 'scrim';
  hostUid: string;
  lockAmount?: number;
}): Promise<{ success: boolean; message: string; txId: string }> {
  const { eventId, eventType, hostUid } = params;
  const lockAmount = Math.max(0, Number(params.lockAmount || DEFAULT_FREE_LOCK_AMOUNT));
  const collectionName = eventType === 'scrim' ? 'scrims' : 'tournaments';

  if (lockAmount <= 0) {
    return { success: true, message: 'No lock amount required', txId: '' };
  }

  // Atomically check wallet balance and reserve lock amount
  const userRef = doc(db, 'users', hostUid);
  const eventRef = doc(db, collectionName, eventId);

  let txId = '';

  await runTransaction(db, async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) {
      throw new Error('Host user account not found');
    }

    const userData = userSnap.data();
    const currentBalance = Number(userData.balance ?? userData.walletBalance ?? 0);

    if (currentBalance < lockAmount) {
      throw new Error(
        `Insufficient balance for free event lock deposit: Available Rs. ${currentBalance.toLocaleString()}, Required Rs. ${lockAmount.toLocaleString()}`
      );
    }

    const eventSnap = await transaction.get(eventRef);
    if (!eventSnap.exists()) {
      throw new Error(`${eventType} document not found`);
    }

    const eventData = eventSnap.data();
    if (eventData.lockAmountDeposited === true && eventData.lockAmountStatus === 'deposited') {
      return; // Already deposited
    }

    const txRef = doc(collection(db, 'transactions'));
    txId = txRef.id;

    // Deduct available balance and reserve lock deposit
    transaction.update(userRef, {
      balance: increment(-lockAmount),
      reservedBalance: increment(lockAmount),
      updatedAt: serverTimestamp(),
    });

    // Create immutable audit transaction
    transaction.set(txRef, {
      id: txId,
      userId: hostUid,
      type: 'lock_amount_deposit',
      amount: -lockAmount,
      currency: 'NPR',
      method: 'NexPlay Security Lock Deposit',
      status: 'completed',
      refId: `LCK-${eventId.slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`,
      desc: `Refundable lock amount deposit for Free ${eventType === 'scrim' ? 'Practice Scrim' : 'Tournament'}: ${eventData.title || eventId}`,
      tournamentId: eventId,
      scrimId: eventId,
      timestamp: serverTimestamp(),
    });

    const auditEntry: SettlementAuditEntry = {
      timestamp: new Date().toISOString(),
      action: 'LOCK_AMOUNT_DEPOSITED',
      actorUid: hostUid,
      actorName: userData.orgName || userData.username || 'Host',
      eventId,
      eventType,
      newValue: { lockAmount, txId },
      walletTxId: txId,
      reason: `Security lock deposit of Rs. ${lockAmount} secured for free event`,
    };

    transaction.update(eventRef, {
      lockAmount,
      lockAmountDeposited: true,
      lockAmountStatus: 'deposited',
      lockAmountTxId: txId,
      settlementAuditLog: [
        ...(Array.isArray(eventData.settlementAuditLog) ? eventData.settlementAuditLog : []),
        auditEntry,
      ],
      updatedAt: serverTimestamp(),
    });
  });

  return {
    success: true,
    message: `Lock deposit of Rs. ${lockAmount.toLocaleString()} successfully reserved from organizer wallet.`,
    txId,
  };
}

// ─── 3. Publish Results & Execute Financial Settlement ───────────────────────

export interface PublishResultsAndSettleParams {
  eventId: string;
  eventType: 'tournament' | 'scrim';
  actorUid: string;
  actorName: string;
  actorRole?: string;
  results: any[];
  scoringSnapshot?: any;
  winners?: any[];
  notes?: string;
}

export async function publishResultsAndSettle(
  params: PublishResultsAndSettleParams
): Promise<{
  success: boolean;
  message: string;
  profitReleased: number;
  lockRefunded: number;
  penaltyApplied: boolean;
}> {
  const { eventId, eventType, actorUid, actorName, actorRole, results, scoringSnapshot, winners, notes } = params;
  const collectionName = eventType === 'scrim' ? 'scrims' : 'tournaments';
  const eventRef = doc(db, collectionName, eventId);

  const eventSnap = await getDoc(eventRef);
  if (!eventSnap.exists()) {
    throw new Error(`${eventType} ${eventId} not found`);
  }

  const eventData = eventSnap.data();
  const hostUid = eventData.hostUid || eventData.orgId || actorUid;
  const now = new Date();

  // Validate results input
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error('Valid results with participating teams/players are required to publish');
  }

  // Validate each competitor has non-negative stats
  for (const r of results) {
    if (r.rank === undefined || isNaN(Number(r.rank)) || Number(r.rank) < 1) {
      throw new Error(`Invalid rank for competitor "${r.team || r.teamName || 'Unknown'}"`);
    }
    if (r.kills !== undefined && (isNaN(Number(r.kills)) || Number(r.kills) < 0)) {
      throw new Error(`Invalid kills count for competitor "${r.team || r.teamName || 'Unknown'}"`);
    }
  }

  const completedDate = parseDateSafe(eventData.completedAt) || now;
  const deadlineDate = parseDateSafe(eventData.resultDeadlineAt) || new Date(completedDate.getTime() + RESULT_DEADLINE_MS);
  const isWithinDeadline = now.getTime() <= deadlineDate.getTime();

  const entryFee = Math.max(0, Number(eventData.entryFee || eventData.requirements?.entryFee || 0));
  const isPaid = entryFee > 0;
  const isFree = !isPaid;
  const prizePool = Math.max(0, Number(eventData.prizePool || 0));

  // Determine collected fees authoritatively from filled slots or registered players
  const filledSlots = Array.isArray(eventData.slots)
    ? countFilledScrimSlots(eventData.slots)
    : Number(eventData.filledSlots || eventData.currentPlayers || results.length);
  const collectedFees = isPaid ? filledSlots * entryFee : 0;

  let profitReleased = 0;
  let lockRefunded = 0;
  let profitTxId = '';
  let lockRefundTxId = '';

  const siteSnap = await getDoc(doc(db, 'settings', 'site')).catch(() => null);
  const commissionPercent = siteSnap?.data()?.platformCommissionPercent ?? 15;

  // Execute Financial Settlement inside atomic transaction
  await runTransaction(db, async (transaction) => {
    const currentEventSnap = await transaction.get(eventRef);
    if (!currentEventSnap.exists()) throw new Error('Event not found in transaction');
    const freshEvent = currentEventSnap.data();

    // Prevent duplicate result publication if already verified/published
    if (freshEvent.resultStatus === 'verified') {
      throw new Error('Results have already been verified by administrator and are locked.');
    }

    const hostRef = doc(db, 'users', hostUid);
    const hostSnap = await transaction.get(hostRef);
    const hostData = hostSnap.exists() ? hostSnap.data() : null;

    // ─────────────────────────────────────────────────────────────────────────
    // PAID EVENT: Release organizer profit share
    // ─────────────────────────────────────────────────────────────────────────
    if (isPaid) {
      const profitMargin = Math.max(0, collectedFees - prizePool);
      const { orgShare, nexplayShare } = calculateRevenueSplit(profitMargin, commissionPercent);

      if (orgShare > 0 && !freshEvent.organizerProfitReleased) {
        profitReleased = orgShare;
        const txRef = doc(collection(db, 'transactions'));
        profitTxId = txRef.id;

        // Credit host wallet balance
        if (hostSnap.exists()) {
          transaction.update(hostRef, {
            balance: increment(orgShare),
            orgPendingEarnings: increment(-orgShare),
            updatedAt: serverTimestamp(),
          });
        }

        // Create immutable transaction record
        transaction.set(txRef, {
          id: profitTxId,
          userId: hostUid,
          type: 'earnings_release',
          amount: orgShare,
          currency: 'NPR',
          method: 'NexPlay Organizer Revenue Settlement',
          status: 'completed',
          refId: `PRF-${eventId.slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`,
          desc: `Organizer profit share released for ${freshEvent.title || eventId} (Total Collected: Rs. ${collectedFees.toLocaleString()}, Prize Pool: Rs. ${prizePool.toLocaleString()})`,
          tournamentId: eventId,
          scrimId: eventId,
          timestamp: serverTimestamp(),
        });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FREE EVENT: Profit is ALWAYS Rs. 0. Handle lock amount return.
    // ─────────────────────────────────────────────────────────────────────────
    if (isFree) {
      profitReleased = 0; // Strict Rs. 0 guarantee

      const lockAmount = Math.max(0, Number(freshEvent.lockAmount || DEFAULT_FREE_LOCK_AMOUNT));
      const hasDepositedLock = freshEvent.lockAmountDeposited === true && freshEvent.lockAmountStatus === 'deposited';

      if (hasDepositedLock && lockAmount > 0) {
        // If penalty was previously applied, refund remaining amount; otherwise full refund
        const alreadyPenalized = freshEvent.penaltyApplied === true;
        const refundAmount = alreadyPenalized
          ? Math.max(0, lockAmount - Number(freshEvent.penaltyAmount || 0))
          : lockAmount;

        if (refundAmount > 0 && hostSnap.exists()) {
          lockRefunded = refundAmount;
          const txRef = doc(collection(db, 'transactions'));
          lockRefundTxId = txRef.id;

          transaction.update(hostRef, {
            balance: increment(refundAmount),
            reservedBalance: increment(-lockAmount),
            updatedAt: serverTimestamp(),
          });

          transaction.set(txRef, {
            id: lockRefundTxId,
            userId: hostUid,
            type: 'lock_amount_refund',
            amount: refundAmount,
            currency: 'NPR',
            method: 'Security Lock Return',
            status: 'completed',
            refId: `LKR-${eventId.slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`,
            desc: `Security lock deposit refunded upon timely match result publication: ${freshEvent.title || eventId}`,
            tournamentId: eventId,
            scrimId: eventId,
            timestamp: serverTimestamp(),
          });
        }
      }
    }

    // Audit logs
    const auditEntries: SettlementAuditEntry[] = [
      ...(Array.isArray(freshEvent.settlementAuditLog) ? freshEvent.settlementAuditLog : []),
      {
        timestamp: now.toISOString(),
        action: 'RESULT_PUBLISHED',
        actorUid,
        actorName,
        actorRole: actorRole || 'organizer',
        eventId,
        eventType,
        newValue: {
          competitorCount: results.length,
          isWithinDeadline,
          profitReleased,
          lockRefunded,
        },
        reason: notes || 'Official match results submitted and verified.',
        walletTxId: profitTxId || lockRefundTxId || undefined,
      },
      {
        timestamp: now.toISOString(),
        action: 'SETTLEMENT_COMPLETED',
        actorUid,
        actorName,
        actorRole: actorRole || 'system',
        eventId,
        eventType,
        details: isPaid
          ? `Settled paid event. Organizer profit released: Rs. ${profitReleased}`
          : `Settled free event with Rs. 0 profit. Security lock refunded: Rs. ${lockRefunded}`,
      },
    ];

    const updatePayload: Record<string, any> = {
      manualResults: results,
      resultStatus: 'published',
      resultsPublishedAt: serverTimestamp(),
      deadlineStatus: isWithinDeadline ? 'met' : (freshEvent.deadlineStatus || 'expired'),
      settlementStatus: 'settled',
      // Profit fields
      profitStatus: isPaid ? 'released' : 'zero_profit',
      organizerProfit: isPaid ? profitReleased : 0,
      organizerProfitReleased: isPaid && profitReleased > 0 ? true : freshEvent.organizerProfitReleased || false,
      profitReleasedAt: profitReleased > 0 ? serverTimestamp() : freshEvent.profitReleasedAt || null,
      profitTxId: profitTxId || freshEvent.profitTxId || null,
      // Free Event Lock fields
      lockAmountStatus: isFree ? 'refunded' : 'none',
      lockRefundTxId: lockRefundTxId || freshEvent.lockRefundTxId || null,
      settlementAuditLog: auditEntries,
      updatedAt: serverTimestamp(),
    };

    if (scoringSnapshot) {
      updatePayload.scoringSnapshot = scoringSnapshot;
    }
    if (winners && winners.length > 0) {
      updatePayload.winners = winners;
      updatePayload.podium = winners;
    }

    transaction.update(eventRef, cleanFirestoreData(updatePayload));
  });

  return {
    success: true,
    message: isPaid
      ? `Results published! Organizer profit of Rs. ${profitReleased.toLocaleString()} settled.`
      : `Results published! Free event settled with Rs. 0 profit. Lock amount of Rs. ${lockRefunded.toLocaleString()} returned.`,
    profitReleased,
    lockRefunded,
    penaltyApplied: !isWithinDeadline,
  };
}

// ─── 4. Enforce 48-Hour Deadline Penalty (Authoritative 10%) ──────────────────

export async function enforceEventDeadlinePenalty(params: {
  eventId: string;
  eventType: 'tournament' | 'scrim';
  triggeredBy?: string;
}): Promise<{ success: boolean; penaltyAmount: number; message: string }> {
  const { eventId, eventType, triggeredBy = 'system_deadline_cron' } = params;
  const collectionName = eventType === 'scrim' ? 'scrims' : 'tournaments';
  const eventRef = doc(db, collectionName, eventId);

  let penaltyApplied = false;
  let penaltyAmount = 0;
  let txId = '';

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(eventRef);
    if (!snap.exists()) throw new Error(`${eventType} not found`);

    const event = snap.data();

    // Invariants:
    // 1. Must be completed
    // 2. Results must NOT be published yet
    // 3. Penalty must NOT have already been applied
    // 4. Current time must be past deadline
    if (event.status !== 'completed') return;
    if (event.resultStatus === 'published' || event.resultStatus === 'verified') return;
    if (event.penaltyApplied === true) return; // Strict idempotency

    const deadline = parseDateSafe(event.resultDeadlineAt) || 
      (parseDateSafe(event.completedAt) ? new Date(parseDateSafe(event.completedAt)!.getTime() + RESULT_DEADLINE_MS) : null);

    if (!deadline || Date.now() < deadline.getTime()) {
      return; // Deadline has not yet expired
    }

    const { penaltyBaseAmount, penaltyBaseDescription, penaltyAmount: calculatedPenalty } = calculatePenaltyDetails(event);
    penaltyAmount = calculatedPenalty;
    const hostUid = event.hostUid || event.orgId;
    if (!hostUid) return;

    const hostRef = doc(db, 'users', hostUid);
    const hostSnap = await transaction.get(hostRef);
    if (!hostSnap.exists()) return;

    const hostData = hostSnap.data();
    const currentBalance = Number(hostData.balance ?? hostData.walletBalance ?? 0);

    const txRef = doc(collection(db, 'transactions'));
    txId = txRef.id;

    // Deduct penalty safely without corrupting wallet
    const actualDeduction = Math.min(currentBalance, penaltyAmount);
    const deficit = Math.max(0, penaltyAmount - currentBalance);

    transaction.update(hostRef, {
      balance: increment(-actualDeduction),
      updatedAt: serverTimestamp(),
    });

    // Record immutable penalty transaction
    transaction.set(txRef, {
      id: txId,
      userId: hostUid,
      type: 'penalty',
      amount: -penaltyAmount,
      currency: 'NPR',
      method: 'Automated 48-Hour Deadline Penalty',
      status: 'completed',
      refId: `PEN-${eventId.slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`,
      desc: `10% Penalty applied for missing 48-hour result deadline on ${event.title || eventId} (${penaltyBaseDescription})`,
      tournamentId: eventId,
      scrimId: eventId,
      timestamp: serverTimestamp(),
    });

    const auditEntry: SettlementAuditEntry = {
      timestamp: new Date().toISOString(),
      action: 'PENALTY_APPLIED',
      actorUid: triggeredBy,
      actorName: 'Automated Deadline Enforcer',
      actorRole: 'system',
      eventId,
      eventType,
      newValue: {
        penaltyAmount,
        penaltyBaseAmount,
        penaltyBaseDescription,
        actualDeduction,
        deficit,
        txId,
      },
      reason: `48-hour result publication deadline passed without official match results. 10% penalty applied.`,
      walletTxId: txId,
    };

    transaction.update(eventRef, {
      penaltyApplied: true,
      penaltyAmount,
      penaltyBase: penaltyBaseDescription,
      penaltyAppliedAt: serverTimestamp(),
      penaltyReason: '48-hour result publication deadline expired without published results',
      penaltyTxId: txId,
      deadlineStatus: 'expired',
      settlementStatus: 'penalty_applied',
      settlementAuditLog: [
        ...(Array.isArray(event.settlementAuditLog) ? event.settlementAuditLog : []),
        auditEntry,
      ],
      updatedAt: serverTimestamp(),
    });

    penaltyApplied = true;
  });

  if (penaltyApplied) {
    NotificationService.create(
      params.eventId,
      '10% Result Deadline Penalty Applied ⚠️',
      `Your 48-hour result deadline has expired. A 10% penalty of Rs. ${penaltyAmount.toLocaleString()} has been charged from your organizer wallet.`,
      'alert',
      `/wallet`
    ).catch(() => {});
  }

  return {
    success: penaltyApplied,
    penaltyAmount,
    message: penaltyApplied
      ? `10% penalty of Rs. ${penaltyAmount.toLocaleString()} automatically deducted.`
      : 'No penalty applied (already processed or deadline not reached).',
  };
}

// ─── 5. Periodic Background Deadline Monitor ──────────────────────────────────

/**
 * Scans all completed tournaments and scrims whose 48-hour result deadline
 * has expired and automatically executes the 10% penalty atomically.
 */
export async function checkAndEnforceEventDeadlines(): Promise<{
  tournamentsChecked: number;
  scrimsChecked: number;
  penaltiesApplied: number;
}> {
  let penaltiesApplied = 0;
  let tournamentsChecked = 0;
  let scrimsChecked = 0;

  try {
    const now = Date.now();

    // 1. Check tournaments
    const tQuery = query(
      collection(db, 'tournaments'),
      where('status', '==', 'completed')
    );
    const tSnap = await getDocs(tQuery);
    tournamentsChecked = tSnap.docs.length;

    for (const d of tSnap.docs) {
      const data = d.data();
      if (data.resultStatus !== 'published' && data.resultStatus !== 'verified' && !data.penaltyApplied) {
        const deadline = parseDateSafe(data.resultDeadlineAt) ||
          (parseDateSafe(data.completedAt) ? new Date(parseDateSafe(data.completedAt)!.getTime() + RESULT_DEADLINE_MS) : null);

        if (deadline && now >= deadline.getTime()) {
          const res = await enforceEventDeadlinePenalty({
            eventId: d.id,
            eventType: 'tournament',
            triggeredBy: 'background_deadline_scanner',
          }).catch((err) => {
            console.warn(`[DeadlineCheck] Tournament ${d.id} penalty error:`, err);
            return { success: false, penaltyAmount: 0, message: '' };
          });
          if (res.success) penaltiesApplied++;
        }
      }
    }

    // 2. Check scrims
    const sQuery = query(
      collection(db, 'scrims'),
      where('status', '==', 'completed')
    );
    const sSnap = await getDocs(sQuery);
    scrimsChecked = sSnap.docs.length;

    for (const d of sSnap.docs) {
      const data = d.data();
      if (data.resultStatus !== 'published' && data.resultStatus !== 'verified' && !data.penaltyApplied) {
        const deadline = parseDateSafe(data.resultDeadlineAt) ||
          (parseDateSafe(data.completedAt) ? new Date(parseDateSafe(data.completedAt)!.getTime() + RESULT_DEADLINE_MS) : null);

        if (deadline && now >= deadline.getTime()) {
          const res = await enforceEventDeadlinePenalty({
            eventId: d.id,
            eventType: 'scrim',
            triggeredBy: 'background_deadline_scanner',
          }).catch((err) => {
            console.warn(`[DeadlineCheck] Scrim ${d.id} penalty error:`, err);
            return { success: false, penaltyAmount: 0, message: '' };
          });
          if (res.success) penaltiesApplied++;
        }
      }
    }
  } catch (err) {
    console.warn('[DeadlineCheck] Error during background scan:', err);
  }

  return { tournamentsChecked, scrimsChecked, penaltiesApplied };
}

// ─── 6. Heartbeat Runner for Active Browser Sessions ─────────────────────────

let heartbeatTimer: any = null;

export function initDeadlineMonitor(intervalSeconds = 60): () => void {
  if (heartbeatTimer) clearInterval(heartbeatTimer);

  // Initial immediate background scan
  checkAndEnforceEventDeadlines().catch(() => {});

  heartbeatTimer = setInterval(() => {
    checkAndEnforceEventDeadlines().catch(() => {});
  }, intervalSeconds * 1000);

  return () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  };
}
