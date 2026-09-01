import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, query, where, getDocs, getDoc, doc, updateDoc, deleteDoc, setDoc, serverTimestamp, increment, writeBatch, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../../../shared/config/firebase';
import { useAuth } from '../../../shared/context/AuthContext';
import { Tournament, Participant, Transaction } from '../../../shared/types/types';
import { fetchRoomCredentials } from '../../../shared/services/roomCredentials';
import { commitFirestoreBatches } from '../../../shared/utils/firestoreBatches';
import { toDateSafe } from '../../../shared/utils/utils';
import { countFilledScrimSlots, normalizeScrimSlots, getSlotCount, getFilledSlotCount } from '../../../shared/utils/scrimSlots';

export function useOrgData() {
  const { user, profile } = useAuth();
  const [hostedTournaments, setHostedTournaments] = useState<Tournament[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [orgEarnings, setOrgEarnings] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHostedTournaments = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [tSnap, sSnap] = await Promise.all([
        getDocs(query(collection(db, 'tournaments'), where('hostUid', '==', user.uid))),
        getDocs(query(collection(db, 'scrims'), where('hostUid', '==', user.uid))).catch(() => ({ docs: [] } as any)),
      ]);

      const seenIds = new Set<string>();
      const combinedDocs = [...tSnap.docs, ...sSnap.docs].filter(d => {
        if (seenIds.has(d.id)) return false;
        seenIds.add(d.id);
        return true;
      });

      const tours = await Promise.all(combinedDocs.map(async d => {
        const tournament = { id: d.id, ...d.data() } as Tournament;
        if (tournament.status !== 'live') return tournament;
        const credentials = await fetchRoomCredentials(tournament.id);
        return credentials ? { ...tournament, ...credentials } : tournament;
      }));
      tours.sort((a, b) => {
        const aTime = toDateSafe(a.createdAt)?.getTime() || 0;
        const bTime = toDateSafe(b.createdAt)?.getTime() || 0;
        return bTime - aTime;
      });
      setHostedTournaments(tours);
    } catch (err) {
      console.error("Error fetching hosted tournaments:", err);
      setError("Failed to load tournaments. Please retry.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Pure Tournaments (strictly excluding all scrims)
  const tournamentsOnly = useMemo(() =>
    hostedTournaments.filter(t => (t as any).matchType !== 'scrims' && (t as any).isScrim !== true && (t as any).type !== 'scrim' && (t as any).type !== 'scrims'),
    [hostedTournaments]
  );

  // Pure Scrims (strictly excluding all standard tournaments)
  const scrims = useMemo(() =>
    hostedTournaments.filter(t => (t as any).matchType === 'scrims' || (t as any).isScrim === true || (t as any).type === 'scrim' || (t as any).type === 'scrims' || (t.title && t.title.toLowerCase().includes('scrim'))),
    [hostedTournaments]
  );

  const matchRooms = useMemo(() =>
    hostedTournaments.filter(t => t.status === 'live'),
    [hostedTournaments]
  );

  const teams = useMemo(() => {
    const teamMap: Record<string, { id: string; name: string; logoUrl?: string; players?: string[]; tournamentId?: string; rosterLocked?: boolean; strikes?: number; banned?: boolean; banReason?: string }> = {};
    participants.forEach(p => {
      const teamId = p.teamId || p.userId;
      if (!teamMap[teamId]) {
        teamMap[teamId] = {
          id: teamId,
          name: p.teamName || p.username,
          logoUrl: p.logoUrl,
          players: p.teammates ? [p.username, ...p.teammates] : [p.username],
          tournamentId: p.tournamentId,
          rosterLocked: false,
          strikes: 0,
          banned: false,
        };
      }
    });
    return Object.values(teamMap);
  }, [participants]);

  const activityFeed = useMemo(() => {
    const iconFor = (status: string) => {
      if (status === 'live') return 'radio';
      if (status === 'completed') return 'trophy';
      if (status === 'published') return 'trophy';
      return 'activity';
    };
    const timeFor = (ts: any) => {
      const d = toDateSafe(ts);
      if (!d) return '';
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };
    return hostedTournaments
      .slice(0, 10)
      .map(t => ({
        id: t.id,
        icon: iconFor(t.status),
        text: `${t.title} — ${t.status}`,
        time: timeFor(t.createdAt),
        type: 'tournament',
      }));
  }, [hostedTournaments]);

  // Compute KPIs from real tournament data
  const kpis = useMemo(() => {
    const active = hostedTournaments.filter(t => t.status === 'live' || t.status === 'upcoming' || t.status === 'published').length;
    const prizePool = hostedTournaments.reduce((sum, t) => sum + (t.prizePool || 0), 0);
    const filledSlots = hostedTournaments.reduce((sum, t) => sum + getFilledSlotCount(t), 0);
    const totalSlots = hostedTournaments.reduce((sum, t) => sum + getSlotCount(t), 0);
    const pendingPayouts = orgEarnings
      .filter(e => e.status === 'pending')
      .reduce((sum, e) => sum + (e.orgShare || 0), 0);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyRevenue = orgEarnings
      .reduce((sum, e) => {
        const earnedAt = toDateSafe((e as any).createdAt)?.getTime() || 0;
        return earnedAt >= monthStart.getTime() ? sum + (e.orgShare || 0) : sum;
      }, 0);

    const escrowBalance = hostedTournaments
      .filter(t => t.status === 'live' || t.status === 'upcoming')
      .reduce((sum, t) => sum + (t.prizePool || 0), 0);

    return {
      activeTournaments: active,
      liveScrims: scrims.filter(s => s.status === 'live').length,
      totalTeams: teams.length,
      totalSlots,
      filledSlots,
      prizePool,
      monthlyRevenue,
      pendingPayouts,
      orgWalletBalance: profile?.orgWalletBalance || profile?.balance || 0,
      escrowBalance,
    };
  }, [hostedTournaments, orgEarnings, profile, scrims, teams]);

  const fetchParticipants = useCallback(async (tournamentId?: string) => {
    if (!user || hostedTournaments.length === 0) {
      setParticipants([]);
      return;
    }
    try {
      if (tournamentId) {
        const q = query(collection(db, 'participants'), where('tournamentId', '==', tournamentId));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Participant));
        setParticipants(list);
        return;
      }

      const tournamentIds = hostedTournaments.map(t => t.id).filter(Boolean);
      if (tournamentIds.length === 0) {
        setParticipants([]);
        return;
      }

      const batches = Array.from({ length: Math.ceil(tournamentIds.length / 10) }, (_, index) =>
        tournamentIds.slice(index * 10, (index + 1) * 10)
      );
      const snapshots = await Promise.all(
        batches.map(ids => getDocs(query(collection(db, 'participants'), where('tournamentId', 'in', ids))))
      );
      const list = snapshots.flatMap(snap => snap.docs.map(d => ({ id: d.id, ...d.data() } as Participant)));
      list.sort((a, b) => {
        const aTime = toDateSafe(a.timestamp)?.getTime() || 0;
        const bTime = toDateSafe(b.timestamp)?.getTime() || 0;
        return bTime - aTime;
      });
      setParticipants(list);
    } catch (err) {
      console.error("Error fetching participants:", err);
    }
  }, [user, hostedTournaments]);

  const fetchTransactions = useCallback(async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'transactions'),
        where('userId', '==', user.uid),
        orderBy('timestamp', 'desc'),
        limit(50)
      );
      const snap = await getDocs(q);
      const txs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
      setTransactions(txs);
    } catch (err) {
      console.error("Error fetching transactions:", err);
    }
  }, [user]);

  // Org-scoped earnings (server-created by /api/wallet/distribute-prizes) — the
  // source of truth for the organizer's revenue/payout KPIs, not personal wallet txs.
  const fetchOrgEarnings = useCallback(async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'tournamentEarnings'),
        where('orgId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(200)
      );
      const snap = await getDocs(q);
      setOrgEarnings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error fetching org earnings:", err);
    }
  }, [user]);

  // Fetch disputes for tournaments and scrims owned by this organizer
  const fetchDisputes = useCallback(async () => {
    if (!user) {
      setDisputes([]);
      return;
    }
    try {
      const disputesMap = new Map<string, any>();
      // 1. Query by organizerId
      const orgSnap = await getDocs(query(collection(db, 'disputes'), where('organizerId', '==', user.uid)));
      orgSnap.docs.forEach(d => disputesMap.set(d.id, { id: d.id, ...d.data() }));

      // 2. Query by tournamentIds
      const tournamentIds = hostedTournaments.map(t => t.id).filter(Boolean);
      if (tournamentIds.length > 0) {
        const batches = Array.from({ length: Math.ceil(tournamentIds.length / 10) }, (_, index) =>
          tournamentIds.slice(index * 10, (index + 1) * 10)
        );
        const snapshots = await Promise.all(
          batches.map(ids => getDocs(query(collection(db, 'disputes'), where('tournamentId', 'in', ids))))
        );
        snapshots.forEach(snap => snap.docs.forEach(d => disputesMap.set(d.id, { id: d.id, ...d.data() })));
      }

      const list = Array.from(disputesMap.values());
      list.sort((a, b) => {
        const aTime = toDateSafe(a.createdAt || a.filedAt)?.getTime() || 0;
        const bTime = toDateSafe(b.createdAt || b.filedAt)?.getTime() || 0;
        return bTime - aTime;
      });
      setDisputes(list);
    } catch (err) {
      console.error("Error fetching disputes:", err);
    }
  }, [user, hostedTournaments]);

  // --- Write operations ---

  // Ownership guard — every organizer write to a tournament-scoped resource must
  // pass through here so an organizer can never act on another org's data.
  const assertTournamentHost = useCallback(async (tournamentId: string) => {
    if (!user) throw new Error('Not authenticated');
    let tSnap = await getDocs(query(collection(db, 'tournaments'), where('__name__', '==', tournamentId)));
    if (tSnap.empty) {
      tSnap = await getDocs(query(collection(db, 'scrims'), where('__name__', '==', tournamentId)));
    }
    if (tSnap.empty) throw new Error('Tournament or scrim not found');
    const data = tSnap.docs[0].data();
    const ownerId = data.hostUid || data.orgId || data.hostId || data.userId || data.organizerId || data.createdBy;
    if (ownerId !== user.uid && profile?.role !== 'admin') {
      throw new Error('Not authorized — you do not own this tournament or scrim');
    }
  }, [user, profile?.role]);

  const deleteTournament = useCallback(async (id: string) => {
    if (!user) throw new Error('Not authenticated');
    const token = await auth.currentUser?.getIdToken();
    let deleted = false;
    let lastErrorMsg = '';

    if (token) {
      try {
        let res = await fetch(`/api/tournaments/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) {
          // Fallback attempt with /api/scrims
          res = await fetch(`/api/scrims/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
          });
        }
        if (res.ok) {
          deleted = true;
        } else {
          const errData = await res.json().catch(() => ({}));
          lastErrorMsg = errData.message || '';
        }
      } catch (err: any) {
        console.warn('API delete request failed, attempting direct Firestore delete:', err);
      }
    }

    if (!deleted) {
      try {
        await assertTournamentHost(id);
        await deleteDoc(doc(db, 'tournaments', id)).catch(() => {});
        await deleteDoc(doc(db, 'scrims', id)).catch(() => {});
        deleted = true;
      } catch (fsErr: any) {
        throw new Error(lastErrorMsg || fsErr.message || 'Failed to delete tournament or scrim');
      }
    }

    setHostedTournaments(prev => prev.filter(t => t.id !== id));
  }, [user, assertTournamentHost]);

  const updateTournamentStatus = useCallback(async (id: string, status: Tournament['status']) => {
    await assertTournamentHost(id);
    try {
      await updateDoc(doc(db, 'tournaments', id), { status });
    } catch {
      await updateDoc(doc(db, 'scrims', id), { status }).catch(() => {});
    }
    setHostedTournaments(prev => prev.map(t => t.id === id ? { ...t, status } : t));
  }, [assertTournamentHost]);

  const broadcastLobby = useCallback(async (tournamentId: string, roomId: string, roomPass: string, ytLink: string) => {
    await assertTournamentHost(tournamentId);
    await Promise.all([
      setDoc(doc(db, 'tournaments', tournamentId, 'credentials', 'main'), { roomId, roomPass }, { merge: true }),
      updateDoc(doc(db, 'tournaments', tournamentId), { ytLink }),
    ]);
    setHostedTournaments(prev => prev.map(t => t.id === tournamentId ? { ...t, roomId, roomPass, ytLink } : t));
  }, [assertTournamentHost]);

  const updateParticipantStatus = useCallback(async (participantId: string, status: 'approved' | 'rejected', tournamentId: string) => {
    await assertTournamentHost(tournamentId);
    const batch = writeBatch(db);
    batch.update(doc(db, 'participants', participantId), { status });
    const inc = status === 'approved' ? 1 : -1;
    batch.update(doc(db, 'tournaments', tournamentId), { currentPlayers: increment(inc) });
    await batch.commit();
    setParticipants(prev => prev.map(p => p.id === participantId ? { ...p, status } : p));
  }, [assertTournamentHost]);

  const requestWithdrawal = useCallback(async (amount: number, method: string, details: string) => {
    if (!user) throw new Error('Not authenticated');
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Authentication required');
    const res = await fetch('/api/wallet/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ amount, method, accountDetails: details }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Withdrawal failed');
  }, [user]);

  const broadcastAnnouncement = useCallback(async (tournamentId: string, message: string, tournamentTitle: string) => {
    const tDoc = await getDocs(query(collection(db, 'tournaments'), where('__name__', '==', tournamentId)));
    if (tDoc.empty) throw new Error('Tournament not found');
    const tData = tDoc.docs[0].data();
    if (tData.hostUid !== user?.uid) throw new Error('Not authorized — you do not own this tournament');

    const pQuery = query(collection(db, 'participants'), where('tournamentId', '==', tournamentId));
    const pSnap = await getDocs(pQuery);
    const parts = pSnap.docs.map(d => d.data() as Participant);
    if (parts.length === 0) return 0;
    const notificationOperations = parts.map(p => (batch: any) => {
      const notifRef = doc(collection(db, 'notifications'));
      batch.set(notifRef, {
        userId: p.userId,
        title: `Announcement: ${tournamentTitle}`,
        message,
        type: 'alert',
        read: false,
        timestamp: serverTimestamp(),
      });
    });
    await commitFirestoreBatches(db, notificationOperations);
    return parts.length;
  }, [user]);

  const saveOrgSettings = useCallback(async (settings: { orgName?: string; bio?: string; whatsapp?: string; contactInfo?: string; discord?: string; youtubeUrl?: string; twitchUrl?: string; refereeName?: string; refereeEnabled?: boolean; casterName?: string; casterEnabled?: boolean }) => {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid), settings);
    if (settings.orgName) {
      await updateDoc(doc(db, 'users_public', user.uid), {
        orgName: settings.orgName,
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }
  }, [user]);

  const toggleScrimSlot = useCallback(async (scrimId: string, slotNumber: number) => {
    if (!user) throw new Error('Not authenticated');
    let targetDocRef = doc(db, 'tournaments', scrimId);
    let snap = await getDoc(targetDocRef);
    let targetCollection = 'tournaments';
    if (!snap.exists()) {
      targetDocRef = doc(db, 'scrims', scrimId);
      snap = await getDoc(targetDocRef);
      targetCollection = 'scrims';
    }
    if (!snap.exists()) throw new Error('Scrim not found');
    const data = snap.data() as any;
    if (data.hostUid !== user.uid && profile?.role !== 'admin') throw new Error('Not authorized');

    const currentSlots = normalizeScrimSlots(data.slots, data.totalSlots, data.filledSlots ?? data.currentPlayers);
    const newSlots = currentSlots.map((s: any) => {
      if (s.slotNumber !== slotNumber) return s;
      if (s.status === 'filled') return { ...s, status: 'open', teamName: null, teamId: null };
      return { ...s, status: 'filled', teamName: 'Reserved', teamId: null };
    });
    const filled = countFilledScrimSlots(newSlots);
    await updateDoc(targetDocRef, { slots: newSlots, filledSlots: filled, currentPlayers: filled });
    const altCollection = targetCollection === 'tournaments' ? 'scrims' : 'tournaments';
    await updateDoc(doc(db, altCollection, scrimId), { slots: newSlots, filledSlots: filled, currentPlayers: filled }).catch(() => {});

    setHostedTournaments(prev => prev.map(t => t.id === scrimId
      ? { ...t, slots: newSlots as any, filledSlots: filled, currentPlayers: filled }
      : t
    ));
  }, [user, profile?.role]);

  const toggleRosterLock = useCallback(async (teamId: string) => {
    if (!user) throw new Error('Not authenticated');
    let q = query(collection(db, 'participants'), where('teamId', '==', teamId));
    let snap = await getDocs(q);
    if (snap.empty) {
      q = query(collection(db, 'participants'), where('userId', '==', teamId));
      snap = await getDocs(q);
    }
    if (snap.empty) throw new Error('Team not found');
    
    const pDoc = snap.docs[0];
    const current = pDoc.data() as any;
    const tournamentId = current.tournamentId;
    await assertTournamentHost(tournamentId);

    const newLockState = !current.rosterLocked;
    await updateDoc(pDoc.ref, { rosterLocked: newLockState });
    setParticipants(prev => prev.map(p => (p.teamId === teamId || p.userId === teamId) ? { ...p, rosterLocked: newLockState } : p));
  }, [user, assertTournamentHost]);

  const issueWarning = useCallback(async (teamName: string, reason: string) => {
    if (!user) throw new Error('Not authenticated');
    const q = query(collection(db, 'participants'), where('teamName', '==', teamName));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error('Team not found');
    const pDoc = snap.docs[0];
    const current = pDoc.data() as any;
    const tournamentId = current.tournamentId;
    await assertTournamentHost(tournamentId);

    const newStrikes = (current.strikes || 0) + 1;
    await updateDoc(pDoc.ref, { strikes: newStrikes, lastWarning: reason, lastWarningAt: serverTimestamp() });
    setParticipants(prev => prev.map(p => p.teamName === teamName ? { ...p, strikes: newStrikes, lastWarning: reason } : p));
  }, [user, assertTournamentHost]);

  const toggleBanTeam = useCallback(async (teamId: string, teamName: string) => {
    if (!user) throw new Error('Not authenticated');
    let q = query(collection(db, 'participants'), where('teamId', '==', teamId));
    let snap = await getDocs(q);
    if (snap.empty) {
      q = query(collection(db, 'participants'), where('teamName', '==', teamName));
      snap = await getDocs(q);
    }
    if (snap.empty) throw new Error('Team not found');
    const pDoc = snap.docs[0];
    const current = pDoc.data() as any;
    const tournamentId = current.tournamentId;
    await assertTournamentHost(tournamentId);

    const newBanState = !current.banned;
    await updateDoc(pDoc.ref, { banned: newBanState });
    setParticipants(prev => prev.map(p => (p.teamId === teamId || p.teamName === teamName) ? { ...p, banned: newBanState } : p));
  }, [user, assertTournamentHost]);

  const resolveDispute = useCallback(async (disputeId: string, action: 'warn' | 'ban' | 'dismiss') => {
    if (!user) throw new Error('Not authenticated');
    const dRef = doc(db, 'disputes', disputeId);
    const dSnap = await getDoc(dRef);
    if (!dSnap.exists()) throw new Error('Dispute not found');
    const tournamentId = dSnap.data().tournamentId as string | undefined;
    if (!tournamentId) throw new Error('Dispute has no tournament reference');
    await assertTournamentHost(tournamentId);
    const status = action === 'dismiss' ? 'dismissed' : 'resolved';
    await updateDoc(dRef, {
      status,
      resolvedAt: serverTimestamp(),
      resolvedBy: user.uid,
      resolutionAction: action,
    });
    setDisputes(prev => prev.map(d => d.id === disputeId ? { ...d, status } : d));
  }, [user, assertTournamentHost]);

  useEffect(() => {
    fetchHostedTournaments();
    fetchTransactions();
    fetchOrgEarnings();
  }, [fetchHostedTournaments, fetchTransactions, fetchOrgEarnings]);

  useEffect(() => {
    if (hostedTournaments.length > 0) {
      fetchParticipants();
    }
  }, [hostedTournaments, fetchParticipants]);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  return {
    hostedTournaments,
    tournamentsOnly,
    participants,
    transactions,
    disputes,
    loading,
    error,
    kpis,
    scrims,
    matchRooms,
    teams,
    activityFeed,
    fetchHostedTournaments,
    fetchParticipants,
    fetchTransactions,
    fetchOrgEarnings,
    fetchDisputes,
    deleteTournament,
    updateTournamentStatus,
    broadcastLobby,
    updateParticipantStatus,
    requestWithdrawal,
    broadcastAnnouncement,
    saveOrgSettings,
    toggleScrimSlot,
    toggleRosterLock,
    issueWarning,
    toggleBanTeam,
    resolveDispute,
  };
}
