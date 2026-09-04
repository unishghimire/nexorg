import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, onSnapshot, setDoc, updateDoc, deleteDoc, collection, query, where, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../../shared/config/firebase';
import { useAuth } from '../../../shared/context/AuthContext';
import { useNotification } from '../../../shared/context/NotificationContext';
import { fetchRoomCredentials, broadcastRoomCredentials } from '../../../shared/services/roomCredentials';
import { countFilledScrimSlots, normalizeScrimSlots, getScrimSlotCount } from '../../../shared/utils/scrimSlots';
import { toDateSafe } from '../../../shared/utils/utils';
import { DEFAULT_BANNER } from '../../../shared/constants/constants';
import {
  ChevronLeft, Save, Radio, Users, DollarSign, Calendar,
  Gamepad2, Edit2, Check, X, Lock, Unlock, Copy, Trophy,
  Clock, MapPin, Play, CheckCircle2, RotateCcw, Trash2, Share2,
  Award, Medal, Flame, Plus, Trash, AlertCircle, TrendingUp,
  ShieldCheck, UserCheck, UserX, ExternalLink, Search
} from 'lucide-react';

const formatRupees = (n: number = 0) => `Rs. ${new Intl.NumberFormat('en-IN').format(n)}`;

interface WinnerTier {
  rank: number;
  teamName: string;
  teamId: string;
  userId: string;
  prize: number;
  kills: number;
  points: number;
}

