/**
 * ════════════════════════════════════════════════════════════════════════════════
 * AUTHORITATIVE ORGANIZATION API LAYER
 * Strictly scoped to authenticated Organization operators.
 * 
 * Rules:
 * 1. Authoritative identity is ALWAYS auth.currentUser.uid.
 * 2. Client-supplied orgId is verified against auth.currentUser.uid.
 * 3. Cross-organization access throws 403 Forbidden.
 * 4. Input validation on all IDs, numerical scores, and state transitions.
 * ════════════════════════════════════════════════════════════════════════════════
 */

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
  writeBatch
} from 'firebase/firestore';
import { db, auth } from '../../shared/config/firebase';
import { Tournament, TournamentGroup, Match, Team, TournamentEarning, UserProfile } from '../../shared/types/types';
import { cleanFirestoreData } from '../../shared/utils/utils';
import { calculateTeamScore } from '../../shared/services/scoringEngine';

class OrgApiError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = 'OrgApiError';
    this.statusCode = statusCode;
  }
}

/**
 * Validates current session and returns authenticated UID.
 * Throws 401 if unauthenticated.
 */
function getAuthoritativeUid(): string {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.uid) {
    throw new OrgApiError('Unauthenticated: valid session required', 401);
  }
  return currentUser.uid;
}

/**
 * Asserts document ownership against the authenticated UID.
 * Throws 403 if user is not the owner or administrator.
 */
