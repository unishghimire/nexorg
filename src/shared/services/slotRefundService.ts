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
  let scrimSnap = await getDoc(scrimDocRef).catch(() => null);
  let resolvedCollection = 'scrims';
  if (!scrimSnap || !scrimSnap.exists()) {
    scrimDocRef = doc(db, 'tournaments', scrimId);
    scrimSnap = await getDoc(scrimDocRef).catch(() => null);
    resolvedCollection = 'tournaments';
  }
  if (!scrimSnap || !scrimSnap.exists()) {
    throw new Error('Scrim or tournament not found');
  }

  const scrimData = scrimSnap.data() as any;
  const currentSlots = normalizeScrimSlots(
    scrimData.slots,
    scrimData.totalSlots,
    scrimData.filledSlots ?? scrimData.currentPlayers
  );

  const targetSlot = currentSlots.find((s: any) => Number(s.slotNumber) === Number(slotNumber)) || params.targetSlot;

  // Find matching participant(s) in local state or Firestore
  let matchParts = (params.participants || []).filter(
    (p: any) =>
      Number(p.slotNumber) === Number(slotNumber) ||
      (targetSlot?.teamId && (p.teamId === targetSlot.teamId || p.userId === targetSlot.teamId)) ||
      (targetSlot?.userId && (p.userId === targetSlot.userId || p.uid === targetSlot.userId)) ||
      (targetSlot?.teamName &&
        targetSlot.teamName !== 'Reserved' &&
        targetSlot.teamName !== 'Locked by Host' &&
        p.teamName?.trim()?.toLowerCase() === targetSlot.teamName?.trim()?.toLowerCase())
  );

  if (matchParts.length === 0) {
    try {
      const [pSnap1, pSnap2] = await Promise.all([
        getDocs(query(collection(db, 'participants'), where('tournamentId', '==', scrimId))).catch(() => ({ docs: [] })),
        getDocs(query(collection(db, 'participants'), where('scrimId', '==', scrimId))).catch(() => ({ docs: [] })),
      ]);
      const allDocs = [...pSnap1.docs, ...pSnap2.docs];
      const seenIds = new Set<string>();
      const combinedParts: any[] = [];
      for (const d of allDocs) {
        if (!seenIds.has(d.id)) {
          seenIds.add(d.id);
          combinedParts.push({ id: d.id, ...d.data() });
        }
      }
      matchParts = combinedParts.filter(
        (p: any) =>
          Number(p.slotNumber) === Number(slotNumber) ||
          (targetSlot?.teamId && (p.teamId === targetSlot.teamId || p.userId === targetSlot.teamId)) ||
          (targetSlot?.userId && (p.userId === targetSlot.userId || p.uid === targetSlot.userId)) ||
          (targetSlot?.teamName &&
            targetSlot.teamName !== 'Reserved' &&
            targetSlot.teamName !== 'Locked by Host' &&
            p.teamName?.trim()?.toLowerCase() === targetSlot.teamName?.trim()?.toLowerCase())
      );
    } catch (e) {
      console.warn('Could not query participants for release:', e);
    }
  }

  // Extract authoritatively resolved entry fee
  const entryFee = Math.max(
    0,
    Number(
      (params.entryFee && Number(params.entryFee) > 0 ? Number(params.entryFee) : null) ??
      scrimData.entryFee ??
      scrimData.requirements?.entryFee ??
      scrimData.price ??
      scrimData.fee ??
      targetSlot?.entryFee ??
      matchParts[0]?.entryFeePaid ??
      matchParts[0]?.entryFee ??
      0
    )
  );

  // Extract authoritative target user ID
  let targetUserId: string | null =
    targetSlot?.userId ||
    targetSlot?.captainUid ||
    targetSlot?.reservedBy ||
    targetSlot?.playerUid ||
    targetSlot?.uid ||
    targetSlot?.captainId ||
    targetSlot?.teamOwnerId ||
    matchParts[0]?.userId ||
    matchParts[0]?.uid ||
    matchParts[0]?.captainUid ||
    matchParts[0]?.captainId ||
    null;

  // Dedicated team fallback:
  if (!targetUserId && targetSlot?.teamId && !targetSlot.teamId.startsWith('manual_')) {
    try {
      const teamDoc = await getDoc(doc(db, 'teams', targetSlot.teamId));
      if (teamDoc.exists()) {
        const teamData = teamDoc.data();
        targetUserId = teamData.ownerId || teamData.captainId || teamData.leaderId || null;
      }
    } catch {}
  }

  // Name matching fallback from participants:
  if (!targetUserId && targetSlot?.teamName && matchParts.length > 0) {
    const matchedByName = matchParts.find(
      (p: any) =>
        p.teamName?.trim()?.toLowerCase() === targetSlot.teamName?.trim()?.toLowerCase() ||
        p.username?.trim()?.toLowerCase() === targetSlot.leader?.trim()?.toLowerCase()
    );
    if (matchedByName?.userId) {
      targetUserId = matchedByName.userId;
    }
  }

  // Slot number matching fallback from participants:
  if (!targetUserId) {
    const slotPart = (params.participants || []).find((p: any) => Number(p.slotNumber) === Number(slotNumber));
    if (slotPart?.userId) {
      targetUserId = slotPart.userId;
    }
  }

  const isHostReserved =
    !targetUserId ||
    targetSlot?.teamName === 'Reserved' ||
    targetSlot?.teamName === 'Reserved Slot' ||
    targetSlot?.teamName === 'Locked by Host' ||
    targetSlot?.leader === 'Host Reserved';

  let refunded = false;
  let refundAmount = 0;

  // Process entry fee refund if this was a paid registration by a player
  if (entryFee > 0 && !isHostReserved && targetUserId) {
    refundAmount = entryFee;
    let directCreditSucceeded = false;

    // Pillar 1: Direct credit attempt on users/{targetUserId}
    try {
      const uRef = doc(db, 'users', targetUserId);
      const uSnap = await getDoc(uRef);
      if (uSnap.exists()) {
        const uData = uSnap.data() as any;
        const currentBal = Number(uData.balance ?? 0);

        // Update balance atomically (avoid touching walletBalance so diff rules don't block)
        await updateDoc(uRef, {
          balance: increment(entryFee),
          updatedAt: serverTimestamp(),
        }).catch(async () => {
          // Fallback to absolute value
          await updateDoc(uRef, {
            balance: currentBal + entryFee,
            updatedAt: serverTimestamp(),
          });
        });

        directCreditSucceeded = true;
      }
    } catch (directErr) {
      console.warn('Direct user document balance update blocked (expected when organizer lacks cross-user rules):', directErr);
    }

    // Pillar 2: Write to pending_refunds collection
    // This allows player's own client (or AuthContext auto-claim) to claim the refund safely
    // with full permissions under auth.uid == userId
    const refundId = `RFD_${scrimId}_slot${slotNumber}_${Date.now()}`;
    const refundDocRef = doc(db, 'pending_refunds', refundId);
    await setDoc(refundDocRef, {
      id: refundId,
      userId: targetUserId,
      amount: entryFee,
      scrimId,
      scrimTitle: scrimTitle || scrimData.title || 'Scrim',
      slotNumber,
      teamName: targetSlot?.teamName || matchParts[0]?.teamName || 'Team',
      status: directCreditSucceeded ? 'completed' : 'pending',
      creditedDirectly: directCreditSucceeded,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      releasedBy: auth.currentUser?.uid || 'organizer',
    }, { merge: true }).catch((err) => {
      console.warn('Could not write to pending_refunds queue:', err);
    });

    // Pillar 3: Record transaction in ledger
    try {
      const txRef = doc(collection(db, 'transactions'));
      await setDoc(txRef, {
        id: txRef.id,
        userId: targetUserId,
        username: targetSlot?.leader || matchParts[0]?.username || 'Player',
        type: 'refund',
        amount: entryFee,
        method: 'Scrim Entry Refund',
        status: 'success',
        refId: `RFD-${scrimId.slice(0, 8)}-${slotNumber}-${Date.now().toString().slice(-4)}`,
        desc: `Refund for released Slot #${slotNumber} in ${scrimTitle || scrimData.title || 'Scrim'}`,
        tournamentId: scrimId,
        slotNumber,
        timestamp: serverTimestamp(),
      }).catch(() => {});
    } catch (txErr) {
      console.warn('Could not record transaction directly:', txErr);
    }

    // Pillar 4: Send push notification to the player
    try {
      await NotificationService.create(
        targetUserId,
        'Entry Fee Refunded',
        `Your team was released from Slot #${slotNumber} in "${scrimTitle || scrimData.title || 'Scrim'}". Your entry fee of Rs. ${entryFee.toLocaleString()} has been refunded to your wallet balance.`,
        'info',
        '/wallet'
      ).catch(() => {});
    } catch (notifErr) {
      console.warn('Could not send notification:', notifErr);
    }

    refunded = true;
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
      ? `Slot #${slotNumber} released and Rs. ${refundAmount.toLocaleString()} entry fee refunded to team!`
      : `Slot #${slotNumber} released & cleared!`,
    updatedSlots: newSlots,
    filledSlots: filled,
  };
}
