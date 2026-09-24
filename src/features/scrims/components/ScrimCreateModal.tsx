import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, serverTimestamp, Timestamp, updateDoc, doc, setDoc, where, query, increment } from 'firebase/firestore';
import { Scrim } from '../../../shared/types/types';
import { db, auth } from '../../../shared/config/firebase';
import { useAuth } from '../../../shared/context/AuthContext';
import { useNotification } from '../../../shared/context/NotificationContext';
import Modal from '../../../shared/components/Modal';
import { ImageUploader } from '../../../shared/components/ImageUploader';
import { MediaCategory } from '../../../shared/services/mediaService';
import { PRESET_TOURNAMENT_BANNERS } from '../../../shared/constants/constants';
import {
  Radio,
  Gamepad2,
  Users,
  DollarSign,
  Calendar,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  MapPin,
  Lock,
  Tv,
  Save,
  Target,
  Trophy,
  AlertTriangle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency, formatGameName, toDateSafe, cleanFirestoreData } from '../../../shared/utils/utils';
import { fetchRoomCredentials, broadcastRoomCredentials, saveDraftRoomCredentials } from '../../../shared/services/roomCredentials';
import { announceNewScrim } from '../../../shared/services/DiscordService';
import { awardOrgExp } from '../../../shared/services/orgLevelService';
import { ORG_EXP_REWARDS } from '../../../shared/utils/utils';
import { ScrimSlot, normalizeScrimSlots, countFilledScrimSlots } from '../../../shared/utils/scrimSlots';

interface ScrimCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  editScrim?: any;
  initialMode?: 'STANDARD' | 'PER_KILL';
  onSuccess?: () => void;
}

const MAP_OPTIONS: Record<string, string[]> = {
  'Free Fire': ['Bermuda', 'Kalahari', 'Purgatory', 'Alpine', 'NeXTerra'],
  'PUBG Mobile': ['Erangel', 'Miramar', 'Sanhok', 'Vikendi', 'Nusa'],
  'Valorant': ['Bind', 'Haven', 'Split', 'Ascent', 'Icebox', 'Breeze', 'Lotus'],
  'Mobile Legends': ['Land of Dawn'],
  'Call of Duty Mobile': ['Crash', 'Crossfire', 'Killhouse', 'Firing Range'],
};

const STEPS = [
  { id: 1, title: 'Scrim Config', icon: Gamepad2 },
  { id: 2, title: 'Schedule & Room', icon: Calendar },
  { id: 3, title: 'Fees & Banner', icon: DollarSign },
];

export const calculateEstimatedBountyPool = (slots: number, teamType: string, killRate: number): number => {
  const t = String(teamType || '').toLowerCase();
  const s = Number(slots) || 12;
  const players = t === 'solo' || s === 48
    ? s
    : t === 'duo' || s === 25
      ? s * 2
      : s * 4;
  return Math.max(0, players * Math.max(0, Number(killRate) || 0));
};

