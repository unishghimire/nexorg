import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { normalizeScrimSlots, countFilledScrimSlots } from '../utils/scrimSlots';
import { NotificationService } from './NotificationService';

export interface ReleaseSlotRefundParams {
  scrimId: string;
  scrimTitle: string;
  slotNumber: number;
  entryFee?: number;
  targetSlot?: any;
  participants?: any[];
}

export interface ReleaseSlotRefundResult {
  success: boolean;
  refunded: boolean;
  refundAmount: number;
  message: string;
  updatedSlots?: any[];
  filledSlots?: number;
}

/**
 * Releases a scrim/tournament slot and automatically refunds the entry fee money
 * to the team's / registering player's wallet if an entry fee was charged.
 */
export async function releaseSlotWithRefund(
  params: ReleaseSlotRefundParams
): Promise<ReleaseSlotRefundResult> {
  const { scrimId, scrimTitle, slotNumber } = params;
  if (!scrimId || !slotNumber) {
    throw new Error('Invalid scrimId or slotNumber');
  }

  // 1. Attempt server-side atomic release & refund via /api/wallet/release-slot
  try {
    const token = await auth.currentUser?.getIdToken();
    if (token) {
      const res = await fetch('/api/wallet/release-slot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tournamentId: scrimId,
          slotNumber,
          userId: params.targetSlot?.userId || params.participants?.find((p) => p.slotNumber === slotNumber)?.userId,
        }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.success) {
          return {
            success: true,
            refunded: Boolean(data.refunded),
            refundAmount: Number(data.refundAmount || 0),
            message: data.message || `Slot #${slotNumber} released successfully`,
          };
        }
      }
    }
  } catch (apiErr) {
    console.warn('API /api/wallet/release-slot unreachable, falling back to direct Firestore operations:', apiErr);
  }

  // 2. Direct Firestore fallback
  // Fetch scrim document to get authoritative entryFee and slots
  let scrimDocRef = doc(db, 'scrims', scrimId);
  let scrimSnap = await getDoc(scrimDocRef);
  if (!scrimSnap.exists()) {
    scrimDocRef = doc(db, 'tournaments', scrimId);
    scrimSnap = await getDoc(scrimDocRef);
  }
  if (!scrimSnap.exists()) {
    throw new Error('Scrim or tournament not found');
  }

  const scrimData = scrimSnap.data() as any;
  const entryFee = Math.max(0, Number(params.entryFee ?? scrimData.entryFee ?? 0));
  const currentSlots = normalizeScrimSlots(
    scrimData.slots,
    scrimData.totalSlots,
    scrimData.filledSlots ?? scrimData.currentPlayers
  );

  const targetSlot = currentSlots.find((s: any) => s.slotNumber === slotNumber) || params.targetSlot;

  // Find matching participant(s) in local state or Firestore
  let matchParts = (params.participants || []).filter(
    (p: any) =>
      p.slotNumber === slotNumber ||
      (targetSlot?.teamId && (p.teamId === targetSlot.teamId || p.userId === targetSlot.teamId)) ||
      (targetSlot?.userId && p.userId === targetSlot.userId) ||
      (targetSlot?.teamName && targetSlot.teamName !== 'Reserved' && p.teamName === targetSlot.teamName)
  );

  if (matchParts.length === 0) {
    try {
      const pSnap = await getDocs(query(collection(db, 'participants'), where('tournamentId', '==', scrimId)));
      matchParts = pSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter(
          (p: any) =>
            p.slotNumber === slotNumber ||
            (targetSlot?.teamId && (p.teamId === targetSlot.teamId || p.userId === targetSlot.teamId)) ||
            (targetSlot?.userId && p.userId === targetSlot.userId) ||
            (targetSlot?.teamName && targetSlot.teamName !== 'Reserved' && p.teamName === targetSlot.teamName)
        );
    } catch (e) {
      console.warn('Could not query participants for release:', e);
    }
  }

  const targetUserId = targetSlot?.userId || matchParts[0]?.userId;
  const isHostReserved =
    !targetUserId ||
    targetSlot?.teamName === 'Reserved' ||
    targetSlot?.teamName === 'Reserved Slot' ||
    targetSlot?.leader === 'Host Reserved';

  let refunded = false;
  let refundAmount = 0;

  // Process entry fee refund if this was a paid registration by a player
  if (entryFee > 0 && !isHostReserved && targetUserId) {
    try {
      const uRef = doc(db, 'users', targetUserId);
      const uSnap = await getDoc(uRef);
      if (uSnap.exists()) {
        const uData = uSnap.data() as any;
        const currentBal = Number(uData.balance ?? uData.walletBalance ?? 0);

        // Update balance atomically
        await updateDoc(uRef, {
          balance: increment(entryFee),
          walletBalance: increment(entryFee),
        }).catch(async () => {
          await updateDoc(uRef, {
            balance: currentBal + entryFee,
          }).catch(() => {});
        });

        // Insert refund ledger transaction
        const txRef = doc(collection(db, 'transactions'));
        await setDoc(txRef, {
          id: txRef.id,
          userId: targetUserId,
          username: targetSlot?.leader || matchParts[0]?.username || uData.username || 'Player',
          type: 'refund',
          amount: entryFee,
          method: 'Scrim Entry Refund',
          status: 'success',
          refId: `RFD-${scrimId.slice(0, 8)}-${slotNumber}-${Date.now().toString().slice(-4)}`,
          desc: `Refund for released Slot #${slotNumber} in ${scrimTitle || scrimData.title || 'Scrim'}`,
          tournamentId: scrimId,
          slotNumber,
          balanceBefore: currentBal,
          balanceAfter: currentBal + entryFee,
          timestamp: serverTimestamp(),
        });

        // Notify the player
        await NotificationService.create(
          targetUserId,
          'Entry Fee Refunded',
          `Your team was released from Slot #${slotNumber} in "${scrimTitle || scrimData.title || 'Scrim'}". Your entry fee of Rs. ${entryFee.toLocaleString()} has been refunded to your wallet balance.`,
          'info',
          '/wallet'
        );

        refunded = true;
        refundAmount = entryFee;
      }
    } catch (refundErr) {
      console.error('Failed to process wallet refund in client fallback:', refundErr);
    }
  }

  // Update slots in Firestore
  const newSlots = currentSlots.map((s: any) => {
    if (s.slotNumber !== slotNumber) return s;
    return {
      slotNumber: s.slotNumber,
      status: 'open' as const,
      teamName: null,
      teamId: null,
      userId: null,
      leader: null,
      inGameId: null,
      inGameName: null,
      joinedAt: null,
    };
  });

  const filled = countFilledScrimSlots(newSlots);
  const updatePayload = {
    slots: newSlots,
    filledSlots: filled,
    currentPlayers: filled,
    updatedAt: serverTimestamp(),
  };

  await Promise.all([
    updateDoc(doc(db, 'scrims', scrimId), updatePayload).catch(() => {}),
    updateDoc(doc(db, 'tournaments', scrimId), updatePayload).catch(() => {}),
    setDoc(doc(db, 'scrims', scrimId), updatePayload, { merge: true }).catch(() => {}),
    setDoc(doc(db, 'tournaments', scrimId), updatePayload, { merge: true }).catch(() => {}),
  ]);

  // Remove participant documents
  for (const p of matchParts) {
    if (p.id) {
      await deleteDoc(doc(db, 'participants', p.id)).catch(() => {});
    }
  }

  return {
    success: true,
    refunded,
    refundAmount,
    message: refunded
      ? `Slot #${slotNumber} released and Rs. ${refundAmount.toLocaleString()} entry fee refunded to the team!`
      : `Slot #${slotNumber} released & cleared!`,
    updatedSlots: newSlots,
    filledSlots: filled,
  };
}