export default function ScrimDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { showToast } = useNotification();

  const [scrim, setScrim] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [scrimCollection, setScrimCollection] = useState<'tournaments' | 'scrims'>('tournaments');
  const [roomId, setRoomId] = useState('');
  const [roomPass, setRoomPass] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  // Multi-tier winners modal state
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [winnerTiers, setWinnerTiers] = useState<WinnerTier[]>([
    { rank: 1, teamName: '', teamId: '', userId: '', prize: 0, kills: 0, points: 0 },
    { rank: 2, teamName: '', teamId: '', userId: '', prize: 0, kills: 0, points: 0 },
    { rank: 3, teamName: '', teamId: '', userId: '', prize: 0, kills: 0, points: 0 },
  ]);
  const [submittingPayout, setSubmittingPayout] = useState(false);

  // Live Registered Participants & Slot Inspector State
  const [participants, setParticipants] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignSlotNumber, setAssignSlotNumber] = useState<number | null>(null);
  const [manualTeamName, setManualTeamName] = useState('');
  const [manualLeader, setManualLeader] = useState('');
  const [manualUid, setManualUid] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // --- Load scrim ---
  useEffect(() => {
    if (!id) {
      setLoading(false);
      setLoadError('This scrim link is invalid.');
      return;
    }

    if (!user) { setLoading(false); return; }
    setLoading(true);
    setLoadError(null);

    let unsubTournaments: (() => void) | null = null;

    // Check modern 'scrims' collection first with real-time updates
    const unsubScrims = onSnapshot(doc(db, 'scrims', id), (scrimSnap) => {
      if (scrimSnap.exists()) {
        const data = { id: scrimSnap.id, ...scrimSnap.data() } as any;
        const scrimHostId = data.hostUid || data.orgId || data.hostId || data.userId || data.organizerId || data.createdBy;
        const isAuthorized = Boolean(
          user && (
            !scrimHostId ||
            String(scrimHostId).trim() === String(user.uid).trim() ||
            profile?.role === 'admin' ||
            profile?.role === 'organizer'
          )
        );
        if (!isAuthorized) {
          showToast('Unauthorized — you do not own this scrim', 'error');
          navigate('/organizer?tab=scrims');
          return;
        }
        setScrim(data);
        setScrimCollection('scrims');
        fetchRoomCredentials(id, undefined, 'scrims').then(credentials => {
          setRoomId(credentials?.roomId || data.roomId || '');
          setRoomPass(credentials?.roomPass || data.roomPass || '');
        }).catch(e => {
          console.warn('Room credentials fetch warning:', e);
        });
        setStreamUrl(data.ytLink || data.streamUrl || '');
        setLoading(false);
      } else {
        // Fallback: subscribe to 'tournaments' collection for legacy records
        if (!unsubTournaments) {
          unsubTournaments = onSnapshot(doc(db, 'tournaments', id), (tournSnap) => {
            if (tournSnap.exists()) {
              const data = { id: tournSnap.id, ...tournSnap.data() } as any;
              const scrimHostId = data.hostUid || data.orgId || data.hostId || data.userId || data.organizerId || data.createdBy;
              const isAuthorized = Boolean(
                user && (
                  !scrimHostId ||
                  String(scrimHostId).trim() === String(user.uid).trim() ||
                  profile?.role === 'admin' ||
                  profile?.role === 'organizer'
                )
              );
              if (!isAuthorized) {
                showToast('Unauthorized — you do not own this scrim', 'error');
                navigate('/organizer?tab=scrims');
                return;
              }
              setScrim(data);
              setScrimCollection('tournaments');
              fetchRoomCredentials(id, undefined, 'tournaments').then(credentials => {
                setRoomId(credentials?.roomId || data.roomId || '');
                setRoomPass(credentials?.roomPass || data.roomPass || '');
              }).catch(e => {
                console.warn('Room credentials fetch warning:', e);
              });
              setStreamUrl(data.ytLink || data.streamUrl || '');
              setLoading(false);
            } else {
              setScrim(null);
              setLoading(false);
            }
          }, (err) => {
            console.error('Tournaments collection load error:', err);
            setLoadError('Failed to load scrim details.');
            setLoading(false);
          });
        }
      }
    }, (err) => {
      console.error('Scrims collection load error:', err);
      setLoadError('Failed to load scrim details.');
      setLoading(false);
    });

    // Subscribe to live registered participants for this scrim
    const unsubParticipants = onSnapshot(
      query(collection(db, 'participants'), where('tournamentId', '==', id)),
      (snapshot) => {
        const parts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setParticipants(parts);
      },
      (err) => {
        console.warn('Participants subscription error:', err);
      }
    );

    return () => {
      unsubScrims();
      if (unsubTournaments) unsubTournaments();
      unsubParticipants();
    };
  }, [id, user, profile?.role, navigate, showToast, retryKey]);

  // --- Handlers ---
  const handleSaveEdit = useCallback(async () => {
    const entryFee = Number(editForm.entryFee);
    const prizePool = Number(editForm.prizePool);
    const newSlotCount = Number(editForm.slots);
    if (!id || !editForm.title?.trim() || ![entryFee, prizePool, newSlotCount].every(Number.isFinite) || entryFee < 0 || prizePool < 0 || newSlotCount < 1) {
      showToast('Enter a title, non-negative fees, and at least one slot', 'error');
      return;
    }
    try {
      const currentSlots = normalizeScrimSlots(scrim?.slots, scrim?.totalSlots, scrim?.filledSlots ?? scrim?.currentPlayers);
      let updatedSlots = currentSlots;
      if (newSlotCount < currentSlots.length) {
        updatedSlots = currentSlots.slice(0, newSlotCount);
      } else if (newSlotCount > currentSlots.length) {
        const extra = Array.from({ length: newSlotCount - currentSlots.length }, (_, idx) => ({
          slotNumber: currentSlots.length + idx + 1,
          status: 'open' as const,
          teamName: null,
          teamId: null,
        }));
        updatedSlots = [...currentSlots, ...extra];
      }
      const filled = countFilledScrimSlots(updatedSlots);
      const startDate = toDateSafe(editForm.startTime);

      const updatePayload = {
        title: editForm.title.trim(),
        startTime: startDate ? Timestamp.fromDate(startDate) : (editForm.startTime || ''),
        entryFee,
        prizePool,
        slots: updatedSlots,
        totalSlots: newSlotCount,
        filledSlots: filled,
        currentPlayers: filled,
        map: editForm.map || 'Bermuda',
        updatedAt: serverTimestamp(),
      };
      await Promise.all([
        updateDoc(doc(db, 'scrims', id), updatePayload).catch(() => {}),
        updateDoc(doc(db, 'tournaments', id), updatePayload).catch(() => {}),
        setDoc(doc(db, 'scrims', id), updatePayload, { merge: true }).catch(() => {}),
        setDoc(doc(db, 'tournaments', id), updatePayload, { merge: true }).catch(() => {}),
      ]);
      setScrim((prev: any) => prev ? { ...prev, ...updatePayload } : prev);
      showToast('Scrim updated', 'success');
      setIsEditing(false);
    } catch {
      showToast('Failed to update scrim', 'error');
    }
  }, [id, scrim, editForm, scrimCollection, showToast]);

  const handleReleaseSlot = useCallback(async (slotNumber: number) => {
    if (!scrim || !id) return;
    try {
      const currentSlots = normalizeScrimSlots(scrim.slots, scrim.totalSlots, scrim.filledSlots ?? scrim.currentPlayers);
      const targetSlot: any = currentSlots.find((s: any) => s.slotNumber === slotNumber);
      const newSlots = currentSlots.map((s: any) => {
        if (s.slotNumber !== slotNumber) return s;
        return {
          slotNumber: s.slotNumber,
          status: 'open' as const,
          teamName: null,
          teamId: null,
          userId: null,
          leader: null,
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
        updateDoc(doc(db, 'scrims', id), updatePayload).catch(() => {}),
        updateDoc(doc(db, 'tournaments', id), updatePayload).catch(() => {}),
        setDoc(doc(db, 'scrims', id), updatePayload, { merge: true }).catch(() => {}),
        setDoc(doc(db, 'tournaments', id), updatePayload, { merge: true }).catch(() => {}),
      ]);

      // Remove corresponding participant record if present
      const matchParts = participants.filter(p => 
        (p as any).slotNumber === slotNumber ||
        (targetSlot?.teamId && (p.teamId === targetSlot.teamId || p.userId === targetSlot.teamId)) ||
        (targetSlot?.userId && p.userId === targetSlot.userId) ||
        (targetSlot?.teamName && targetSlot.teamName !== 'Reserved' && p.teamName === targetSlot.teamName)
      );
      for (const p of matchParts) {
        await deleteDoc(doc(db, 'participants', p.id)).catch(() => {});
      }

      setParticipants(prev => prev.filter(p => !matchParts.some(mp => mp.id === p.id)));
      setScrim((prev: any) => prev ? { ...prev, ...updatePayload } : prev);
      setSelectedSlot(null);
      showToast(`Slot #${slotNumber} released & cleared!`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to release slot', 'error');
    }
  }, [scrim, id, participants, showToast]);

  const handleManualAssignSlot = useCallback(async (slotNumber: number, teamName: string, leader?: string, inGameId?: string) => {
    if (!scrim || !id || !teamName.trim()) {
      showToast('Please enter a team name', 'error');
      return;
    }
    try {
      const currentSlots = normalizeScrimSlots(scrim.slots, scrim.totalSlots, scrim.filledSlots ?? scrim.currentPlayers);
      const newSlots = currentSlots.map((s: any) => {
        if (s.slotNumber !== slotNumber) return s;
        return {
          slotNumber: s.slotNumber,
          status: 'filled' as const,
          teamName: teamName.trim(),
          teamId: `manual_${Date.now()}`,
          userId: null,
          leader: leader?.trim() || teamName.trim(),
          inGameId: inGameId?.trim() || null,
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
        updateDoc(doc(db, 'scrims', id), updatePayload).catch(() => {}),
        updateDoc(doc(db, 'tournaments', id), updatePayload).catch(() => {}),
      ]);

      setScrim((prev: any) => prev ? { ...prev, ...updatePayload } : prev);
      setIsAssignModalOpen(false);
      setManualTeamName('');
      setManualLeader('');
      setManualUid('');
      showToast(`Slot #${slotNumber} reserved for "${teamName.trim()}"!`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to reserve slot', 'error');
    }
  }, [scrim, id, showToast]);

  const handleToggleLockRemainingSlots = useCallback(async () => {
    if (!scrim || !id) return;
    try {
      const currentSlots = normalizeScrimSlots(scrim.slots, scrim.totalSlots, scrim.filledSlots ?? scrim.currentPlayers);
      const hasLocked = currentSlots.some((s: any) => s.status === 'locked');

      const newSlots = currentSlots.map((s: any) => {
        if (s.status === 'filled') return s;
        return {
          ...s,
          status: hasLocked ? ('open' as const) : ('locked' as const),
          teamName: hasLocked ? null : 'Locked by Host',
        };
      });

      const updatePayload = {
        slots: newSlots,
        updatedAt: serverTimestamp(),
      };

      await Promise.all([
        updateDoc(doc(db, 'scrims', id), updatePayload).catch(() => {}),
        updateDoc(doc(db, 'tournaments', id), updatePayload).catch(() => {}),
      ]);

      setScrim((prev: any) => prev ? { ...prev, slots: newSlots } : prev);
      showToast(hasLocked ? 'All remaining slots unlocked!' : 'All remaining open slots locked!', 'info');
    } catch {
      showToast('Failed to toggle slot locks', 'error');
    }
  }, [scrim, id, showToast]);

  const handleToggleSlot = useCallback(async (slotNumber: number) => {
    if (!scrim || !id) return;

    try {
      const slotsArray = normalizeScrimSlots(scrim.slots, scrim.totalSlots, scrim.filledSlots ?? scrim.currentPlayers);

      const target = slotsArray.find((s: any) => s.slotNumber === slotNumber);
      if (target?.status === 'filled') {
        // If filled, prompt release
        await handleReleaseSlot(slotNumber);
        return;
      }

      // If open, reserve it
      const newSlots = slotsArray.map((s: any) => {
        if (s.slotNumber !== slotNumber) return s;
        return { ...s, status: 'filled' as const, teamName: 'Reserved', teamId: null, userId: null, leader: 'Host Reserved' };
      });
      const filled = countFilledScrimSlots(newSlots);
      const updatePayload = { slots: newSlots, filledSlots: filled, currentPlayers: filled, updatedAt: serverTimestamp() };

      await Promise.all([
        updateDoc(doc(db, 'scrims', id), updatePayload).catch(() => {}),
        updateDoc(doc(db, 'tournaments', id), updatePayload).catch(() => {}),
      ]);
      setScrim((prev: any) => prev ? { ...prev, ...updatePayload } : prev);
      showToast(`Slot ${slotNumber} reserved`, 'info');
    } catch {
      showToast('Failed to toggle slot', 'error');
    }
  }, [scrim, id, handleReleaseSlot, showToast]);

  const handleBroadcast = useCallback(async () => {
    if (!id) return;
    try {
      await broadcastRoomCredentials(id, roomId, roomPass, streamUrl, 'scrims');
      setScrim((prev: any) => prev ? { ...prev, roomId, roomPass, ytLink: streamUrl } : prev);
      showToast('Room credentials broadcasted to all players!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to broadcast', 'error');
    }
  }, [id, roomId, roomPass, streamUrl, showToast]);

  const handleStatusChange = useCallback(async (newStatus: string) => {
    if (!id || !scrim) return;

    if (newStatus === 'completed') {
      const hasPrizePool = Number(scrim?.prizePool) > 0;
      const isPayoutDone = Boolean(scrim?.payoutCompleted || scrim?.payoutStatus === 'paid' || (Array.isArray(scrim?.winners) && scrim.winners.length > 0));
      if (hasPrizePool && !isPayoutDone) {
        showToast('Cannot finalize match until prize payment is distributed to winners! Please declare winners & distribute prizes first.', 'warning');
        setShowWinnerModal(true);
        return;
      }
    }

    try {
      let updatePayload: Record<string, any> = { status: newStatus, updatedAt: serverTimestamp() };
      if (newStatus === 'completed') {
        const totalSlotCount = Number(scrim?.totalSlots) || (Array.isArray(scrim?.slots) ? scrim.slots.length : 12);
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

        // Clean up registered participants for this finished match
        for (const p of participants) {
          await deleteDoc(doc(db, 'participants', p.id)).catch(() => {});
        }
        setParticipants([]);
      }

      await Promise.all([
        updateDoc(doc(db, 'scrims', id), updatePayload).catch(() => {}),
        updateDoc(doc(db, 'tournaments', id), updatePayload).catch(() => {}),
        setDoc(doc(db, 'scrims', id), updatePayload, { merge: true }).catch(() => {}),
        setDoc(doc(db, 'tournaments', id), updatePayload, { merge: true }).catch(() => {}),
      ]);
      setScrim((prev: any) => prev ? { ...prev, ...updatePayload } : prev);
      showToast(
        newStatus === 'completed'
          ? 'Match finalized & all lobby slots released!'
          : `Scrim status: ${newStatus.toUpperCase()}`,
        'success'
      );
    } catch {
      showToast('Failed to update status', 'error');
    }
  }, [id, scrim, showToast]);

  const handleDeleteScrim = useCallback(async () => {
    if (!id || !window.confirm(`Are you sure you want to permanently delete "${scrim?.title || 'this scrim'}"?`)) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      let deletedViaApi = false;
      if (token) {
        try {
          const res = await fetch(`/api/scrims/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            deletedViaApi = true;
          } else {
            const fallbackRes = await fetch(`/api/tournaments/${id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (fallbackRes.ok) deletedViaApi = true;
          }
        } catch {}
      }

      if (!deletedViaApi) {
        await Promise.all([
          deleteDoc(doc(db, 'scrims', id)).catch(() => {}),
          deleteDoc(doc(db, 'tournaments', id)).catch(() => {}),
        ]);
      }
      showToast('Scrim deleted successfully', 'success');
      navigate('/organizer?tab=scrims');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete scrim', 'error');
    }
  }, [id, scrim?.title, navigate, showToast]);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      showToast('Clipboard access is unavailable. Copy the value manually.', 'error');
    }
  };

  // --- Multi-Tier Presets & Actions ---
  const applyPreset = (preset: 'top3' | 'top2' | 'all' | 'top5') => {
    const pool = Number(scrim?.prizePool) || 0;
    if (preset === 'top3') {
      setWinnerTiers([
        { rank: 1, teamName: winnerTiers[0]?.teamName || '', teamId: winnerTiers[0]?.teamId || '', userId: winnerTiers[0]?.userId || '', prize: Math.round(pool * 0.5), kills: winnerTiers[0]?.kills || 0, points: 15 },
        { rank: 2, teamName: winnerTiers[1]?.teamName || '', teamId: winnerTiers[1]?.teamId || '', userId: winnerTiers[1]?.userId || '', prize: Math.round(pool * 0.3), kills: winnerTiers[1]?.kills || 0, points: 12 },
        { rank: 3, teamName: winnerTiers[2]?.teamName || '', teamId: winnerTiers[2]?.teamId || '', userId: winnerTiers[2]?.userId || '', prize: Math.round(pool * 0.2), kills: winnerTiers[2]?.kills || 0, points: 10 },
      ]);
    } else if (preset === 'top2') {
      setWinnerTiers([
        { rank: 1, teamName: winnerTiers[0]?.teamName || '', teamId: winnerTiers[0]?.teamId || '', userId: winnerTiers[0]?.userId || '', prize: Math.round(pool * 0.7), kills: winnerTiers[0]?.kills || 0, points: 15 },
        { rank: 2, teamName: winnerTiers[1]?.teamName || '', teamId: winnerTiers[1]?.teamId || '', userId: winnerTiers[1]?.userId || '', prize: Math.round(pool * 0.3), kills: winnerTiers[1]?.kills || 0, points: 12 },
      ]);
    } else if (preset === 'all') {
      setWinnerTiers([
        { rank: 1, teamName: winnerTiers[0]?.teamName || '', teamId: winnerTiers[0]?.teamId || '', userId: winnerTiers[0]?.userId || '', prize: pool, kills: winnerTiers[0]?.kills || 0, points: 20 },
      ]);
    } else if (preset === 'top5') {
      setWinnerTiers([
        { rank: 1, teamName: winnerTiers[0]?.teamName || '', teamId: winnerTiers[0]?.teamId || '', userId: winnerTiers[0]?.userId || '', prize: Math.round(pool * 0.4), kills: 0, points: 15 },
        { rank: 2, teamName: winnerTiers[1]?.teamName || '', teamId: winnerTiers[1]?.teamId || '', userId: winnerTiers[1]?.userId || '', prize: Math.round(pool * 0.25), kills: 0, points: 12 },
        { rank: 3, teamName: winnerTiers[2]?.teamName || '', teamId: winnerTiers[2]?.teamId || '', userId: winnerTiers[2]?.userId || '', prize: Math.round(pool * 0.15), kills: 0, points: 10 },
        { rank: 4, teamName: '', teamId: '', userId: '', prize: Math.round(pool * 0.10), kills: 0, points: 8 },
        { rank: 5, teamName: '', teamId: '', userId: '', prize: Math.round(pool * 0.10), kills: 0, points: 6 },
      ]);
    }
  };

  const handleAddTier = () => {
    const nextRank = winnerTiers.length + 1;
    setWinnerTiers([...winnerTiers, { rank: nextRank, teamName: '', teamId: '', userId: '', prize: 0, kills: 0, points: 0 }]);
  };

  const handleRemoveTier = (index: number) => {
    if (winnerTiers.length <= 1) return;
    const updated = winnerTiers.filter((_, i) => i !== index).map((t, i) => ({ ...t, rank: i + 1 }));
    setWinnerTiers(updated);
  };

  const handlePayoutMultiTier = async () => {
    if (!id || !scrim) return;
    const validTiers = winnerTiers.filter(t => (t.teamName.trim() || t.userId) && Number(t.prize) > 0);
    if (validTiers.length === 0) {
      showToast('Please select at least one winning team with a prize amount', 'error');
      return;
    }

    const totalAllocated = validTiers.reduce((acc, t) => acc + (Number(t.prize) || 0), 0);
    const expectedPool = Number(scrim.prizePool) || 0;
    if (expectedPool > 0 && Math.abs(totalAllocated - expectedPool) > 0.01) {
      showToast(`Distributed prize sum (${formatRupees(totalAllocated)}) must equal scrim prize pool (${formatRupees(expectedPool)})`, 'error');
      return;
    }

    setSubmittingPayout(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      let payoutViaApi = false;
      if (token) {
        try {
          const res = await fetch(`/api/scrims/${id}/payout`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ winners: validTiers })
          });
          if (res.ok) payoutViaApi = true;
        } catch {}
      }

      // Release all slots after payment and result are finalized
      const totalSlotCount = Number(scrim.totalSlots) || (Array.isArray(scrim.slots) ? scrim.slots.length : 12);
      const releasedSlots = Array.from({ length: totalSlotCount }, (_, idx) => ({
        slotNumber: idx + 1,
        status: 'open' as const,
        teamName: null,
        teamId: null,
        userId: null,
        leader: null,
      }));

      const winnerPayload = {
        winners: validTiers,
        podium: validTiers,
        payoutCompleted: true,
        payoutStatus: 'paid',
        status: 'completed',
        stage: 'completed',
        slots: releasedSlots,
        filledSlots: 0,
        currentPlayers: 0,
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Clean up registered participants for this finalized scrim
      for (const p of participants) {
        await deleteDoc(doc(db, 'participants', p.id)).catch(() => {});
      }
      setParticipants([]);

      await Promise.all([
        updateDoc(doc(db, 'scrims', id!), winnerPayload).catch(() => {}),
        updateDoc(doc(db, 'tournaments', id!), winnerPayload).catch(() => {}),
        setDoc(doc(db, 'scrims', id!), winnerPayload, { merge: true }).catch(() => {}),
        setDoc(doc(db, 'tournaments', id!), winnerPayload, { merge: true }).catch(() => {}),
      ]);

      setScrim((prev: any) => prev ? { ...prev, ...winnerPayload } : prev);
      showToast(
        payoutViaApi
          ? `Multi-tier prizes successfully distributed (${formatRupees(totalAllocated)})!`
          : `Scrim results & podium finalized (${formatRupees(totalAllocated)})!`,
        'success'
      );
      setShowWinnerModal(false);
    } catch (err: any) {
      showToast(err.message || 'Failed to distribute prizes', 'error');
    } finally {
      setSubmittingPayout(false);
    }
  };

  // --- Render ---
  if (loading) {
    return (
      <div className="min-h-[100dvh] pt-24 pb-16 flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs text-gray-500 uppercase tracking-widest">Loading Scrim...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div role="alert" className="min-h-[100dvh] pt-24 pb-16 flex flex-col items-center justify-center text-center px-4">
        <Gamepad2 className="w-16 h-16 text-red-400 mb-4" />
        <p className="text-gray-300">{loadError}</p>
        <div className="mt-4 flex gap-3">
          <button type="button" onClick={() => setRetryKey(key => key + 1)} className="min-h-[44px] bg-brand-500 hover:bg-brand-400 text-white rounded-lg px-5 py-2 text-sm font-medium transition-colors">Try Again</button>
          <button type="button" onClick={() => navigate('/organizer?tab=scrims')} className="min-h-[44px] text-brand-400 hover:text-brand-300 px-5 py-2 text-sm">Back to Scrims</button>
        </div>
      </div>
    );
  }

  if (!scrim) {
    return (
      <div className="min-h-[100dvh] pt-24 pb-16 flex flex-col items-center justify-center">
        <Gamepad2 className="w-16 h-16 text-gray-700 mb-4" />
        <p className="text-gray-400">Scrim not found.</p>
        <button type="button" onClick={() => navigate('/organizer?tab=scrims')} className="mt-4 text-brand-500 text-sm hover:text-brand-400">← Back to Scrims</button>
      </div>
    );
  }

  const rawSlots: any[] = normalizeScrimSlots(scrim.slots, scrim.totalSlots, scrim.filledSlots ?? scrim.currentPlayers);
  const slots: any[] = rawSlots.map((slot: any) => {
    const part = participants.find((p: any) =>
      p.slotNumber === slot.slotNumber ||
      (slot.teamId && (p.teamId === slot.teamId || p.userId === slot.teamId)) ||
      (slot.userId && p.userId === slot.userId) ||
      (slot.teamName && slot.teamName !== 'Reserved' && p.teamName === slot.teamName)
    );

    if (part) {
      return {
        ...slot,
        status: 'filled' as const,
        teamName: slot.teamName || part.teamName || part.username || `Team ${slot.slotNumber}`,
        teamId: slot.teamId || part.teamId || part.userId,
        userId: slot.userId || part.userId,
        leader: slot.leader || part.username || (part as any).inGameName || 'Player',
        inGameId: (slot as any).inGameId || part.inGameId || (part as any).gameUid || null,
        inGameName: (part as any).inGameName || part.username || null,
        teammates: part.teammates || (part as any).members || [],
        joinedAt: part.timestamp || part.createdAt || (part as any).joinedAt || null,
        participantId: part.id,
      };
    }

    return slot;
  });

  const filledCount = countFilledScrimSlots(slots);
  const totalCount = slots.length;
  const fillPercent = totalCount > 0 ? (filledCount / totalCount) * 100 : 0;
  const filledTeams: any[] = slots.filter((s: any) => s.status === 'filled' && s.teamName && s.teamName !== 'Reserved');

  const filteredTeams: any[] = filledTeams.filter((s: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (s.teamName && s.teamName.toLowerCase().includes(q)) ||
      (s.leader && s.leader.toLowerCase().includes(q)) ||
      (s.inGameName && s.inGameName.toLowerCase().includes(q)) ||
      (s.inGameId && String(s.inGameId).includes(q)) ||
      String(s.slotNumber).includes(q)
    );
  });

  const totalAllocatedPrize = winnerTiers.reduce((acc, t) => acc + (Number(t.prize) || 0), 0);
  const scrimPrizePool = Number(scrim.prizePool) || 0;
  const isPrizeBalanced = Math.abs(totalAllocatedPrize - scrimPrizePool) < 0.01;

  const resultsList = scrim.winners || scrim.results || [];

  return (
    <div className="min-h-[100dvh] pt-20 sm:pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-6">
      {/* Scrim Hero Banner */}
      <div className="relative h-64 sm:h-72 md:h-80 rounded-2xl sm:rounded-[2rem] overflow-hidden shadow-2xl group border border-gray-800 w-full">
        <div 
          className="absolute inset-0 bg-dark transition-transform duration-700 group-hover:scale-105" 
          style={{
            backgroundImage: `url('${scrim.bannerUrl || DEFAULT_BANNER}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.55
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/70 to-transparent" />
        
        {/* Top Badges & Actions */}
        <div className="absolute top-3 left-3 sm:top-6 sm:left-6 flex flex-wrap items-center gap-2 z-10">
          <button 
            type="button" 
            onClick={() => navigate('/organizer?tab=scrims')} 
            className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-gray-300 text-xs font-semibold hover:bg-black/80 flex items-center gap-1.5 border border-white/10 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Scrims Hub
          </button>
          <span className="backdrop-blur-md bg-brand-500/80 border border-brand-400/30 text-white text-xs font-black px-3 py-1.5 rounded-full uppercase tracking-wider shadow-lg">
            {scrim.game || 'Free Fire'}
          </span>
          <span className="backdrop-blur-md bg-white/10 text-white text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider border border-white/10 shadow-lg">
            {scrim.format === '5v5' ? '5v5' : 'Battle Royale'}
          </span>
          <span className={`backdrop-blur-md text-white text-xs font-black px-3 py-1.5 rounded-full uppercase tracking-wider shadow-lg border ${
            scrim.status === 'live' ? 'bg-emerald-600/90 border-emerald-500/30' :
            scrim.status === 'completed' ? 'bg-blue-600/90 border-blue-500/30' :
            'bg-zinc-800/90 border-zinc-700/30'
          }`}>
            {scrim.status === 'live' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-white animate-pulse mr-1.5" />}
            {(scrim.status || 'open').toUpperCase()}
          </span>
        </div>

        {/* Top Right Quick Actions */}
        <div className="absolute top-3 right-3 sm:top-6 sm:right-6 flex items-center gap-2 z-20">
          {isEditing ? (
            <>
              <button 
                type="button" 
                onClick={() => setIsEditing(false)} 
                className="px-3.5 py-2 rounded-xl bg-white/10 backdrop-blur-md text-gray-200 text-xs font-bold hover:bg-white/20 flex items-center gap-1.5 border border-white/10 shadow-lg transition-colors min-h-[38px]"
              >
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
              <button 
                type="button" 
                onClick={handleSaveEdit} 
                className="px-3.5 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg transition-colors min-h-[38px]"
              >
                <Save className="w-3.5 h-3.5" /> Save
              </button>
            </>
          ) : (
            <>
              <button 
                type="button" 
                onClick={() => {
                  const startDate = toDateSafe(scrim.startTime);
                  const startFormatted = startDate ? new Date(startDate.getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
                  setEditForm({
                    title: scrim.title || '',
                    startTime: startFormatted,
                    entryFee: scrim.entryFee || 0,
                    prizePool: scrim.prizePool || 0,
                    slots: scrim.totalSlots || (Array.isArray(scrim.slots) ? scrim.slots.length : Number(scrim.slots) || 12),
                    map: scrim.map || ''
                  });
                  setIsEditing(true);
                }} 
                className="px-3.5 py-2 rounded-xl bg-white/10 backdrop-blur-md text-white text-xs font-bold hover:bg-white/20 flex items-center gap-1.5 border border-white/10 shadow-lg transition-colors min-h-[38px]"
                title="Edit Scrim"
              >
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </button>
              <button
                type="button"
                onClick={handleDeleteScrim}
                className="px-3.5 py-2 rounded-xl bg-red-600/30 backdrop-blur-md hover:bg-red-600/50 text-red-300 hover:text-white border border-red-500/40 text-xs font-bold flex items-center gap-1.5 shadow-lg transition-colors min-h-[38px]"
                title="Delete Scrim"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </>
          )}
        </div>

        {/* Hero Bottom Content */}
        <div className="absolute bottom-3 left-3 right-3 sm:bottom-6 sm:left-6 sm:right-6 z-10">
          <h1 className="text-xl sm:text-3xl md:text-4xl font-black text-white mb-2 tracking-tight leading-tight drop-shadow-md">
            {scrim.title}
          </h1>
          <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-gray-200 font-bold text-xs uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-brand-500" />
              <span>{toDateSafe(scrim.startTime)?.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) || 'TBD'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-brand-500" />
              <span>{scrim.map || 'Bermuda'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-brand-500" />
              <span>{filledCount} / {totalCount} Slots</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-brand-500" />
              <span>{formatRupees(scrim.prizePool)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Status control bar & Multi-Tier Settlement Trigger */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-dark/40 border border-gray-800 rounded-xl p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 font-medium">Quick Status:</span>
          {scrim.status === 'open' && (
            <button type="button" onClick={() => handleStatusChange('live')} className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold hover:bg-emerald-500/20 flex items-center gap-1.5 transition-colors">
              <Play className="w-3.5 h-3.5" /> Go Live
            </button>
          )}
          {scrim.status === 'live' && (
            <button type="button" onClick={() => handleStatusChange('completed')} className="px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-semibold hover:bg-blue-500/20 flex items-center gap-1.5 transition-colors">
              <CheckCircle2 className="w-3.5 h-3.5" /> Finalize Match
            </button>
          )}
          {scrim.status === 'completed' && (
            <button type="button" onClick={() => handleStatusChange('open')} className="px-3 py-1.5 rounded-lg bg-surface text-gray-300 border border-gray-700 text-xs font-semibold hover:bg-card flex items-center gap-1.5 transition-colors">
              <RotateCcw className="w-3.5 h-3.5" /> Reopen Scrim
            </button>
          )}
        </div>

        {/* Multi-Tier Winner Payout Action Button */}
        <button
          type="button"
          onClick={() => {
            if (winnerTiers[0].prize === 0 && Number(scrim.prizePool) > 0) {
              applyPreset('top3');
            }
            setShowWinnerModal(true);
          }}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-brand-500 hover:from-amber-400 hover:to-brand-400 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
        >
          <Trophy className="w-4 h-4" />
          {scrim.payoutStatus === 'paid' ? 'View / Update Winners' : 'Settle Multi-Tier Winners'}
        </button>
      </div>

      {/* Multi-Tier Winner Podium (When scrim has results) */}
      {resultsList.length > 0 && (
        <div className="bg-dark/60 border border-amber-500/30 rounded-2xl p-6 relative overflow-hidden shadow-2xl">
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl" />
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-black text-white flex items-center gap-2.5">
              <Award className="w-5 h-5 text-amber-400" />
              Official Scrim Winner Podium
            </h3>
            <span className="text-xs bg-amber-500/20 text-amber-300 font-bold px-3 py-1 rounded-full border border-amber-500/30 uppercase tracking-wider">
              {scrim.payoutStatus === 'paid' ? '🏆 Payout Completed' : 'Results Recorded'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            {/* Rank 2 (Silver) */}
            {resultsList[1] && (
              <div className="bg-card/70 border border-gray-700/50 rounded-xl p-5 flex flex-col items-center text-center order-2 md:order-1 relative group hover:border-gray-500 transition-all">
                <div className="w-12 h-12 rounded-full bg-slate-300/20 border border-slate-300/40 flex items-center justify-center text-slate-200 text-lg font-black mb-3 shadow-md">
                  🥈
                </div>
                <span className="text-xs uppercase font-bold text-slate-400 tracking-wider mb-1">Rank #2 Runner-Up</span>
                <h4 className="text-base font-black text-white truncate max-w-full">{resultsList[1].teamName || 'Team 2'}</h4>
                <div className="mt-3 w-full bg-surface/60 rounded-lg p-2.5 flex items-center justify-around text-xs">
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase">Prize</span>
                    <span className="font-black text-amber-400">{formatRupees(resultsList[1].prize)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase">Kills</span>
                    <span className="font-bold text-white">{resultsList[1].kills || 0}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase">Points</span>
                    <span className="font-bold text-white">{resultsList[1].points || 0}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Rank 1 (Gold - Center & Elevated) */}
            {resultsList[0] && (
              <div className="bg-gradient-to-b from-amber-500/20 via-card to-card border-2 border-amber-500/60 rounded-xl p-6 flex flex-col items-center text-center order-1 md:order-2 relative shadow-xl shadow-amber-500/10 group hover:border-amber-400 transition-all">
                <div className="w-16 h-16 rounded-full bg-amber-500/30 border-2 border-amber-400 flex items-center justify-center text-amber-300 text-2xl font-black mb-3 shadow-lg">
                  🥇
                </div>
                <span className="text-xs uppercase font-black text-amber-400 tracking-wider mb-1">Rank #1 Champion</span>
                <h4 className="text-lg font-black text-white truncate max-w-full">{resultsList[0].teamName || 'Team 1'}</h4>
                <div className="mt-4 w-full bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-center justify-around text-xs">
                  <div>
                    <span className="text-amber-300/70 block text-[10px] uppercase font-bold">Prize</span>
                    <span className="font-black text-amber-300 text-sm">{formatRupees(resultsList[0].prize)}</span>
                  </div>
                  <div>
                    <span className="text-amber-300/70 block text-[10px] uppercase font-bold">Kills</span>
                    <span className="font-bold text-white text-sm">{resultsList[0].kills || 0}</span>
                  </div>
                  <div>
                    <span className="text-amber-300/70 block text-[10px] uppercase font-bold">Points</span>
                    <span className="font-bold text-white text-sm">{resultsList[0].points || 0}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Rank 3 (Bronze) */}
            {resultsList[2] && (
              <div className="bg-card/70 border border-amber-900/40 rounded-xl p-5 flex flex-col items-center text-center order-3 relative group hover:border-amber-800 transition-all">
                <div className="w-12 h-12 rounded-full bg-amber-700/20 border border-amber-600/40 flex items-center justify-center text-amber-500 text-lg font-black mb-3 shadow-md">
                  🥉
                </div>
                <span className="text-xs uppercase font-bold text-amber-600 tracking-wider mb-1">Rank #3 2nd Runner-Up</span>
                <h4 className="text-base font-black text-white truncate max-w-full">{resultsList[2].teamName || 'Team 3'}</h4>
                <div className="mt-3 w-full bg-surface/60 rounded-lg p-2.5 flex items-center justify-around text-xs">
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase">Prize</span>
                    <span className="font-black text-amber-400">{formatRupees(resultsList[2].prize)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase">Kills</span>
                    <span className="font-bold text-white">{resultsList[2].kills || 0}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase">Points</span>
                    <span className="font-bold text-white">{resultsList[2].points || 0}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Details grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Scrim info / edit form */}
        <div className="space-y-4">
          <div className="bg-dark/50 border border-gray-800 rounded-lg p-5">
            <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <Gamepad2 className="w-4 h-4 text-brand-500" /> Scrim Details
            </h3>

            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Title</label>
                  <input value={editForm.title || ''} onChange={e => setEditForm({ ...editForm, title: e.target.value })} className="w-full bg-black border border-gray-800 rounded-lg p-2.5 text-sm text-white focus-visible:outline-none focus:border-brand-500" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Start Time</label>
                    <input value={editForm.startTime || ''} onChange={e => setEditForm({ ...editForm, startTime: e.target.value })} className="w-full bg-black border border-gray-800 rounded-lg p-2.5 text-sm text-white focus-visible:outline-none focus:border-brand-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Map</label>
                    <input value={editForm.map || ''} onChange={e => setEditForm({ ...editForm, map: e.target.value })} placeholder="Bermuda" className="w-full bg-black border border-gray-800 rounded-lg p-2.5 text-sm text-white focus-visible:outline-none focus:border-brand-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Entry Fee</label>
                    <input type="number" value={editForm.entryFee || 0} onChange={e => setEditForm({ ...editForm, entryFee: e.target.value })} className="w-full bg-black border border-gray-800 rounded-lg p-2.5 text-sm text-white focus-visible:outline-none focus:border-brand-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Prize Pool</label>
                    <input type="number" value={editForm.prizePool || 0} onChange={e => setEditForm({ ...editForm, prizePool: e.target.value })} className="w-full bg-black border border-gray-800 rounded-lg p-2.5 text-sm text-white focus-visible:outline-none focus:border-brand-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Slots</label>
                    <input type="number" value={editForm.slots || 0} onChange={e => setEditForm({ ...editForm, slots: e.target.value })} className="w-full bg-black border border-gray-800 rounded-lg p-2.5 text-sm text-white focus-visible:outline-none focus:border-brand-500" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Start Time</p>
                  <p className="text-sm text-white">
                    {toDateSafe(scrim.startTime)?.toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) || (typeof scrim.startTime === 'string' ? scrim.startTime : 'TBD')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1.5"><MapPin className="w-3 h-3" /> Map</p>
                  <p className="text-sm text-white">{scrim.map || 'Bermuda'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1.5"><DollarSign className="w-3 h-3" /> Entry Fee</p>
                  <p className="text-sm text-white">{formatRupees(scrim.entryFee)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Trophy className="w-3 h-3" /> Prize Pool</p>
                  <p className="text-sm text-white">{formatRupees(scrim.prizePool)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Users className="w-3 h-3" /> Slots</p>
                  <p className="text-sm text-white">{filledCount} / {totalCount} filled</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Clock className="w-3 h-3" /> Format</p>
                  <p className="text-sm text-white">{scrim.format === '5v5' ? '5v5' : 'Battle Royale'}</p>
                </div>
              </div>
            )}
          </div>

          {/* Room dispatch */}
          <div className="bg-dark/50 border border-gray-800 rounded-lg p-5">
            <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <Radio className="w-4 h-4 text-brand-500" /> Room Dispatch
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Room ID</label>
                <div className="flex gap-2">
                  <input value={roomId} onChange={e => setRoomId(e.target.value)} placeholder="5240212" className="flex-1 bg-black border border-gray-800 rounded-lg p-2.5 text-sm text-white font-mono focus-visible:outline-none focus:border-brand-500" />
                  <button type="button" onClick={() => copyToClipboard(roomId, 'roomid')} className="px-3 rounded-lg bg-surface hover:bg-surface text-gray-400">
                    {copied === 'roomid' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Room Password</label>
                <div className="flex gap-2">
                  <input value={roomPass} onChange={e => setRoomPass(e.target.value)} placeholder="ffpro2026" className="flex-1 bg-black border border-gray-800 rounded-lg p-2.5 text-sm text-white font-mono focus-visible:outline-none focus:border-brand-500" />
                  <button type="button" onClick={() => copyToClipboard(roomPass, 'roompass')} className="px-3 rounded-lg bg-surface hover:bg-surface text-gray-400">
                    {copied === 'roompass' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Stream Link (Optional)</label>
                <input value={streamUrl} onChange={e => setStreamUrl(e.target.value)} placeholder="https://youtube.com/live/..." className="w-full bg-black border border-gray-800 rounded-lg p-2.5 text-sm text-white focus-visible:outline-none focus:border-brand-500" />
              </div>
              <button type="button" onClick={handleBroadcast} className="w-full bg-brand-500 hover:bg-brand-400 text-white py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 min-h-[44px]">
                <Radio className="w-4 h-4" /> Broadcast to Players
              </button>
            </div>
          </div>
        </div>

        {/* Right: Slot grid */}
        <div className="bg-dark/50 border border-gray-800 rounded-lg p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-brand-500" /> Slot Management
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">Click filled slot for player details & kick; click open slot to reserve or assign.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleLockRemainingSlots}
                className="px-3 py-1.5 rounded-lg border border-gray-700 bg-surface hover:bg-card text-gray-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Toggle lock status for all remaining open slots"
              >
                {slots.some((s: any) => s.status === 'locked') ? (
                  <>
                    <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Unlock Open Slots</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Lock Open Slots</span>
                  </>
                )}
              </button>
              <span className="text-xs font-bold text-gray-400 bg-surface px-2.5 py-1 rounded-lg border border-gray-800">
                {filledCount}/{totalCount} filled
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-surface rounded-full mb-4 overflow-hidden">
            <div className="h-full bg-brand-500 rounded-full transition-colors duration-300" style={{ width: `${fillPercent}%` }} />
          </div>

          {/* Slot grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {slots.length > 0 ? slots.map((slot: any) => (
              <button
                key={slot.slotNumber}
                type="button"
                onClick={() => {
                  if (slot.status === 'filled') {
                    setSelectedSlot(slot);
                  } else if (slot.status === 'locked') {
                    handleToggleSlot(slot.slotNumber);
                  } else {
                    setAssignSlotNumber(slot.slotNumber);
                    setManualTeamName('');
                    setManualLeader('');
                    setManualUid('');
                    setIsAssignModalOpen(true);
                  }
                }}
                className={`p-3 rounded-xl border text-xs font-medium transition-all min-h-[64px] flex flex-col justify-between cursor-pointer text-left ${
                  slot.status === 'filled'
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300 hover:bg-emerald-950/50 hover:border-emerald-400 shadow-sm'
                    : slot.status === 'locked'
                    ? 'bg-rose-950/20 border-rose-500/30 text-rose-300 hover:bg-rose-950/30'
                    : 'bg-card/70 border-gray-800 border-dashed text-gray-400 hover:border-gray-600 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[10px] font-mono font-bold text-gray-400">#{slot.slotNumber}</span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      slot.status === 'filled'
                        ? 'bg-emerald-400 ring-2 ring-emerald-500/30'
                        : slot.status === 'locked'
                        ? 'bg-rose-500'
                        : 'bg-gray-700'
                    }`}
                  />
                </div>
                <div className="mt-1 min-w-0">
                  {slot.status === 'filled' ? (
                    <>
                      <div className="font-bold text-white text-xs truncate flex items-center gap-1">
                        <Users className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span className="truncate">{slot.teamName || 'Reserved'}</span>
                      </div>
                      {slot.leader && (
                        <div className="text-[10px] text-gray-400 truncate mt-0.5">
                          {slot.leader}
                        </div>
                      )}
                    </>
                  ) : slot.status === 'locked' ? (
                    <div className="text-[11px] text-rose-400 font-semibold flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Locked
                    </div>
                  ) : (
                    <div className="text-[11px] text-gray-400 font-normal flex items-center gap-1 group-hover:text-white">
                      <Plus className="w-3 h-3" /> Open Slot
                    </div>
                  )}
                </div>
              </button>
            )) : (
              <p className="col-span-full text-center text-xs text-gray-500 py-8">No slots configured.</p>
            )}
          </div>
        </div>
      </div>

      {/* Detailed Confirmed Teams & Players Section */}
      <div className="bg-dark/50 border border-gray-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-800">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-brand-500" />
              Registered Teams & Player Rosters ({filledTeams.length})
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Live roster inspect, In-Game UIDs, teammates, and slot release actions.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search team, player, UID..."
              className="w-full bg-black border border-gray-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>

        {/* Table of Confirmed Teams */}
        {filteredTeams.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-gray-500 uppercase font-mono border-b border-gray-800/80">
                <tr>
                  <th className="pb-3 px-3">Slot</th>
                  <th className="pb-3 px-4">Team</th>
                  <th className="pb-3 px-4">Leader / IGN</th>
                  <th className="pb-3 px-4">Free Fire UID</th>
                  <th className="pb-3 px-4">Teammates</th>
                  <th className="pb-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {filteredTeams.map((s) => (
                  <tr key={s.slotNumber} className="hover:bg-surface/30 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-brand-400">
                      #{s.slotNumber}
                    </td>
                    <td className="py-3 px-4 font-bold text-white">
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{s.teamName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-300">
                      <div>
                        <span className="font-semibold">{s.leader || '—'}</span>
                        {s.inGameName && s.inGameName !== s.leader && (
                          <span className="text-gray-500 block text-[10px]">IGN: {s.inGameName}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-gray-300">
                      {s.inGameId ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-brand-400 font-semibold">{s.inGameId}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(s.inGameId, `tbl_uid_${s.slotNumber}`)}
                            className="p-1 rounded hover:bg-surface text-gray-400 hover:text-white transition-colors cursor-pointer"
                            title="Copy UID"
                          >
                            {copied === `tbl_uid_${s.slotNumber}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {Array.isArray(s.teammates) && s.teammates.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {s.teammates.slice(0, 3).map((m: any, i: number) => {
                            const mName = typeof m === 'string' ? m : (m?.name || m?.inGameName || m?.username || `T${i+1}`);
                            return (
                              <span key={i} className="px-1.5 py-0.5 rounded bg-surface border border-gray-800 text-[10px] text-gray-300">
                                {mName}
                              </span>
                            );
                          })}
                          {s.teammates.length > 3 && (
                            <span className="px-1.5 py-0.5 rounded bg-surface text-gray-500 text-[10px]">
                              +{s.teammates.length - 3}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedSlot(s)}
                          className="px-2.5 py-1 rounded-lg bg-surface hover:bg-card border border-gray-700 text-gray-300 hover:text-white text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Release slot #${s.slotNumber} ("${s.teamName}")?`)) {
                              handleReleaseSlot(s.slotNumber);
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          Release
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-gray-500 text-xs">
            {searchQuery ? `No teams match "${searchQuery}"` : 'No teams have registered yet. All slots are currently open.'}
          </div>
        )}
      </div>

      {/* Multi-Tier Winner Settlement Modal */}
      {showWinnerModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-gray-950 border border-gray-800 rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-gray-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Multi-Tier Winner Payout</h3>
                  <p className="text-xs text-gray-400">Total Scrim Prize Pool: <span className="font-bold text-amber-400">{formatRupees(scrimPrizePool)}</span></p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowWinnerModal(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-card"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Presets Bar */}
            <div className="space-y-2">
              <span className="text-xs uppercase font-bold text-gray-400 tracking-wider">Quick Split Presets</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => applyPreset('top3')}
                  className="px-3 py-2 rounded-xl bg-card border border-gray-800 hover:border-amber-500/50 text-xs font-bold text-gray-200 hover:text-white transition-all text-center"
                >
                  🥇🥈🥉 Top 3 (50/30/20)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('top2')}
                  className="px-3 py-2 rounded-xl bg-card border border-gray-800 hover:border-amber-500/50 text-xs font-bold text-gray-200 hover:text-white transition-all text-center"
                >
                  🥇🥈 Top 2 (70/30)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('all')}
                  className="px-3 py-2 rounded-xl bg-card border border-gray-800 hover:border-amber-500/50 text-xs font-bold text-gray-200 hover:text-white transition-all text-center"
                >
                  👑 Winner Takes All (100%)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('top5')}
                  className="px-3 py-2 rounded-xl bg-card border border-gray-800 hover:border-amber-500/50 text-xs font-bold text-gray-200 hover:text-white transition-all text-center"
                >
                  🎖️ Top 5 (40/25/15/10/10)
                </button>
              </div>
            </div>

            {/* Dynamic Tier Rows */}
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {winnerTiers.map((tier, idx) => (
                <div key={idx} className="bg-card/80 border border-gray-800/80 rounded-xl p-3 flex flex-wrap sm:flex-nowrap items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-surface flex items-center justify-center font-black text-sm text-amber-400 flex-shrink-0">
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${tier.rank}`}
                  </div>

                  {/* Team Selector / Input */}
                  <div className="flex-1 min-w-[140px]">
                    <select
                      value={tier.teamName}
                      onChange={(e) => {
                        const selectedTeam = e.target.value;
                        const matchedSlot = slots.find(s => s.teamName === selectedTeam);
                        const updated = [...winnerTiers];
                        updated[idx].teamName = selectedTeam;
                        updated[idx].teamId = matchedSlot?.teamId || '';
                        updated[idx].userId = (matchedSlot as any)?.userId || matchedSlot?.teamId || user?.uid || '';
                        setWinnerTiers(updated);
                      }}
                      className="w-full bg-black border border-gray-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-amber-500 focus-visible:outline-none"
                    >
                      <option value="">-- Select Team --</option>
                      {filledTeams.map((s, sIdx) => (
                        <option key={sIdx} value={s.teamName}>{s.teamName} (Slot {s.slotNumber})</option>
                      ))}
                      {tier.teamName && !filledTeams.some(s => s.teamName === tier.teamName) && (
                        <option value={tier.teamName}>{tier.teamName}</option>
                      )}
                    </select>
                  </div>

                  {/* Kills Input */}
                  <div className="w-16 flex-shrink-0">
                    <input
                      type="number"
                      placeholder="Kills"
                      value={tier.kills || ''}
                      onChange={(e) => {
                        const updated = [...winnerTiers];
                        updated[idx].kills = Number(e.target.value) || 0;
                        setWinnerTiers(updated);
                      }}
                      className="w-full bg-black border border-gray-800 rounded-lg px-2 py-1.5 text-xs text-center text-white focus:border-amber-500 focus-visible:outline-none"
                      title="Kills"
                    />
                  </div>

                  {/* Placement Points Input */}
                  <div className="w-16 flex-shrink-0">
                    <input
                      type="number"
                      placeholder="Pts"
                      value={tier.points || ''}
                      onChange={(e) => {
                        const updated = [...winnerTiers];
                        updated[idx].points = Number(e.target.value) || 0;
                        setWinnerTiers(updated);
                      }}
                      className="w-full bg-black border border-gray-800 rounded-lg px-2 py-1.5 text-xs text-center text-white focus:border-amber-500 focus-visible:outline-none"
                      title="Placement Points"
                    />
                  </div>

                  {/* Prize Amount Input */}
                  <div className="w-28 flex-shrink-0">
                    <input
                      type="number"
                      placeholder="Prize NPR"
                      value={tier.prize || ''}
                      onChange={(e) => {
                        const updated = [...winnerTiers];
                        updated[idx].prize = Number(e.target.value) || 0;
                        setWinnerTiers(updated);
                      }}
                      className="w-full bg-black border border-gray-800 rounded-lg px-2.5 py-1.5 text-xs text-amber-400 font-bold focus:border-amber-500 focus-visible:outline-none"
                      title="Prize NPR"
                    />
                  </div>

                  {/* Delete Tier Action */}
                  <button
                    type="button"
                    onClick={() => handleRemoveTier(idx)}
                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-card rounded-lg transition-colors flex-shrink-0"
                    title="Remove Tier"
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add Tier Action */}
            <button
              type="button"
              onClick={handleAddTier}
              className="w-full py-2 border border-dashed border-gray-800 hover:border-gray-700 rounded-xl text-xs font-bold text-gray-400 hover:text-white flex items-center justify-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Another Winner Tier
            </button>

            {/* Prize Balance & Allocation Summary */}
            <div className={`p-4 rounded-xl border flex items-center justify-between text-xs ${
              isPrizeBalanced ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>
                  Allocated: <strong className="text-white">{formatRupees(totalAllocatedPrize)}</strong> / {formatRupees(scrimPrizePool)}
                </span>
              </div>
              <span className="font-bold">
                {isPrizeBalanced ? '✓ Exact Match' : `Remaining: ${formatRupees(scrimPrizePool - totalAllocatedPrize)}`}
              </span>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowWinnerModal(false)}
                className="px-4 py-2 rounded-xl bg-card border border-gray-800 hover:bg-surface text-gray-300 text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePayoutMultiTier}
                disabled={submittingPayout || !isPrizeBalanced}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-brand-500 hover:from-amber-400 hover:to-brand-400 disabled:opacity-50 text-white text-xs font-black flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
              >
                {submittingPayout ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Distributing...
                  </>
                ) : (
                  <>
                    <Trophy className="w-4 h-4" />
                    Confirm & Distribute Prizes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Slot Player Details Modal */}
      {selectedSlot && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-gray-950 border border-gray-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-gray-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-mono font-black text-sm">
                  #{selectedSlot.slotNumber}
                </div>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    {selectedSlot.teamName || `Slot ${selectedSlot.slotNumber}`}
                  </h3>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    <ShieldCheck className="w-3 h-3" /> Confirmed Team Roster
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSlot(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-card transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Details body */}
            <div className="space-y-3 text-xs">
              {/* Leader / Player */}
              <div className="p-3 rounded-xl bg-card border border-gray-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Team Leader / Registered By</span>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">{selectedSlot.leader || selectedSlot.teamName || 'N/A'}</span>
                  {selectedSlot.inGameName && (
                    <span className="text-gray-400 font-mono text-xs">IGN: {selectedSlot.inGameName}</span>
                  )}
                </div>
              </div>

              {/* Free Fire In-Game UID */}
              {selectedSlot.inGameId && (
                <div className="p-3 rounded-xl bg-card border border-gray-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider block">Free Fire In-Game UID</span>
                    <span className="font-mono font-bold text-brand-400 text-sm">{selectedSlot.inGameId}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(selectedSlot.inGameId, `modal_uid_${selectedSlot.slotNumber}`)}
                    className="px-2.5 py-1.5 rounded-lg bg-surface hover:bg-card border border-gray-700 text-gray-300 hover:text-white flex items-center gap-1 text-[11px] transition-colors cursor-pointer"
                  >
                    {copied === `modal_uid_${selectedSlot.slotNumber}` ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-green-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy UID</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Teammates Roster */}
              {Array.isArray(selectedSlot.teammates) && selectedSlot.teammates.length > 0 && (
                <div className="p-3 rounded-xl bg-card border border-gray-800 space-y-2">
                  <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider block">
                    Squad Teammates ({selectedSlot.teammates.length})
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedSlot.teammates.map((m: any, mIdx: number) => {
                      const memberName = typeof m === 'string' ? m : (m?.name || m?.inGameName || m?.username || `Member ${mIdx + 1}`);
                      const memberUid = typeof m === 'object' ? (m?.inGameId || m?.uid || m?.id) : null;
                      return (
                        <div key={mIdx} className="p-2 rounded-lg bg-surface/60 border border-gray-800 text-[11px]">
                          <div className="font-semibold text-white truncate">{memberName}</div>
                          {memberUid && <div className="text-[10px] font-mono text-gray-400">UID: {memberUid}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Additional Meta */}
              <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-400 p-2">
                <div>
                  <span className="block text-[10px] text-gray-500 uppercase">Slot Status</span>
                  <span className="text-emerald-400 font-bold uppercase">Locked / Active</span>
                </div>
                {selectedSlot.joinedAt && (
                  <div>
                    <span className="block text-[10px] text-gray-500 uppercase">Registered</span>
                    <span className="text-white">
                      {toDateSafe(selectedSlot.joinedAt)?.toLocaleDateString() || 'Recently'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-800">
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Release slot #${selectedSlot.slotNumber} ("${selectedSlot.teamName}")? This will remove the team from the lobby.`)) {
                    handleReleaseSlot(selectedSlot.slotNumber);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <UserX className="w-4 h-4" /> Release & Kick Slot
              </button>
              <button
                type="button"
                onClick={() => setSelectedSlot(null)}
                className="px-4 py-2 rounded-xl bg-card border border-gray-800 hover:bg-surface text-gray-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Slot Assignment Modal */}
      {isAssignModalOpen && assignSlotNumber !== null && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-gray-950 border border-gray-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-gray-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400 font-mono font-black text-sm">
                  #{assignSlotNumber}
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Assign Slot #{assignSlotNumber}</h3>
                  <p className="text-xs text-gray-400">Reserve or register a team directly for this slot.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAssignModalOpen(false);
                  setAssignSlotNumber(null);
                }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-card transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-xs text-gray-400 uppercase font-semibold mb-1.5">
                  Team Name <span className="text-red-400">*</span>
                </label>
                <input
                  value={manualTeamName}
                  onChange={(e) => setManualTeamName(e.target.value)}
                  placeholder="e.g. Total Gaming"
                  className="w-full bg-black border border-gray-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-brand-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 uppercase font-semibold mb-1.5">
                  Leader Name / IGN (Optional)
                </label>
                <input
                  value={manualLeader}
                  onChange={(e) => setManualLeader(e.target.value)}
                  placeholder="e.g. Ajay"
                  className="w-full bg-black border border-gray-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 uppercase font-semibold mb-1.5">
                  In-Game UID (Optional)
                </label>
                <input
                  value={manualUid}
                  onChange={(e) => setManualUid(e.target.value)}
                  placeholder="e.g. 192837465"
                  className="w-full bg-black border border-gray-800 rounded-xl p-3 text-sm text-white font-mono focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-800">
              <button
                type="button"
                onClick={() => {
                  handleManualAssignSlot(assignSlotNumber, 'Reserved', 'Host Reserved');
                }}
                className="px-3 py-2 rounded-xl bg-card border border-gray-800 hover:bg-surface text-gray-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Quick Reserve (Host)
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAssignModalOpen(false);
                    setAssignSlotNumber(null);
                  }}
                  className="px-3 py-2 rounded-xl text-gray-400 hover:text-white text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!manualTeamName.trim()) {
                      showToast('Please enter a team name', 'error');
                      return;
                    }
                    handleManualAssignSlot(assignSlotNumber, manualTeamName, manualLeader, manualUid);
                  }}
                  className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-white text-xs font-bold transition-colors shadow-md shadow-brand-500/20 cursor-pointer"
                >
                  Assign & Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