export default function ScrimCreateModal({
  isOpen,
  onClose,
  editScrim,
  initialMode,
  onSuccess,
}: ScrimCreateModalProps) {
  const { user, profile } = useAuth();
  const { showToast } = useNotification();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [dbGames, setDbGames] = useState<any[]>([]);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'games'), where('isPublished', '==', true)));
        const gList = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        setDbGames(gList);
        if (!editScrim && gList.length > 0) {
          const firstGame = gList[0].name;
          setFormData(prev => ({
            ...prev,
            game: prev.game || firstGame,
            map: MAP_OPTIONS[firstGame]?.[0] || 'Default Map'
          }));
        }
      } catch (e) {
        console.warn('Could not fetch games in ScrimCreateModal:', e);
      }
    };
    fetchGames();
  }, [editScrim]);

  const [formData, setFormData] = useState({
    title: '',
    game: 'Free Fire',
    format: 'Battle Royale',
    teamType: 'squad', // solo | duo | squad | 5v5
    map: 'Bermuda',
    totalSlots: 12,
    scrimMode: (initialMode || 'STANDARD') as 'STANDARD' | 'PER_KILL',
    rewardPerKill: initialMode === 'PER_KILL' ? 20 : 0,
    minimumKillsForReward: 1,
    entryFee: 0,
    prizePool: initialMode === 'PER_KILL' ? 960 : 0,
    startTime: '',
    bannerUrl: '',
    roomId: '',
    roomPass: '',
    streamUrl: '',
    rules: '1. All players must join room on time.\n2. Emulators prohibited unless specified.\n3. Hacking/cheating results in immediate ban.',
  });

  useEffect(() => {
    if (editScrim) {
      const startDate = toDateSafe(editScrim.startTime);
      let formattedStartTime = '';
      if (startDate && !isNaN(startDate.getTime())) {
        const tzOffset = startDate.getTimezoneOffset() * 60000;
        formattedStartTime = new Date(startDate.getTime() - tzOffset).toISOString().slice(0, 16);
      }

      setFormData({
        title: editScrim.title || '',
        game: editScrim.game || 'Free Fire',
        format: editScrim.format || 'Battle Royale',
        teamType: editScrim.teamType || 'squad',
        map: editScrim.map || 'Bermuda',
        totalSlots: editScrim.totalSlots || (Array.isArray(editScrim.slots) ? editScrim.slots.length : Number(editScrim.slots) || 12),
        scrimMode: (editScrim.scrimMode || (editScrim.rewardPerKill > 0 ? 'PER_KILL' : 'STANDARD')) as 'STANDARD' | 'PER_KILL',
        rewardPerKill: editScrim.rewardPerKill || 0,
        minimumKillsForReward: editScrim.minimumKillsForReward || 1,
        entryFee: editScrim.entryFee || 0,
        prizePool: editScrim.prizePool || 0,
        startTime: formattedStartTime,
        bannerUrl: editScrim.bannerUrl || '',
        roomId: editScrim.roomId || '',
        roomPass: editScrim.roomPass || '',
        streamUrl: editScrim.ytLink || editScrim.streamUrl || '',
        rules: editScrim.rules || '',
      });

      // Load secured credentials from subcollection
      fetchRoomCredentials(editScrim.id, undefined, 'scrims').then(creds => {
        if (creds && (creds.roomId || creds.roomPass)) {
          setFormData(prev => ({
            ...prev,
            roomId: creds.roomId || prev.roomId,
            roomPass: creds.roomPass || prev.roomPass,
            streamUrl: creds.streamUrl || prev.streamUrl,
          }));
        }
      }).catch(() => {});

      setCurrentStep(1);
    } else {
      const mode = initialMode || 'STANDARD';
      const isPk = mode === 'PER_KILL';
      const defaultKillRate = isPk ? 20 : 0;
      const defaultSlots = 12;
      const defaultTeamType = 'squad';
      const estimatedPool = isPk ? calculateEstimatedBountyPool(defaultSlots, defaultTeamType, defaultKillRate) : 0;

      setFormData({
        title: isPk ? 'Free Fire Per-Kill Bounty Scrim' : '',
        game: dbGames[0]?.name || 'Free Fire',
        format: 'Battle Royale',
        teamType: defaultTeamType,
        map: MAP_OPTIONS[dbGames[0]?.name]?.[0] || 'Bermuda',
        totalSlots: defaultSlots,
        scrimMode: mode,
        rewardPerKill: defaultKillRate,
        minimumKillsForReward: 1,
        entryFee: 0,
        prizePool: estimatedPool,
        startTime: '',
        bannerUrl: '',
        roomId: '',
        roomPass: '',
        streamUrl: '',
        rules: '1. All players must join room on time.\n2. Emulators prohibited unless specified.\n3. Hacking/cheating results in immediate ban.',
      });
      setCurrentStep(1);
    }
  }, [editScrim, isOpen, initialMode]);

  const validateStep = () => {
    if (currentStep === 1) {
      return formData.title.trim() !== '' && formData.game !== '' && formData.totalSlots > 0;
    }
    if (currentStep === 2) {
      return formData.startTime !== '';
    }
    if (currentStep === 3) {
      return formData.entryFee >= 0 && formData.prizePool >= 0;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      if (currentStep < STEPS.length) setCurrentStep(currentStep + 1);
    } else {
      showToast('Please fill all required fields before proceeding', 'error');
    }
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!formData.title.trim()) {
      setCurrentStep(1);
      showToast('Please enter a title for the scrim', 'error');
      return;
    }
    if (!formData.startTime) {
      setCurrentStep(2);
      showToast('Please select a start date and time', 'error');
      return;
    }
    setLoading(true);
    try {
      const slotCount = Number(formData.totalSlots) || 12;
      const parsedPrizePool = Math.max(0, Math.round(Number(formData.prizePool || 0)));
      const parsedEntryFee = Math.max(0, Math.round(Number(formData.entryFee || 0)));
      const isFreeWithPrize = parsedEntryFee === 0 && parsedPrizePool > 0;
      const availableOrg = (profile?.orgWalletBalance || 0) + (profile?.balance || 0);

      // Free scrim with cash prize: Organizer MUST have sufficient balance to lock prize pool up-front
      if (!editScrim && isFreeWithPrize && availableOrg < parsedPrizePool) {
        showToast(
          `Insufficient wallet balance: Free scrims with a cash prize require the host to lock Rs. ${parsedPrizePool.toLocaleString()} from their wallet balance (Available: Rs. ${availableOrg.toLocaleString()}). Please top up your wallet.`,
          'error'
        );
        setLoading(false);
        return;
      }

      let slots: ScrimSlot[] = Array.from({ length: slotCount }, (_, idx) => ({
        slotNumber: idx + 1,
        status: 'open' as const,
        teamName: null,
        teamId: null,
      }));

      if (editScrim) {
        const existingSlots = normalizeScrimSlots(editScrim.slots, editScrim.totalSlots, editScrim.filledSlots ?? editScrim.currentPlayers);
        if (slotCount <= existingSlots.length) {
          slots = existingSlots.slice(0, slotCount);
        } else {
          const extra: ScrimSlot[] = Array.from({ length: slotCount - existingSlots.length }, (_, idx) => ({
            slotNumber: existingSlots.length + idx + 1,
            status: 'open' as const,
            teamName: null,
            teamId: null,
          }));
          slots = [...existingSlots, ...extra];
        }
      }

      const filledSlots = countFilledScrimSlots(slots);
      const parsedDate = toDateSafe(formData.startTime) || new Date(formData.startTime);
      const startTimestamp = (!parsedDate || isNaN(parsedDate.getTime()))
        ? Timestamp.now()
        : Timestamp.fromDate(parsedDate);

      const scrimPayload = {
        title: formData.title.trim(),
        game: formData.game,
        format: formData.format,
        teamType: formData.teamType,
        map: formData.map,
        matchType: 'scrims',
        isScrim: true,
        totalSlots: slotCount,
        slots,
        filledSlots,
        currentPlayers: filledSlots,
        entryFee: parsedEntryFee,
        prizePool: parsedPrizePool,
        fundingStatus: editScrim ? (editScrim.fundingStatus || (parsedPrizePool === 0 ? 'NOT_REQUIRED' : (isFreeWithPrize ? 'RESERVED' : 'PENDING_FUNDING'))) : (parsedPrizePool === 0 ? 'NOT_REQUIRED' : (isFreeWithPrize ? 'RESERVED' : 'PENDING_FUNDING')),
        requiredFunding: parsedPrizePool,
        reservedFunding: editScrim ? (editScrim.reservedFunding || 0) : (isFreeWithPrize ? parsedPrizePool : 0),
        lockedMoney: editScrim ? (editScrim.lockedMoney || 0) : (isFreeWithPrize ? parsedPrizePool : 0),
        escrowBalance: editScrim ? (editScrim.escrowBalance || 0) : (isFreeWithPrize ? parsedPrizePool : 0),
        collectedFees: editScrim ? ((editScrim as any).collectedFees || 0) : 0,
        collectedEntryFees: editScrim ? ((editScrim as any).collectedEntryFees || 0) : 0,
        scrimMode: formData.scrimMode,
        rewardPerKill: formData.scrimMode === 'PER_KILL' ? Number(formData.rewardPerKill) || 0 : 0,
        minimumKillsForReward: formData.scrimMode === 'PER_KILL' ? Math.max(1, Number(formData.minimumKillsForReward) || 1) : 0,
        currency: 'NPR',
        startTime: startTimestamp,
        bannerUrl: formData.bannerUrl || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80',
        ytLink: formData.streamUrl || '',
        rules: formData.rules,
        hostUid: user.uid,
        hostName: profile?.username || 'Organizer',
        status: editScrim ? editScrim.status : 'open',
        stage: editScrim ? editScrim.stage : 'registration',
        updatedAt: serverTimestamp(),
      };

      const cleanedPayload = cleanFirestoreData(scrimPayload);

      if (editScrim) {
        await updateDoc(doc(db, 'scrims', editScrim.id), cleanedPayload);

        if (formData.roomId || formData.roomPass) {
          if (editScrim.roomStatus === 'published') {
            await broadcastRoomCredentials(editScrim.id, formData.roomId, formData.roomPass, formData.streamUrl, 'scrims').catch(() => {});
          } else {
            await saveDraftRoomCredentials(editScrim.id, formData.roomId, formData.roomPass, formData.streamUrl, 'scrims').catch(() => {});
          }
        }
        showToast('Scrim updated successfully!', 'success');
      } else {
        const docRef = await addDoc(collection(db, 'scrims'), {
          ...cleanedPayload,
          orgExpAwardedForCreate: true,
          createdAt: serverTimestamp(),
        });

        // Award +20 Organization EXP for creating a scrim
        awardOrgExp(user.uid, ORG_EXP_REWARDS.SCRIM_CREATED, `Created scrim "${formData.title}"`).catch(() => {});

        // Free event with cash prize: Lock prize escrow from organizer's own wallet immediately
        if (isFreeWithPrize) {
          const deductOrg = Math.min(profile?.orgWalletBalance || 0, parsedPrizePool);
          const deductPlayer = parsedPrizePool - deductOrg;
          const userUpdates: any = {
            reservedBalance: increment(parsedPrizePool),
            updatedAt: serverTimestamp(),
          };
          if (deductOrg > 0) userUpdates.orgWalletBalance = increment(-deductOrg);
          if (deductPlayer > 0) userUpdates.balance = increment(-deductPlayer);
          await updateDoc(doc(db, 'users', user.uid), userUpdates).catch(() => {});

          const txRef = doc(collection(db, 'transactions'));
          await setDoc(txRef, {
            id: txRef.id,
            userId: user.uid,
            username: profile?.username || 'Organizer',
            type: 'tournament_reservation',
            amount: -parsedPrizePool,
            method: 'Prize Pool Escrow Lock',
            status: 'success',
            desc: `Prize pool reserve locked from wallet for free scrim "${formData.title}"`,
            scrimId: docRef.id,
            timestamp: serverTimestamp(),
          }).catch(() => {});

          showToast(`Free scrim published (+20 Org EXP) and Rs. ${parsedPrizePool.toLocaleString()} prize funds locked in escrow!`, 'success');
        } else {
          showToast('Scrim created successfully! (+20 Org EXP)', 'success');
        }

        if (formData.roomId || formData.roomPass) {
          await saveDraftRoomCredentials(docRef.id, formData.roomId, formData.roomPass, formData.streamUrl, 'scrims').catch(() => {});
        }

        // Automated Discord announcement for newly created scrim
        announceNewScrim({
          id: docRef.id,
          title: scrimPayload.title,
          game: scrimPayload.game,
          teamType: scrimPayload.teamType,
          startTime: parsedDate,
          prizePool: scrimPayload.prizePool,
          entryFee: scrimPayload.entryFee,
          currentPlayers: filledSlots,
          slots: slotCount,
          bannerUrl: scrimPayload.bannerUrl,
        } as any).catch((e) => console.warn('Discord scrim announcement warning:', e));
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('Scrim creation error:', err);
      showToast(err.message || 'Failed to save scrim', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editScrim ? 'Edit Practice Scrim' : 'Create New Practice Scrim'}
    >
      <div className="space-y-6">
        {/* Step Indicator */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-4">
          {STEPS.map((step) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isDone = currentStep > step.id;
            return (
              <div key={step.id} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black transition-colors ${
                    isActive
                      ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                      : isDone
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-dark border border-gray-800 text-gray-500'
                  }`}
                >
                  {isDone ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span
                  className={`text-xs font-black uppercase tracking-widest hidden sm:inline ${
                    isActive ? 'text-white' : isDone ? 'text-emerald-400' : 'text-gray-500'
                  }`}
                >
                  {step.title}
                </span>
              </div>
            );
          })}
        </div>

        {/* Step 1: Scrim Config */}
        {currentStep === 1 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
            {/* Scrim Match Mode Selector */}
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                Scrim Match Mode *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, scrimMode: 'STANDARD' })}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                    formData.scrimMode === 'STANDARD'
                      ? 'bg-emerald-500/10 border-emerald-500 text-white shadow-lg shadow-emerald-500/10'
                      : 'bg-black border-gray-800 text-gray-400 hover:border-gray-700'
                  }`}
                >
                  <div className={`p-2 rounded-xl shrink-0 ${formData.scrimMode === 'STANDARD' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-400'}`}>
                    <Trophy className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider block text-white">Standard Scrim</span>
                    <p className="text-[11px] text-gray-400 mt-0.5">Classic placement podium payout (1st, 2nd, 3rd ranked teams).</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const defaultRate = formData.rewardPerKill || 20;
                    const estimatedPool = (formData.totalSlots || 12) * defaultRate * (formData.teamType === 'solo' ? 1 : 4);
                    setFormData({
                      ...formData,
                      scrimMode: 'PER_KILL',
                      rewardPerKill: defaultRate,
                      prizePool: formData.prizePool || estimatedPool,
                    });
                  }}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                    formData.scrimMode === 'PER_KILL'
                      ? 'bg-amber-500/10 border-amber-500 text-white shadow-lg shadow-amber-500/10'
                      : 'bg-black border-gray-800 text-gray-400 hover:border-gray-700'
                  }`}
                >
                  <div className={`p-2 rounded-xl shrink-0 ${formData.scrimMode === 'PER_KILL' ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-800 text-gray-400'}`}>
                    <Target className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider block text-white flex items-center gap-1.5">
                      Per-Kill Scrim <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/30 text-amber-300 font-mono">BOUNTY</span>
                    </span>
                    <p className="text-[11px] text-gray-400 mt-0.5">Cash bounty awarded for every verified kill & elimination.</p>
                  </div>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                Scrim Title *
              </label>
              <input
                type="text"
                placeholder={formData.scrimMode === 'PER_KILL' ? "e.g. Free Fire Per-Kill Bounty Night #12" : "e.g. Free Fire Night Scrim #12"}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full bg-black border border-gray-800 rounded-xl p-3 text-sm text-white font-bold focus-visible:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                  Esports Game *
                </label>
                <select
                  value={formData.game}
                  onChange={(e) => {
                    const newGame = e.target.value;
                    const defaultMap = MAP_OPTIONS[newGame]?.[0] || 'Default Map';
                    setFormData({ ...formData, game: newGame, map: defaultMap });
                  }}
                  className="w-full bg-black border border-gray-800 rounded-xl p-3 text-sm text-white font-bold focus-visible:outline-none focus:border-emerald-500"
                >
                  {(dbGames.length > 0
                    ? Array.from(new Set(dbGames.map((g) => g.name)))
                    : (formData.game ? [formData.game] : ['Free Fire'])
                  ).map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                  Map Selection
                </label>
                <select
                  value={formData.map}
                  onChange={(e) => setFormData({ ...formData, map: e.target.value })}
                  className="w-full bg-black border border-gray-800 rounded-xl p-3 text-sm text-white font-bold focus-visible:outline-none focus:border-emerald-500"
                >
                  {(MAP_OPTIONS[formData.game] || ['Default Map']).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                  Team Format
                </label>
                <select
                  value={formData.teamType}
                  onChange={(e) => {
                    const type = e.target.value;
                    const slots = type === 'solo' ? 48 : type === 'duo' ? 25 : 12;
                    const newPool = formData.scrimMode === 'PER_KILL'
                      ? calculateEstimatedBountyPool(slots, type, formData.rewardPerKill || 20)
                      : formData.prizePool;
                    setFormData({ ...formData, teamType: type, totalSlots: slots, prizePool: newPool });
                  }}
                  className="w-full bg-black border border-gray-800 rounded-xl p-3 text-sm text-white font-bold focus-visible:outline-none focus:border-emerald-500"
                >
                  <option value="squad">Squad (12 Slots - 12 Teams)</option>
                  <option value="duo">Duo (25 Slots - 25 Teams)</option>
                  <option value="solo">Solo (48 Slots - 48 Players)</option>
                  <option value="5v5">5v5 Custom Lobby (12 Slots)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                  Total Slots *
                </label>
                <select
                  value={formData.totalSlots}
                  onChange={(e) => {
                    const slots = Number(e.target.value);
                    const newPool = formData.scrimMode === 'PER_KILL'
                      ? calculateEstimatedBountyPool(slots, formData.teamType, formData.rewardPerKill || 20)
                      : formData.prizePool;
                    setFormData({ ...formData, totalSlots: slots, prizePool: newPool });
                  }}
                  className="w-full bg-black border border-gray-800 rounded-xl p-3 text-sm text-white font-bold focus-visible:outline-none focus:border-emerald-500"
                >
                  <option value={12}>12 Slots (Squad BR - 12 Teams)</option>
                  <option value={25}>25 Slots (Duo BR - 25 Teams)</option>
                  <option value={48}>48 Slots (Solo BR - 48 Players)</option>
                </select>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 2: Schedule & Room Info */}
        {currentStep === 2 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" /> Start Date & Time *
              </label>
              <input
                type="datetime-local"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="w-full bg-black border border-gray-800 rounded-xl p-3 text-sm text-white font-bold focus-visible:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="bg-dark/50 border border-gray-800 p-4 rounded-2xl space-y-3">
              <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" /> Room Credentials (Optional Broadcast)
              </h4>
              <p className="text-[11px] text-gray-500">
                You can pre-configure room details or set them later before going live.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Room ID</label>
                  <input
                    type="text"
                    placeholder="e.g. 8492041"
                    value={formData.roomId}
                    onChange={(e) => setFormData({ ...formData, roomId: e.target.value })}
                    className="w-full bg-black border border-gray-800 rounded-xl p-2.5 text-xs text-white font-mono focus-visible:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Room Password</label>
                  <input
                    type="text"
                    placeholder="e.g. ffpass"
                    value={formData.roomPass}
                    onChange={(e) => setFormData({ ...formData, roomPass: e.target.value })}
                    className="w-full bg-black border border-gray-800 rounded-xl p-2.5 text-xs text-white font-mono focus-visible:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Tv className="w-3.5 h-3.5 text-emerald-400" /> Live Stream Link (Optional)
              </label>
              <input
                type="url"
                placeholder="https://youtube.com/live/..."
                value={formData.streamUrl}
                onChange={(e) => setFormData({ ...formData, streamUrl: e.target.value })}
                className="w-full bg-black border border-gray-800 rounded-xl p-3 text-sm text-white font-bold focus-visible:outline-none focus:border-emerald-500"
              />
            </div>
          </motion.div>
        )}

        {/* Step 3: Fees & Banner */}
        {currentStep === 3 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
            {/* Scrim Reward Format Selection */}
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                Reward Structure
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, scrimMode: 'STANDARD' })}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    formData.scrimMode === 'STANDARD'
                      ? 'bg-emerald-500/10 border-emerald-500 text-white shadow-lg shadow-emerald-500/10'
                      : 'bg-black border-gray-800 text-gray-400 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Trophy className={`w-4 h-4 ${formData.scrimMode === 'STANDARD' ? 'text-emerald-400' : 'text-gray-500'}`} />
                    <span className="text-xs font-black uppercase tracking-wider">Standard Podium</span>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Prize pool allocated to top 1st, 2nd, 3rd ranked winners.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const defaultKillRate = formData.rewardPerKill || 20;
                    const estimatedPool = calculateEstimatedBountyPool(formData.totalSlots, formData.teamType, defaultKillRate);
                    setFormData({
                      ...formData,
                      scrimMode: 'PER_KILL',
                      rewardPerKill: defaultKillRate,
                      prizePool: estimatedPool,
                    });
                  }}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    formData.scrimMode === 'PER_KILL'
                      ? 'bg-brand-500/10 border-brand-500 text-white shadow-lg shadow-brand-500/10'
                      : 'bg-black border-gray-800 text-gray-400 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Target className={`w-4 h-4 ${formData.scrimMode === 'PER_KILL' ? 'text-brand-400' : 'text-gray-500'}`} />
                    <span className="text-xs font-black uppercase tracking-wider">Per-Kill Bounty</span>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Cash reward calculated and paid per verified kill/elimination.
                  </p>
                </button>
              </div>
            </div>

            {/* Per-Kill Configuration Options */}
            {formData.scrimMode === 'PER_KILL' && (
              <div className="bg-brand-500/10 border border-brand-500/20 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-brand-300 uppercase tracking-wide flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5" /> Per-Kill Bounty Config
                  </span>
                  <span className="text-[10px] font-mono font-bold text-brand-400 bg-brand-500/20 px-2 py-0.5 rounded-full border border-brand-500/30">
                    NPR / Kill
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">
                      Reward Per Kill (Rs.) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 20"
                      value={formData.rewardPerKill || ''}
                      onChange={(e) => {
                        const rate = Math.max(0, Number(e.target.value));
                        const newPool = calculateEstimatedBountyPool(formData.totalSlots, formData.teamType, rate);
                        setFormData({
                          ...formData,
                          rewardPerKill: rate,
                          prizePool: newPool,
                        });
                      }}
                      className="w-full bg-black border border-gray-800 rounded-xl p-2.5 text-xs text-white font-bold focus-visible:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">
                      Min Kills Required
                    </label>
                    <input
                      type="number"
                      min="1"
                      disabled
                      value={1}
                      title="Minimum kill threshold is fixed at 1 kill"
                      className="w-full bg-black/60 border border-gray-800 rounded-xl p-2.5 text-xs text-brand-400 font-bold cursor-not-allowed opacity-90"
                    />
                    <span className="text-[10px] text-gray-500 font-medium mt-0.5 block">Fixed at 1 kill minimum</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-amber-300 font-bold bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl">
                  <span>
                    Bounty Pool: {formData.teamType === 'solo' || formData.totalSlots === 48 ? formData.totalSlots : formData.teamType === 'duo' ? formData.totalSlots * 2 : formData.totalSlots * 4} players × Rs. {formData.rewardPerKill || 0} = Rs. {calculateEstimatedBountyPool(formData.totalSlots, formData.teamType, formData.rewardPerKill || 0).toLocaleString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const pool = calculateEstimatedBountyPool(formData.totalSlots, formData.teamType, formData.rewardPerKill || 20);
                      setFormData(prev => ({ ...prev, prizePool: pool }));
                      showToast(`Prize pool updated to Rs. ${pool.toLocaleString()}`, 'info');
                    }}
                    className="px-2 py-0.5 rounded bg-amber-500 text-black font-black text-[10px] uppercase hover:bg-amber-400 cursor-pointer"
                  >
                    Auto-Fill
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                  Entry Fee (Rs.)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0 for FREE"
                  value={formData.entryFee}
                  onChange={(e) => setFormData({ ...formData, entryFee: Number(e.target.value) })}
                  className="w-full bg-black border border-gray-800 rounded-xl p-3 text-sm text-white font-bold focus-visible:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                  {formData.scrimMode === 'PER_KILL' ? 'Prize Pool / Bounty Pool (Rs.)' : 'Prize Pool (Rs.)'}
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0 for no prize"
                  value={formData.prizePool}
                  onChange={(e) => setFormData({ ...formData, prizePool: Number(e.target.value) })}
                  className="w-full bg-black border border-gray-800 rounded-xl p-3 text-sm text-white font-bold focus-visible:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* ─── SCRIM FUNDING & WALLET ESCROW STATUS ─── */}
            {(() => {
              const reqFunding = Math.max(0, Math.round(Number(formData.prizePool || 0)));
              const entryFee = Math.max(0, Math.round(Number(formData.entryFee || 0)));
              const isFreeWithPrize = entryFee === 0 && reqFunding > 0;
              const availableOrg = (profile?.orgWalletBalance || 0) + (profile?.balance || 0);
              const shortage = Math.max(0, reqFunding - availableOrg);
              const isFunded = availableOrg >= reqFunding;

              if (reqFunding === 0) {
                return (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-black text-emerald-300 uppercase tracking-wide">Free Practice Scrim — Zero Prize Pool</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        This practice scrim requires NPR 0 organizer funding and no prize escrow.
                      </div>
                    </div>
                  </div>
                );
              }

              if (isFreeWithPrize) {
                return (
                  <div className={`p-4 rounded-xl border space-y-3 ${isFunded ? 'bg-brand-500/10 border-brand-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isFunded ? <Lock className="w-4 h-4 text-brand-400" /> : <AlertTriangle className="w-4 h-4 text-amber-400" />}
                        <span className="text-xs font-black uppercase tracking-wider text-white">
                          {isFunded ? 'Free Scrim Prize Escrow Secured' : 'Organizer Wallet Funding Required'}
                        </span>
                      </div>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${isFunded ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
                        {isFunded ? 'Sufficient Balance' : 'Insufficient Balance'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 bg-black/40 p-3 rounded-lg border border-white/5 text-center">
                      <div>
                        <div className="text-[9px] text-gray-500 uppercase font-black tracking-widest">Required Prize</div>
                        <div className="text-xs font-black text-white font-mono">Rs. {reqFunding.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-gray-500 uppercase font-black tracking-widest">Available Wallet</div>
                        <div className="text-xs font-black text-emerald-400 font-mono">Rs. {availableOrg.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-gray-500 uppercase font-black tracking-widest">{shortage > 0 ? 'Shortage' : 'Status'}</div>
                        <div className={`text-xs font-black font-mono ${shortage > 0 ? 'text-red-400' : 'text-brand-400'}`}>
                          {shortage > 0 ? `Rs. ${shortage.toLocaleString()}` : 'Ready to Lock'}
                        </div>
                      </div>
                    </div>

                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      {isFunded
                        ? `Upon creation, Rs. ${reqFunding.toLocaleString()} will be automatically locked in escrow from your organizer wallet. Free scrims generate 0 profit for the host and platform; all prize money goes directly to the winners.`
                        : `Free scrims with a cash prize require the organizer to deposit 100% of the prize pool from their wallet up front. Please top up your wallet to proceed.`}
                    </p>
                  </div>
                );
              }

              // Paid scrim info
              const totalSlots = Number(formData.totalSlots) || 12;
              const estMaxCollection = totalSlots * entryFee;
              const estMargin = estMaxCollection - reqFunding;

              return (
                <div className="bg-dark/60 border border-gray-800 p-4 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-black text-white uppercase tracking-wider">
                    <span>Paid Scrim Financial Projection</span>
                    <span className={estMargin >= 0 ? 'text-emerald-400 font-mono' : 'text-amber-400 font-mono'}>
                      {estMargin >= 0 ? `Max Margin: +Rs. ${estMargin.toLocaleString()}` : `Deficit: Rs. ${estMargin.toLocaleString()}`}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400">
                    Player slot registration fees (Rs. {entryFee.toLocaleString()} / slot) will be held in your tournament locked wallet. On match completion, profit margin (Collections − Prize Pool) is calculated and your share is queued for payout.
                  </div>
                </div>
              );
            })()}

            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                Scrim Banner Image
              </label>
              <ImageUploader
                category={MediaCategory.TOURNAMENT_BANNER}
                value={formData.bannerUrl}
                onChange={(url) => setFormData({ ...formData, bannerUrl: url })}
                label="Upload Scrim Banner"
                aspectRatio="banner"
              />
              <div className="flex gap-2 mt-2 overflow-x-auto pb-2">
                {PRESET_TOURNAMENT_BANNERS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setFormData({ ...formData, bannerUrl: preset })}
                    className="w-16 h-10 rounded-lg overflow-hidden border border-gray-800 hover:border-emerald-500 shrink-0"
                  >
                    <img src={preset} alt="preset" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                Scrim Rules / Instructions
              </label>
              <textarea
                rows={3}
                value={formData.rules}
                onChange={(e) => setFormData({ ...formData, rules: e.target.value })}
                className="w-full bg-black border border-gray-800 rounded-xl p-3 text-xs text-white focus-visible:outline-none focus:border-emerald-500"
              />
            </div>
          </motion.div>
        )}

        {/* Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-800">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-2.5 bg-dark border border-gray-800 text-gray-300 rounded-xl text-xs font-black uppercase tracking-widest hover:text-white flex items-center gap-1.5"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          ) : (
            <div />
          )}

          {currentStep < STEPS.length ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-widest rounded-xl flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={handleSubmit}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-black text-xs uppercase tracking-widest rounded-xl flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" /> {editScrim ? 'Save Changes' : 'Create Scrim'}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
