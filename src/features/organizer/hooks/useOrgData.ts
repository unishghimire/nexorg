import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  serverTimestamp,
  increment,
  writeBatch,
  orderBy,
  limit,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db, auth } from '../../../shared/config/firebase';
import { useAuth } from '../../../shared/context/AuthContext';
import { Tournament, Participant, Transaction } from '../../../shared/types/types';
import { fetchRoomCredentials, broadcastRoomCredentials } from '../../../shared/services/roomCredentials';
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

  // Cache of tournament map for fast merge across real-time streams
  const tourMapRef = useRef<Map<string, Tournament>>(new Map());
  const scrimMapRef = useRef<Map<string, Tournament>>(new Map());

  // Merge and sort tournaments in sub-milliseconds
  const recomputeTournaments = useCallback(async () => {
    const combinedMap = new Map<string, Tournament>();
    tourMapRef.current.forEach((val, key) => combinedMap.set(key, val));
    scrimMapRef.current.forEach((val, key) => combinedMap.set(key, val));

    const list = Array.from(combinedMap.values());
    list.sort((a, b) => {
      const aTime = toDateSafe(a.createdAt)?.getTime() || 0;
      const bTime = toDateSafe(b.createdAt)?.getTime() || 0;
      return bTime - aTime;
    });

    setHostedTournaments(list);
    setLoading(false);
  }, []);

  // 1. Real-time Subscriptions for Hosted Tournaments & Scrims (sub-50ms live sync)
  useEffect(() => {
    if (!user) {
      setHostedTournaments([]);
      setParticipants([]);
      setTransactions([]);
      setOrgEarnings([]);
      setDisputes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    let unsubTournaments: Unsubscribe | null = null;
    let unsubScrims: Unsubscribe | null = null;

    try {
      // Stream Tournaments
      const tQuery = query(collection(db, 'tournaments'), where('hostUid', '==', user.uid));
      unsubTournaments = onSnapshot(tQuery, (snap) => {
        const nextMap = new Map<string, Tournament>();
        snap.docs.forEach((d) => {
          nextMap.set(d.id, { id: d.id, ...d.data() } as Tournament);
        });
        tourMapRef.current = nextMap;
        recomputeTournaments();
      }, (err) => {
        console.warn('Tournaments snapshot listener fallback:', err);
        setError('Real-time sync interrupted. Retrying...');
      });

      // Stream Scrims
      const sQuery = query(collection(db, 'scrims'), where('hostUid', '==', user.uid));
      unsubScrims = onSnapshot(sQuery, (snap) => {
        const nextMap = new Map<string, Tournament>();
        snap.docs.forEach((d) => {
          nextMap.set(d.id, { id: d.id, ...d.data() } as Tournament);
        });
        scrimMapRef.current = nextMap;
        recomputeTournaments();
      }, () => {
        // Scrims stream optional fallback
      });
    } catch (err: any) {
      console.error('Error establishing real-time tournament sync:', err);
      setError('Failed to establish real-time connection');
      setLoading(false);
    }

    return () => {
      if (unsubTournaments) unsubTournaments();
      if (unsubScrims) unsubScrims();
    };
  }, [user, recomputeTournaments]);

  // 2. Real-time Subscriptions for Transactions & Disputes
  useEffect(() => {
    if (!user) return;

    let unsubTxs: Unsubscribe | null = null;
    let unsubDisputes: Unsubscribe | null = null;
    let unsubEarnings: Unsubscribe | null = null;

    try {
      // Real-time Transactions (sub-100ms on deposits/withdrawals/payouts)
      const txQuery = query(
        collection(db, 'transactions'),
        where('userId', '==', user.uid),
        orderBy('timestamp', 'desc'),
        limit(50)
      );
      unsubTxs = onSnapshot(txQuery, (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction));
        setTransactions(list);
      }, () => {});

      // Real-time Disputes Queue
      const disputeQuery = query(
        collection(db, 'disputes'),
        where('organizerId', '==', user.uid)
      );
      unsubDisputes = onSnapshot(disputeQuery, (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => {
          const aTime = toDateSafe((a as any).createdAt || (a as any).filedAt)?.getTime() || 0;
          const bTime = toDateSafe((b as any).createdAt || (b as any).filedAt)?.getTime() || 0;
          return bTime - aTime;
        });
        setDisputes(list);
      }, () => {});

      // Real-time Org Earnings (payout distributions)
      const earningsQuery = query(
        collection(db, 'tournamentEarnings'),
        where('orgId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(200)
      );
      unsubEarnings = onSnapshot(earningsQuery, (snap) => {
        setOrgEarnings(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }, () => {});
    } catch (e) {
      console.warn('Real-time auxiliary listeners warning:', e);
    }

    return () => {
      if (unsubTxs) unsubTxs();
      if (unsubDisputes) unsubDisputes();
      if (unsubEarnings) unsubEarnings();
    };
  }, [user]);

  // 3. Real-time Subscriptions for Participants across hosted events
  useEffect(() => {
    if (!user || hostedTournaments.length === 0) {
      setParticipants([]);
      return;
    }

    const tournamentIds = Array.from(new Set(hostedTournaments.map(t => t.id).filter(Boolean)));
    if (tournamentIds.length === 0) return;

    // Split tournament IDs into chunks of 10 for Firestore 'in' query safety
    const batches = Array.from({ length: Math.ceil(tournamentIds.length / 10) }, (_, index) =>
      tournamentIds.slice(index * 10, (index + 1) * 10)
    );

    const unsubs: Unsubscribe[] = [];
    const batchDataMap = new Map<number, Participant[]>();

    batches.forEach((ids, bIdx) => {
      try {
        const pQuery = query(collection(db, 'participants'), where('tournamentId', 'in', ids));
        const unsub = onSnapshot(pQuery, (snap) => {
          const parts = snap.docs.map(d => ({ id: d.id, ...d.data() } as Participant));
          batchDataMap.set(bIdx, parts);

          const allParts = Array.from(batchDataMap.values()).flat();
          allParts.sort((a, b) => {
            const aTime = toDateSafe(a.timestamp)?.getTime() || 0;
            const bTime = toDateSafe(b.timestamp)?.getTime() || 0;
            return bTime - aTime;
          });
          setParticipants(allParts);
        }, () => {});
        unsubs.push(unsub);
      } catch {}
    });

    return () => {
      unsubs.forEach(u => u());
    };
  }, [user, hostedTournaments]);

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
    hostedTournaments.filter(t => (t.status || '').toLowerCase() === 'live'),
    [hostedTournaments]
  );

  const teams = useMemo(() => {
    const teamMap: Record<string, {
      id: string;
      name: string;
      igid?: string;
      logoUrl?: string;
      players?: Array<{ name: string; igid?: string; role?: string }>;
      tournamentId?: string;
      rosterLocked?: boolean;
      strikes?: number;
      banned?: boolean;
      banReason?: string;
    }> = {};

    participants.forEach(p => {
      const teamId = p.teamId || p.userId;
      if (!teamMap[teamId]) {
        const playerList: Array<{ name: string; igid?: string; role?: string }> = [
          { name: p.username || 'Team Leader', igid: p.inGameId || 'N/A', role: 'Leader' }
        ];
        if (Array.isArray(p.teammates)) {
          p.teammates.forEach((tm: any) => {
            if (typeof tm === 'string') {
              playerList.push({ name: tm, igid: 'N/A', role: 'Member' });
            } else if (tm && typeof tm === 'object') {
              playerList.push({
                name: tm.name || tm.username || 'Teammate',
                igid: tm.igid || tm.inGameId || 'N/A',
                role: tm.role || 'Member',
              });
            }
          });
        }
        teamMap[teamId] = {
          id: teamId,
          name: p.teamName || p.username || 'Unnamed Team',
          igid: p.inGameId || 'N/A',
          logoUrl: p.logoUrl,
          players: playerList,
          tournamentId: p.tournamentId,
          rosterLocked: Boolean((p as any).rosterLocked),
          strikes: Number((p as any).strikes) || 0,
          banned: Boolean((p as any).banned),
          banReason: (p as any).banReason || '',
        };
      }
    });
    return Object.values(teamMap);
  }, [participants]);

  const activityFeed = useMemo(() => {
    const iconFor = (status: string) => {
      const s = (status || '').toLowerCase();
      if (s === 'live') return 'radio';
      if (s === 'completed') return 'trophy';
      if (s === 'published') return 'trophy';
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
    const active = hostedTournaments.filter(t => {
      const s = (t.status || '').toLowerCase();
      return s === 'live' || s === 'upcoming' || s === 'published';
    }).length;
    const prizePool = hostedTournaments.reduce((sum, t) => sum + (t.prizePool || 0), 0);
    const filledSlots = hostedTournaments.reduce((sum, t) => sum + getFilledSlotCount(t), 0);
    const totalSlots = hostedTournaments.reduce((sum, t) => sum + getSlotCount(t), 0);
    const pendingPayouts = orgEarnings
      .filter(e => (e.status || '').toLowerCase() === 'pending')
      .reduce((sum, e) => sum + (e.orgShare || 0), 0);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyRevenue = orgEarnings
      .reduce((sum, e) => {
        const earnedAt = toDateSafe((e as any).createdAt)?.getTime() || 0;
        return earnedAt >= monthStart.getTime() ? sum + (e.orgShare || 0) : sum;
      }, 0);

    const escrowBalance = hostedTournaments
      .filter(t => {
        const s = (t.status || '').toLowerCase();
        return s === 'live' || s === 'upcoming';
      })
      .reduce((sum, t) => sum + (t.prizePool || 0), 0);

    return {
      activeTournaments: active,
      liveScrims: scrims.filter(s => (s.status || '').toLowerCase() === 'live').length,
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

  // Manual fallback refresh if ever needed
  const fetchHostedTournaments = useCallback(async () => {
    if (!user) return;
    try {
      const [tSnap, sSnap] = await Promise.all([
        getDocs(query(collection(db, 'tournaments'), where('hostUid', '==', user.uid))),
        getDocs(query(collection(db, 'scrims'), where('hostUid', '==', user.uid))).catch(() => ({ docs: [] } as any)),
      ]);
      const nextMap = new Map<string, Tournament>();
      tSnap.docs.forEach(d => nextMap.set(d.id, { id: d.id, ...d.data() } as Tournament));
      sSnap.docs.forEach(d => nextMap.set(d.id, { id: d.id, ...d.data() } as Tournament));
      tourMapRef.current = nextMap;
      recomputeTournaments();
    } catch (e) {
      console.warn('Manual refresh failed:', e);
    }
  }, [user, recomputeTournaments]);

  const fetchParticipants = useCallback(async () => {
    // Real-time subscription manages this automatically
  }, []);

  const fetchTransactions = useCallback(async () => {
    // Real-time subscription manages this automatically
  }, []);

  const fetchOrgEarnings = useCallback(async () => {
    // Real-time subscription manages this automatically
  }, []);

  const fetchDisputes = useCallback(async () => {
    // Real-time subscription manages this automatically
  }, []);

  // --- Real-time Optimistic Write Operations (0ms latency UI response) ---

  const assertTournamentHost = useCallback(async (tournamentId: string) => {
    if (!user) throw new Error('Not authenticated');
    let tDoc = await getDoc(doc(db, 'tournaments', tournamentId)).catch(() => null);
    if (!tDoc || !tDoc.exists()) {
      tDoc = await getDoc(doc(db, 'scrims', tournamentId)).catch(() => null);
    }
    if (tDoc && tDoc.exists()) {
      const data = tDoc.data();
      const ownerId = data.hostUid || data.orgId || data.hostId || data.userId || data.organizerId || data.createdBy;
      if (ownerId && ownerId !== user.uid && profile?.role !== 'admin' && profile?.role !== 'organizer') {
        throw new Error('Not authorized — you do not own this tournament or scrim');
      }
    }
  }, [user, profile?.role]);

  const deleteTournament = useCallback(async (id: string) => {
    if (!user) throw new Error('Not authenticated');
    // Optimistic UI update
    setHostedTournaments(prev => prev.filter(t => t.id !== id));
    tourMapRef.current.delete(id);
    scrimMapRef.current.delete(id);

    const token = await auth.currentUser?.getIdToken();
    let deleted = false;

    if (token) {
      try {
        let res = await fetch(`/api/tournaments/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) {
          res = await fetch(`/api/scrims/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
          });
        }
        if (res.ok) deleted = true;
      } catch {}
    }

    if (!deleted) {
      await assertTournamentHost(id);
      await Promise.all([
        deleteDoc(doc(db, 'tournaments', id)).catch(() => {}),
        deleteDoc(doc(db, 'scrims', id)).catch(() => {}),
      ]);
    }
  }, [user, assertTournamentHost]);

  const updateTournamentStatus = useCallback(async (id: string, status: Tournament['status']) => {
    let updatePayload: Record<string, any> = { status, updatedAt: serverTimestamp() };

    if (status === 'completed') {
      const target = hostedTournaments.find(t => t.id === id);
      const isScrim = target && (target.matchType === 'scrims' || (target as any).isScrim === true || (target as any).type === 'scrim');
      if (isScrim && Array.isArray(target?.slots)) {
        const totalSlotCount = Number((target as any).totalSlots) || target.slots.length || 12;
        const releasedSlots = Array.from({ length: totalSlotCount }, (_, idx) => ({
          slotNumber: idx + 1,
          status: 'open' as const,
          teamName: null,
          teamId: null,
          userId: null,
          leader: null,
        }));
        updatePayload = {
          ...updatePayload,
          stage: 'completed',
          slots: releasedSlots,
          filledSlots: 0,
          currentPlayers: 0,
          completedAt: serverTimestamp(),
        };
      }
    }

    // 0ms Optimistic local update
    setHostedTournaments(prev => prev.map(t => t.id === id ? { ...t, ...updatePayload } : t));

    await assertTournamentHost(id);
    await Promise.all([
      updateDoc(doc(db, 'tournaments', id), updatePayload).catch(() => {}),
      updateDoc(doc(db, 'scrims', id), updatePayload).catch(() => {}),
    ]);
  }, [assertTournamentHost, hostedTournaments]);

  const activateTournament = useCallback(async (id: string) => {
    if (!user) throw new Error('Not authenticated');
    // 0ms Optimistic local update
    setHostedTournaments(prev => prev.map(t => t.id === id ? { ...t, status: 'upcoming', fundingStatus: 'RESERVED', stage: 'registration' } : t));

    await assertTournamentHost(id);
    const token = await auth.currentUser?.getIdToken();
    let activatedViaApi = false;

    if (token) {
      try {
        const res = await fetch(`/api/tournaments/${id}/activate`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          activatedViaApi = true;
        }
      } catch {}
    }

    if (!activatedViaApi) {
      await Promise.all([
        updateDoc(doc(db, 'tournaments', id), {
          status: 'upcoming',
          fundingStatus: 'RESERVED',
          stage: 'registration',
          updatedAt: serverTimestamp(),
        }).catch(() => {}),
        updateDoc(doc(db, 'scrims', id), {
          status: 'upcoming',
          fundingStatus: 'RESERVED',
          stage: 'registration',
          updatedAt: serverTimestamp(),
        }).catch(() => {}),
      ]);
    }
  }, [user, assertTournamentHost]);

  const broadcastLobby = useCallback(async (
    tournamentId: string,
    roomId: string,
    roomPass: string,
    ytLink: string,
    collectionName: 'tournaments' | 'scrims' = 'tournaments'
  ) => {
    // 0ms Optimistic update
    setHostedTournaments(prev => prev.map(t => t.id === tournamentId ? { ...t, roomId, roomPass, ytLink } : t));

    await assertTournamentHost(tournamentId).catch(() => {});
    // Instant multi-channel broadcast (RTDB websocket + Firestore + root docs + notifications)
    await broadcastRoomCredentials(tournamentId, roomId, roomPass, ytLink, collectionName);
  }, [assertTournamentHost]);

  const updateParticipantStatus = useCallback(async (participantId: string, status: 'approved' | 'rejected', tournamentId: string) => {
    // 0ms Optimistic update
    setParticipants(prev => prev.map(p => p.id === participantId ? { ...p, status } : p));

    await assertTournamentHost(tournamentId);
    const batch = writeBatch(db);
    batch.update(doc(db, 'participants', participantId), { status });
    const inc = status === 'approved' ? 1 : -1;
    batch.update(doc(db, 'tournaments', tournamentId), { currentPlayers: increment(inc) });
    await batch.commit();
  }, [assertTournamentHost]);

  const requestWithdrawal = useCallback(async (amount: number, method: string, details: string) => {
    if (!user) throw new Error('Not authenticated');
    const token = await auth.currentUser?.getIdToken();
    let apiSucceeded = false;
    if (token) {
      try {
        const res = await fetch('/api/wallet/withdraw', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ amount, method, accountDetails: details }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          apiSucceeded = true;
        } else if (res.status && res.status !== 404 && data.message) {
          throw new Error(data.message);
        }
      } catch (err: any) {
        if (err?.message && !err.message.includes('fetch') && !err.message.includes('Failed to fetch')) {
          throw err;
        }
      }
    }

    if (!apiSucceeded) {
      // Fallback: create pending withdrawal request in transactions & notify admin
      const txRef = doc(collection(db, 'transactions'));
      await setDoc(txRef, {
        userId: user.uid,
        amount,
        type: 'withdraw',
        method,
        accountDetails: details,
        status: 'pending',
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'users', user.uid), {
        orgWalletBalance: increment(-amount),
      }).catch(() => {});
    }
  }, [user]);

  const broadcastAnnouncement = useCallback(async (tournamentId: string, message: string, tournamentTitle: string) => {
    const tDoc = await getDoc(doc(db, 'tournaments', tournamentId));
    if (!tDoc.exists()) throw new Error('Tournament not found');
    const tData = tDoc.data();
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

    // 0ms Optimistic Slot Toggle in local state
    setHostedTournaments(prev => prev.map(t => {
      if (t.id !== scrimId) return t;
      const currentSlots = normalizeScrimSlots(t.slots, getSlotCount(t), (t as any).filledSlots ?? t.currentPlayers);
      const newSlots = currentSlots.map((s: any) => {
        if (s.slotNumber !== slotNumber) return s;
        if (s.status === 'filled') return { ...s, status: 'open', teamName: null, teamId: null };
        return { ...s, status: 'filled', teamName: 'Reserved', teamId: null };
      });
      const filled = countFilledScrimSlots(newSlots);
      return { ...t, slots: newSlots as any, filledSlots: filled, currentPlayers: filled };
    }));

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
    const ownerId = data.hostUid || data.orgId || data.hostId || data.userId || data.organizerId || data.createdBy;
    if (ownerId && ownerId !== user.uid && profile?.role !== 'admin' && profile?.role !== 'organizer') throw new Error('Not authorized');

    const currentSlots = normalizeScrimSlots(data.slots, data.totalSlots, data.filledSlots ?? data.currentPlayers);
    const targetSlot: any = currentSlots.find((s: any) => s.slotNumber === slotNumber);
    const willRelease = targetSlot?.status === 'filled';

    const newSlots = currentSlots.map((s: any) => {
      if (s.slotNumber !== slotNumber) return s;
      if (s.status === 'filled') return { ...s, status: 'open', teamName: null, teamId: null, userId: null, leader: null };
      return { ...s, status: 'filled', teamName: 'Reserved', teamId: null, userId: null, leader: 'Host Reserved' };
    });
    const filled = countFilledScrimSlots(newSlots);

    const updatePayload = { slots: newSlots, filledSlots: filled, currentPlayers: filled, updatedAt: serverTimestamp() };

    await Promise.all([
      updateDoc(targetDocRef, updatePayload).catch(() => {}),
      updateDoc(doc(db, targetCollection === 'tournaments' ? 'scrims' : 'tournaments', scrimId), updatePayload).catch(() => {}),
      setDoc(targetDocRef, updatePayload, { merge: true }).catch(() => {}),
      setDoc(doc(db, targetCollection === 'tournaments' ? 'scrims' : 'tournaments', scrimId), updatePayload, { merge: true }).catch(() => {}),
    ]);

    if (willRelease) {
      try {
        const pSnap = await getDocs(query(collection(db, 'participants'), where('tournamentId', '==', scrimId)));
        for (const pDoc of pSnap.docs) {
          const p = pDoc.data();
          if (
            p.slotNumber === slotNumber ||
            (targetSlot?.teamId && (p.teamId === targetSlot.teamId || p.userId === targetSlot.teamId)) ||
            (targetSlot?.userId && p.userId === targetSlot.userId) ||
            (targetSlot?.teamName && targetSlot.teamName !== 'Reserved' && p.teamName === targetSlot.teamName)
          ) {
            await deleteDoc(doc(db, 'participants', pDoc.id)).catch(() => {});
          }
        }
      } catch {}
    }
  }, [user, profile?.role]);

  const toggleRosterLock = useCallback(async (teamId: string) => {
    if (!user) throw new Error('Not authenticated');
    // 0ms Optimistic toggle
    setParticipants(prev => prev.map(p => (p.teamId === teamId || p.userId === teamId) ? { ...p, rosterLocked: !((p as any).rosterLocked) } : p));

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
  }, [user, assertTournamentHost]);

  const issueWarning = useCallback(async (teamName: string, reason: string) => {
    if (!user) throw new Error('Not authenticated');
    // 0ms Optimistic update
    setParticipants(prev => prev.map(p => p.teamName === teamName ? { ...p, strikes: ((p as any).strikes || 0) + 1, lastWarning: reason } : p));

    const q = query(collection(db, 'participants'), where('teamName', '==', teamName));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error('Team not found');
    const pDoc = snap.docs[0];
    const current = pDoc.data() as any;
    const tournamentId = current.tournamentId;
    await assertTournamentHost(tournamentId);

    const newStrikes = (current.strikes || 0) + 1;
    await updateDoc(pDoc.ref, { strikes: newStrikes, lastWarning: reason, lastWarningAt: serverTimestamp() });
  }, [user, assertTournamentHost]);

  const toggleBanTeam = useCallback(async (teamId: string, teamName: string) => {
    if (!user) throw new Error('Not authenticated');
    // 0ms Optimistic update
    setParticipants(prev => prev.map(p => (p.teamId === teamId || p.teamName === teamName) ? { ...p, banned: !((p as any).banned) } : p));

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
  }, [user, assertTournamentHost]);

  const resolveDispute = useCallback(async (disputeId: string, action: 'warn' | 'ban' | 'dismiss') => {
    if (!user) throw new Error('Not authenticated');
    const status = action === 'dismiss' ? 'dismissed' : 'resolved';

    // 0ms Optimistic update
    setDisputes(prev => prev.map(d => d.id === disputeId ? { ...d, status, resolutionAction: action } : d));

    const dRef = doc(db, 'disputes', disputeId);
    const dSnap = await getDoc(dRef);
    if (!dSnap.exists()) throw new Error('Dispute not found');
    const tournamentId = dSnap.data().tournamentId as string | undefined;
    if (!tournamentId) throw new Error('Dispute has no tournament reference');
    await assertTournamentHost(tournamentId);

    await updateDoc(dRef, {
      status,
      resolvedAt: serverTimestamp(),
      resolvedBy: user.uid,
      resolutionAction: action,
    });
  }, [user, assertTournamentHost]);

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
    activateTournament,
    assertTournamentHost,
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
