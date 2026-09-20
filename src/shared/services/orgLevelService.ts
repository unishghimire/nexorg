import { doc, getDoc, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { calculateLevel, MAX_LEVEL_XP, ORG_EXP_REWARDS } from '../utils/utils';
import { NotificationService } from './NotificationService';

export interface AwardOrgExpResult {
  newXp: number;
  newLevel: number;
  leveledUp: boolean;
}

/**
 * Awards Organization EXP to the host user, recalculates organization level,
 * and triggers a notification if the organization leveled up.
 */
export async function awardOrgExp(
  hostUid: string,
  expAmount: number,
  reason?: string
): Promise<AwardOrgExpResult | null> {
  if (!hostUid || expAmount <= 0) return null;

  try {
    const userRef = doc(db, 'users', hostUid);
    let leveledUp = false;
    let newLevel = 1;
    let newOrgXp = 0;

    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) return;

      const userData = userSnap.data();
      const currentOrgXp = Math.max(0, Number(userData.orgXp ?? userData.xp ?? 0));
      const oldLevel = calculateLevel(currentOrgXp);

      newOrgXp = Math.min(MAX_LEVEL_XP, currentOrgXp + expAmount);
      newLevel = calculateLevel(newOrgXp);
      leveledUp = newLevel > oldLevel;

      transaction.update(userRef, {
        orgXp: newOrgXp,
        orgLevel: newLevel,
        xp: Math.max(Number(userData.xp || 0), newOrgXp),
        level: Math.max(Number(userData.level || 1), newLevel),
        updatedAt: serverTimestamp(),
      });
    });

    if (leveledUp) {
      NotificationService.create(
        hostUid,
        'Organization Leveled Up! 🎉',
        `Congratulations! Your organization has reached Level ${newLevel}. Keep creating and completing events to level up further!`,
        'success',
        '/organizer'
      ).catch(() => {});
    }

    return {
      newXp: newOrgXp,
      newLevel,
      leveledUp,
    };
  } catch (err) {
    console.warn(`[orgLevelService] Failed to award ${expAmount} EXP to host ${hostUid} (${reason}):`, err);
    return null;
  }
}

/**
 * Awards completion EXP for a scrim (+60 EXP) or tournament (+80 EXP)
 * with idempotency protection against duplicate awards.
 */
export async function awardOrgEventCompletionExp(
  eventId: string,
  eventType: 'scrim' | 'tournament',
  hostUid?: string
): Promise<boolean> {
  if (!eventId?.trim()) return false;

  const targetCollection = eventType === 'scrim' ? 'scrims' : 'tournaments';
  const eventRef = doc(db, targetCollection, eventId.trim());

  try {
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists()) return false;

    const data = eventSnap.data();
    if (data.orgExpAwardedForComplete) {
      // Already awarded completion EXP
      return false;
    }

    const resolvedHostUid = hostUid?.trim() || data.hostUid || data.createdBy || data.userId || data.orgId;
    if (!resolvedHostUid) return false;

    // Atomically mark completion EXP as awarded
    await updateDoc(eventRef, {
      orgExpAwardedForComplete: true,
      updatedAt: serverTimestamp(),
    }).catch(() => {});

    const expAmount =
      eventType === 'scrim'
        ? ORG_EXP_REWARDS.SCRIM_COMPLETED
        : ORG_EXP_REWARDS.TOURNAMENT_COMPLETED;

    await awardOrgExp(
      resolvedHostUid,
      expAmount,
      `Completed ${eventType}: "${data.title || eventId}"`
    );

    return true;
  } catch (err) {
    console.warn(`[orgLevelService] Error in awardOrgEventCompletionExp for ${eventId}:`, err);
    return false;
  }
}