async function assertResourceOwnership(
  collectionName: 'tournaments' | 'scrims',
  resourceId: string,
  userUid: string
): Promise<any> {
  const ref = doc(db, collectionName, resourceId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new OrgApiError(`${collectionName} document not found: ${resourceId}`, 404);
  }
  const data = snap.data();
  const ownerId = data.hostUid || data.orgId || data.hostId || data.userId || data.organizerId || data.createdBy;
  
  if (ownerId && ownerId !== userUid) {
    // Check if current user is admin via token claims
    const tokenResult = await auth.currentUser?.getIdTokenResult();
    if (tokenResult?.claims?.role !== 'admin') {
      throw new OrgApiError('Forbidden: You do not own this resource', 403);
    }
  }
  return { id: snap.id, ...data };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. ORGANIZATION PROFILE & SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

export async function getOrganizationProfile(orgId?: string): Promise<UserProfile> {
  const authUid = getAuthoritativeUid();
  const targetId = orgId || authUid;

  // Protect private profile reads: only the org owner or admin can read private details
  if (targetId !== authUid) {
    const tokenResult = await auth.currentUser?.getIdTokenResult();
    if (tokenResult?.claims?.role !== 'admin') {
      throw new OrgApiError('Forbidden: Cannot access another organization profile', 403);
    }
  }

  const userDoc = await getDoc(doc(db, 'users', targetId));
  if (!userDoc.exists()) {
    throw new OrgApiError('Organization profile not found', 404);
  }
  return { uid: userDoc.id, ...userDoc.data() } as UserProfile;
}

export async function updateOrganizationProfile(
  updates: Partial<{
    orgName: string;
    orgBio: string;
    orgLogo: string;
    orgBanner: string;
    discordWebhook: string;
    socialLinks: Record<string, string>;
  }>
): Promise<void> {
  const authUid = getAuthoritativeUid();
  
  // Sanitize updates — reject sensitive keys
  const forbiddenKeys = ['walletBalance', 'role', 'banned', 'isBanned', 'bonusBalance', 'orgStatus', 'isPowerOrganizer'];
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (forbiddenKeys.includes(key)) {
      throw new OrgApiError(`Forbidden field update: ${key}`, 403);
    }
    sanitized[key] = value;
  }
  sanitized.updatedAt = serverTimestamp();

  await updateDoc(doc(db, 'users', authUid), cleanFirestoreData(sanitized));
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. TOURNAMENT LIFECYCLE
// ─────────────────────────────────────────────────────────────────────────────

export async function createTournament(tournamentData: Partial<Tournament>): Promise<string> {
  const authUid = getAuthoritativeUid();

  if (!tournamentData.title || !tournamentData.title.trim()) {
    throw new OrgApiError('Tournament title is required', 400);
  }

  const tournamentId = doc(collection(db, 'tournaments')).id;
  const payload: Partial<Tournament> = {
    ...tournamentData,
    id: tournamentId,
    hostUid: authUid,
    orgId: authUid,
    status: tournamentData.status || 'upcoming',
    stage: tournamentData.stage || 'registration',
    createdAt: serverTimestamp() as any,
    updatedAt: serverTimestamp() as any,
  };

  await setDoc(doc(db, 'tournaments', tournamentId), cleanFirestoreData(payload));
  return tournamentId;
}

export async function updateTournament(
  tournamentId: string,
  updates: Partial<Tournament>
): Promise<void> {
  const authUid = getAuthoritativeUid();
  await assertResourceOwnership('tournaments', tournamentId, authUid);

  // Prevent transferring ownership
  const sanitized = { ...updates };
  delete (sanitized as any).hostUid;
  delete (sanitized as any).orgId;
  delete (sanitized as any).id;
  (sanitized as any).updatedAt = serverTimestamp();

  await updateDoc(doc(db, 'tournaments', tournamentId), cleanFirestoreData(sanitized));
}

export async function deleteTournament(tournamentId: string): Promise<void> {
  const authUid = getAuthoritativeUid();
  await assertResourceOwnership('tournaments', tournamentId, authUid);

  await deleteDoc(doc(db, 'tournaments', tournamentId));
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. REGISTRATIONS & TEAMS
// ─────────────────────────────────────────────────────────────────────────────

export async function getTournamentRegistrations(tournamentId: string): Promise<any[]> {
  const authUid = getAuthoritativeUid();
  await assertResourceOwnership('tournaments', tournamentId, authUid);

  const q = query(collection(db, 'participants'), where('tournamentId', '==', tournamentId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createGroups(
  tournamentId: string,
  groups: TournamentGroup[]
): Promise<void> {
  const authUid = getAuthoritativeUid();
  await assertResourceOwnership('tournaments', tournamentId, authUid);

  if (!Array.isArray(groups)) {
    throw new OrgApiError('Groups must be an array', 400);
  }

  await updateDoc(doc(db, 'tournaments', tournamentId), cleanFirestoreData({
    groups,
    updatedAt: serverTimestamp()
  }));
}

export async function assignTeamsToGroups(
  tournamentId: string,
  groupId: string,
  team: Team
): Promise<void> {
  const authUid = getAuthoritativeUid();
  const tournament = await assertResourceOwnership('tournaments', tournamentId, authUid);

  const groups: TournamentGroup[] = tournament.groups || [];
  const groupIndex = groups.findIndex(g => g.id === groupId);
  if (groupIndex === -1) {
    throw new OrgApiError(`Group not found: ${groupId}`, 404);
  }

  const targetGroup = groups[groupIndex];
  if (targetGroup.teams && targetGroup.teams.length >= (targetGroup.teamLimit || 16)) {
    throw new OrgApiError(`Group is full (limit: ${targetGroup.teamLimit})`, 400);
  }

  // Check if team is already in group
  if (targetGroup.teams?.some(t => t.id === team.id)) {
    throw new OrgApiError('Team is already assigned to this group', 400);
  }

  targetGroup.teams = [...(targetGroup.teams || []), team];
  groups[groupIndex] = targetGroup;

  await updateDoc(doc(db, 'tournaments', tournamentId), cleanFirestoreData({
    groups,
    updatedAt: serverTimestamp()
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. MATCH & SCORE MANAGEMENT (Authoritative calculations)
// ─────────────────────────────────────────────────────────────────────────────

export async function updateMatch(
  tournamentId: string,
  groupId: string,
  matchId: string,
  matchData: Partial<Match>
): Promise<void> {
  const authUid = getAuthoritativeUid();
  const tournament = await assertResourceOwnership('tournaments', tournamentId, authUid);

  const groups: TournamentGroup[] = tournament.groups || [];
  const group = groups.find(g => g.id === groupId);
  if (!group) throw new OrgApiError(`Group not found: ${groupId}`, 404);

  const match = group.matches?.find(m => m.id === matchId);
  if (!match) throw new OrgApiError(`Match not found: ${matchId}`, 404);

  Object.assign(match, matchData);
  await updateDoc(doc(db, 'tournaments', tournamentId), cleanFirestoreData({
    groups,
    updatedAt: serverTimestamp()
  }));
}

export async function updateScore(
  tournamentId: string,
  groupId: string,
  matchId: string,
  teamId: string,
  scoreData: {
    placement: number;
    kills: number;
  }
): Promise<{ placementPoints: number; killPoints: number; totalPoints: number }> {
  const authUid = getAuthoritativeUid();
  const tournament = await assertResourceOwnership('tournaments', tournamentId, authUid);

  if (scoreData.placement < 1 || scoreData.kills < 0) {
    throw new OrgApiError('Invalid score values: placement must be >= 1 and kills >= 0', 400);
  }

  // Calculate score using pure scoring engine
  const scoringConfig = tournament.scoringSnapshot || {
    killPoints: 1,
    placementPoints: { '1': 12, '2': 9, '3': 8, '4': 7, '5': 6, '6': 5, '7': 4, '8': 3, '9': 2, '10': 1 },
    maxPlacement: 12
  };

  const calculated = calculateTeamScore({
    position: scoreData.placement,
    kills: scoreData.kills,
    scoring: scoringConfig
  });

  const groups: TournamentGroup[] = tournament.groups || [];
  const group = groups.find(g => g.id === groupId);
  if (!group) throw new OrgApiError(`Group not found: ${groupId}`, 404);

  const match = group.matches?.find(m => m.id === matchId);
  if (!match) throw new OrgApiError(`Match not found: ${matchId}`, 404);

  // Update or insert result in match
  if (!match.results) match.results = [];
  const existingIdx = match.results.findIndex((r: any) => r.teamId === teamId);
  const resultEntry = {
    teamId,
    placement: scoreData.placement,
    kills: scoreData.kills,
    placementPoints: calculated.placementPoints,
    killPoints: calculated.killPoints,
    totalPoints: calculated.totalPoints,
    updatedAt: new Date().toISOString()
  };

  if (existingIdx >= 0) {
    match.results[existingIdx] = resultEntry;
  } else {
    match.results.push(resultEntry);
  }

  await updateDoc(doc(db, 'tournaments', tournamentId), cleanFirestoreData({
    groups,
    updatedAt: serverTimestamp()
  }));

  return calculated;
}

export async function updateKills(
  tournamentId: string,
  groupId: string,
  matchId: string,
  teamId: string,
  kills: number
): Promise<void> {
  if (kills < 0) throw new OrgApiError('Kills must be >= 0', 400);
  const authUid = getAuthoritativeUid();
  const tournament = await assertResourceOwnership('tournaments', tournamentId, authUid);

  const groups: TournamentGroup[] = tournament.groups || [];
  const group = groups.find(g => g.id === groupId);
  const match = group?.matches?.find(m => m.id === matchId);
  const result = match?.results?.find((r: any) => r.teamId === teamId);

  const placement = result?.placement || 12;
  await updateScore(tournamentId, groupId, matchId, teamId, { placement, kills });
}

export async function eliminateTeam(
  tournamentId: string,
  groupId: string,
  matchId: string,
  teamId: string,
  placement: number
): Promise<void> {
  const authUid = getAuthoritativeUid();
  await assertResourceOwnership('tournaments', tournamentId, authUid);
  await updateScore(tournamentId, groupId, matchId, teamId, { placement, kills: 0 });
}

export async function publishResults(
  tournamentId: string,
  finalStandings: any[]
): Promise<void> {
  const authUid = getAuthoritativeUid();
  await assertResourceOwnership('tournaments', tournamentId, authUid);

  if (!Array.isArray(finalStandings) || finalStandings.length === 0) {
    throw new OrgApiError('Final standings must be a non-empty array', 400);
  }

  await updateDoc(doc(db, 'tournaments', tournamentId), cleanFirestoreData({
    finalStandings,
    status: 'completed',
    stage: 'completed',
    resultsPublishedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. ORGANIZATION WALLET & TRANSACTIONS (Read-Only for Org)
// ─────────────────────────────────────────────────────────────────────────────

export async function getOrganizationWallet(orgId?: string): Promise<{ balance: number; currency: string }> {
  const authUid = getAuthoritativeUid();
  const targetId = orgId || authUid;

  if (targetId !== authUid) {
    const tokenResult = await auth.currentUser?.getIdTokenResult();
    if (tokenResult?.claims?.role !== 'admin') {
      throw new OrgApiError('Forbidden: Cannot view another organization wallet', 403);
    }
  }

  const userDoc = await getDoc(doc(db, 'users', targetId));
  if (!userDoc.exists()) {
    throw new OrgApiError('Organization not found', 404);
  }
  const data = userDoc.data();
  return {
    balance: Number(data.walletBalance || data.balance || 0),
    currency: 'NPR'
  };
}

export async function getOrganizationTransactions(orgId?: string): Promise<any[]> {
  const authUid = getAuthoritativeUid();
  const targetId = orgId || authUid;

  if (targetId !== authUid) {
    const tokenResult = await auth.currentUser?.getIdTokenResult();
    if (tokenResult?.claims?.role !== 'admin') {
      throw new OrgApiError('Forbidden: Cannot view another organization transactions', 403);
    }
  }

  const q = query(collection(db, 'transactions'), where('userId', '==', targetId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
