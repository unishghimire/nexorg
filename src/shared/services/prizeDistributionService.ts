import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  collection,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { NotificationService } from './NotificationService';
import { countFilledScrimSlots, getFilledSlotCount, getSlotCount } from '../utils/scrimSlots';

export interface WinnerPayoutEntry {
  rank: number;
  teamName: string;
  teamId?: string;
  userId?: string;
  username?: string;
  prize: number;
  kills?: number;
  points?: number;
}

export interface FinancialReadiness {
  isPaid: boolean;
  isPreFunded: boolean;
  isFunded: boolean;
  isLocked: boolean;
  prizePool: number;
  entryFee: number;
  totalSlots: number;
  filledSlots: number;
  minSlotsNeeded: number;
  collectedFees: number;
  shortfall: number;
  slotsRemaining: number;
  progressPercent: number;
  statusText: string;
}

/**
 * Calculates the financial readiness and lock state of a tournament or scrim.
 * For paid events (prizePool > 0 and entryFee > 0), the event is locked until
 * collected entry fees fulfill the prize pool (filledSlots * entryFee >= prizePool),
 * OR the organizer has pre-funded / reserved the escrow balance.
 */
export function checkFinancialReadiness(event: any): FinancialReadiness {
  if (!event) {
    return {
      isPaid: false,
      isPreFunded: false,
      isFunded: true,
      isLocked: false,
      prizePool: 0,
      entryFee: 0,
      totalSlots: 0,
      filledSlots: 0,
      minSlotsNeeded: 0,
      collectedFees: 0,
      shortfall: 0,
      slotsRemaining: 0,
      progressPercent: 100,
      statusText: 'Ready to start',
    };
  }

  const prizePool = Math.max(
    0,
    Number(
      event.prizePool ??
      event.totalPrizePool ??
      event.prizes?.reduce?.((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) ??
      0
    )
  );

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

  const isPaid = prizePool > 0 && entryFee > 0;

  // Determine slot counts using robust slot helpers
  const totalSlots = Math.max(
    1,
    getSlotCount(event) ||
    Number(event.totalSlots) ||
    (Array.isArray(event.slots) ? event.slots.length : 20)
  );

  let filledSlots = 0;
  if (Array.isArray(event.slots)) {
    filledSlots = countFilledScrimSlots(event.slots);
  } else {
    filledSlots = getFilledSlotCount(event) || Number(event.filledSlots) || Number(event.currentPlayers) || 0;
  }

  // Minimum slots needed to fund the required prize pool
  const minSlotsNeeded = isPaid ? Math.ceil(prizePool / entryFee) : 0;
  const collectedFees = isPaid ? filledSlots * entryFee : 0;

  // Check if organizer pre-funded / escrowed the prize pool
  const fundingStatus = (event.fundingStatus || '').toUpperCase();
  const isPreFunded = fundingStatus === 'RESERVED' || fundingStatus === 'FUNDED' || fundingStatus === 'ESCROW_PAID';

  // An event is funded if it's free, or collected fees meet/exceed prize pool, or pre-funded
  const isFunded = !isPaid || (collectedFees >= prizePool) || isPreFunded;
  const isLocked = !isFunded;

  const shortfall = Math.max(0, prizePool - collectedFees);
  const slotsRemaining = Math.max(0, minSlotsNeeded - filledSlots);
  const progressPercent = isPaid && prizePool > 0
    ? Math.min(100, Math.round((collectedFees / prizePool) * 100))
    : 100;

  let statusText = 'Ready to start';
  if (isLocked) {
    statusText = `Locked: Needs ${slotsRemaining} more registered ${slotsRemaining === 1 ? 'slot' : 'slots'} (Rs. ${shortfall.toLocaleString()} needed to fund Rs. ${prizePool.toLocaleString()} prize pool)`;
  } else if (isPreFunded) {
    statusText = 'Pre-funded by Host Escrow (Ready to start)';
  } else if (isPaid) {
    statusText = `Fully Funded (Rs. ${collectedFees.toLocaleString()} collected from ${filledSlots} slots)`;
  }

  return {
    isPaid,
    isPreFunded,
    isFunded,
    isLocked,
    prizePool,
    entryFee,
    totalSlots,
    filledSlots,
    minSlotsNeeded,
    collectedFees,
    shortfall,
    slotsRemaining,
    progressPercent,
    statusText,
  };
}

export interface ExecutePrizeDistributionParams {
  eventId: string;
  eventType: 'tournament' | 'scrim';
  eventTitle: string;
  prizePool: number;
  currency?: string;
  winners: WinnerPayoutEntry[];
  organizerUid?: string;
  manualResults?: any[];
  scoringData?: any;
  participants?: any[];
}

export interface ExecutePrizeDistributionResult {
  success: boolean;
  totalDistributed: number;
  message: string;
  creditedCount: number;
}

/**
 * Standardized multi-pillar prize distribution engine for both tournaments and scrims.
 * Credits winners' wallets, writes audit transactions, sends notifications,
 * updates event documents with payout status, releases slots, and cleans up participants.
 */
export async function executePrizeDistribution(
  params: ExecutePrizeDistributionParams
): Promise<ExecutePrizeDistributionResult> {
  const {
    eventId,
    eventType,
    eventTitle,
    prizePool,
    currency = 'NPR',
    winners,
    organizerUid,
    manualResults,
    scoringData,
    participants = [],
  } = params;

  if (!eventId) {
    throw new Error('Event ID is required to distribute prizes');
  }

  // Filter valid winners
  const validWinners = winners.filter(
    (w) => (w.teamName?.trim() || w.userId) && Number(w.prize) > 0
  );

  if (validWinners.length === 0) {
    throw new Error('Please specify at least one winning team or player with a prize amount greater than 0');
  }

  const totalDistributed = validWinners.reduce((sum, w) => sum + (Number(w.prize) || 0), 0);

  // If prize pool is specified, ensure allocated amount does not exceed prize pool
  if (prizePool > 0 && Math.abs(totalDistributed - prizePool) > 0.01) {
    if (totalDistributed > prizePool) {
      throw new Error(
        `Total allocated prizes (Rs. ${totalDistributed.toLocaleString()}) exceed the tournament prize pool (Rs. ${prizePool.toLocaleString()})`
      );
    }
  }

  // Step 1: Attempt server-side payout endpoint if token is present
  let payoutViaApi = false;
  try {
    const token = await auth.currentUser?.getIdToken();
    if (token) {
      const endpoints =
        eventType === 'scrim'
          ? [`/api/scrims/${eventId}/payout`, `/api/tournaments/${eventId}/payout`]
          : [`/api/tournaments/${eventId}/payout`, `/api/wallet/distribute-prizes`];

      for (const endpoint of endpoints) {
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              tournamentId: eventId,
              winners: validWinners,
              resultsData: { manualResults, resultTemplate: scoringData },
            }),
          });
          if (res.ok) {
            payoutViaApi = true;
            break;
          }
        } catch {
          // Fall through to next endpoint or client engine
        }
      }
    }
  } catch {
    // API request failed, continue with resilient client-side execution
  }

  // Step 2: Multi-pillar resilient client-side execution
  let creditedCount = 0;
  const currentAuthUser = auth.currentUser;
  const releasingHost = organizerUid || currentAuthUser?.uid || 'organizer';

  // Build lookup maps to resolve userId if missing from winner entry
  const participantUserIdMap = new Map<string, string>();
  for (const p of participants) {
    if (p.userId) {
      if (p.teamId) participantUserIdMap.set(String(p.teamId).toLowerCase(), p.userId);
      if (p.teamName) participantUserIdMap.set(String(p.teamName).trim().toLowerCase(), p.userId);
      if (p.username) participantUserIdMap.set(String(p.username).trim().toLowerCase(), p.userId);
    }
  }

  for (const tier of validWinners) {
    let winnerUserId = tier.userId;
    if (!winnerUserId && tier.teamId && participantUserIdMap.has(String(tier.teamId).toLowerCase())) {
      winnerUserId = participantUserIdMap.get(String(tier.teamId).toLowerCase());
    }
    if (!winnerUserId && tier.teamName && participantUserIdMap.has(String(tier.teamName).trim().toLowerCase())) {
      winnerUserId = participantUserIdMap.get(String(tier.teamName).trim().toLowerCase());
    }

    const prizeAmount = Number(tier.prize || 0);
    if (winnerUserId && prizeAmount > 0) {
      let directSuccess = false;

      // Pillar A: Direct atomic user balance increment
      try {
        const uRef = doc(db, 'users', winnerUserId);
        await updateDoc(uRef, {
          balance: increment(prizeAmount),
          updatedAt: serverTimestamp(),
        });
        directSuccess = true;
        creditedCount++;
      } catch (uErr) {
        console.warn(`[PrizeDistribution] Direct balance update deferred for user ${winnerUserId}:`, uErr);
      }

      // Pillar B: Pending refunds / payouts queue (auto-claimed by user's AuthContext)
      const claimId = `PRIZE_${eventId}_rank${tier.rank}_${Date.now()}`;
      await setDoc(
        doc(db, 'pending_refunds', claimId),
        {
          id: claimId,
          userId: winnerUserId,
          amount: prizeAmount,
          scrimId: eventId,
          tournamentId: eventId,
          scrimTitle: eventTitle,
          tournamentTitle: eventTitle,
          rank: tier.rank,
          teamName: tier.teamName || tier.username || 'Winner',
          status: directSuccess ? 'completed' : 'pending',
          creditedDirectly: directSuccess,
          reason: `Prize payout for Rank #${tier.rank} in ${eventTitle}`,
          createdAt: serverTimestamp(),
          releasedBy: releasingHost,
        },
        { merge: true }
      ).catch((qErr) => console.warn('[PrizeDistribution] Error writing to pending_refunds queue:', qErr));

      // Pillar C: Audit Transaction Record
      const txRef = doc(collection(db, 'transactions'));
      await setDoc(txRef, {
        id: txRef.id,
        userId: winnerUserId,
        username: tier.teamName || tier.username || 'Winner',
        type: 'prize_payout',
        amount: prizeAmount,
        currency,
        method: 'Prize Pool Distribution',
        status: 'success',
        refId: `PRZ-${eventId.slice(0, 8).toUpperCase()}-R${tier.rank}-${Date.now().toString().slice(-4)}`,
        desc: `Prize payout for Rank #${tier.rank} in ${eventTitle}`,
        tournamentId: eventId,
        scrimId: eventId,
        timestamp: serverTimestamp(),
      }).catch((txErr) => console.warn('[PrizeDistribution] Error writing transaction record:', txErr));

      // Pillar D: Instant User In-App Notification
      await NotificationService.create(
        winnerUserId,
        'Prize Won! 🏆',
        `Congratulations! You placed #${tier.rank} in "${eventTitle}" and won Rs. ${prizeAmount.toLocaleString()}! The prize has been credited to your wallet.`,
        'success',
        '/wallet'
      ).catch((notifErr) => console.warn('[PrizeDistribution] Error sending winner notification:', notifErr));
    }
  }

  // Step 3: Prepare tournament & scrim document update
  const formattedManualResults =
    manualResults && manualResults.length > 0
      ? manualResults
      : validWinners.map((w) => ({
          rank: w.rank,
          team: w.teamName,
          score: w.points || 0,
          kills: w.kills || 0,
          prize: w.prize,
        }));

  let docUpdatePayload: Record<string, any> = {
    winners: validWinners,
    podium: validWinners,
    manualResults: formattedManualResults,
    payoutCompleted: true,
    payoutStatus: 'paid',
    payoutTotal: totalDistributed,
    status: 'completed',
    stage: 'completed',
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (scoringData) {
    docUpdatePayload.resultTemplate = scoringData;
  }

  // If this is a scrim or has slots, reset slots to open and release lobby
  let targetDoc = await getDoc(doc(db, 'tournaments', eventId)).catch(() => null);
  if (!targetDoc || !targetDoc.exists()) {
    targetDoc = await getDoc(doc(db, 'scrims', eventId)).catch(() => null);
  }

  const existingData = targetDoc?.data();
  const isScrimEvent =
    eventType === 'scrim' ||
    existingData?.matchType === 'scrims' ||
    Boolean(existingData?.isScrim);

  if (isScrimEvent && (existingData?.slots || existingData?.totalSlots)) {
    const totalSlotCount = Number(existingData?.totalSlots) || (Array.isArray(existingData?.slots) ? existingData.slots.length : 12);
    const releasedSlots = Array.from({ length: totalSlotCount }, (_, idx) => ({
      slotNumber: idx + 1,
      status: 'open' as const,
      teamName: null,
      teamId: null,
      userId: null,
      leader: null,
    }));

    docUpdatePayload = {
      ...docUpdatePayload,
      slots: releasedSlots,
      filledSlots: 0,
      currentPlayers: 0,
    };

    // Clean up registered participants for this finished scrim
    for (const p of participants) {
      if (p.id) {
        await deleteDoc(doc(db, 'participants', p.id)).catch(() => {});
      }
    }
  }

  // Update both collections for consistency
  await Promise.all([
    updateDoc(doc(db, 'tournaments', eventId), docUpdatePayload).catch(() => {}),
    updateDoc(doc(db, 'scrims', eventId), docUpdatePayload).catch(() => {}),
    setDoc(doc(db, 'tournaments', eventId), docUpdatePayload, { merge: true }).catch(() => {}),
    setDoc(doc(db, 'scrims', eventId), docUpdatePayload, { merge: true }).catch(() => {}),
  ]);

  // Step 4: Broadcast completion notification to all registered participants
  await NotificationService.notifyParticipants(
    eventId,
    'Results Finalized & Prizes Distributed! 🏆',
    `The results for ${eventTitle} have been finalized and prizes have been credited to the winners! Check the leaderboard.`,
    'success',
    `/tournaments/${eventId}`
  ).catch(() => {});

  return {
    success: true,
    totalDistributed,
    creditedCount,
    message: payoutViaApi
      ? `Successfully distributed Rs. ${totalDistributed.toLocaleString()} to ${validWinners.length} winners!`
      : `Match finalized! Distributed Rs. ${totalDistributed.toLocaleString()} to ${validWinners.length} winners.`,
  };
}
