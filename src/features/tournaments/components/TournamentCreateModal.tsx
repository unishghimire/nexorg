import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, serverTimestamp, Timestamp, updateDoc, doc, setDoc, where, query } from 'firebase/firestore';
import { Tournament } from '../../../shared/types/types';
import { createScoringSnapshot } from '../../../shared/services/scoringEngine';
import { generateDefaultRoadmap } from '../../../shared/services/tournamentEngine';
import { TournamentScoringSnapshot } from '../../../shared/types/scoring';
import { TournamentMode, RewardConfig, RewardSnapshot, DEFAULT_REWARD_CONFIG } from '../../../shared/types/per-kill';
import { createRewardSnapshot } from '../../../shared/services/perKillEngine';
import { db, auth } from '../../../shared/config/firebase';
import { useAuth } from '../../../shared/context/AuthContext';
import { useNotification } from '../../../shared/context/NotificationContext';
import Modal from '../../../shared/components/Modal';
import { useInvisibleImage } from '../../../shared/hooks/useInvisibleImage';
import { ImageUploader } from '../../../shared/components/ImageUploader';
import { MediaCategory } from '../../../shared/services/mediaService';
import { PRESET_TOURNAMENT_BANNERS, getMapsForGame } from '../../../shared/constants/constants';
import { withStaticCache } from '../../../shared/utils/staticCache';
import { 
  Trophy, 
  Gamepad2, 
  Users, 
  DollarSign, 
  FileText, 
  ChevronRight, 
  ChevronLeft,
  CheckCircle2,
  Info,
  Target,
  Lock,
  ShieldAlert,
  AlertTriangle,
  Wallet,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import PrizeDistributionInput from './PrizeDistributionInput';
import { formatCurrency, formatGameModeLabel, formatGameName, toDateSafe } from '../../../shared/utils/utils';
import { commitFirestoreBatches } from '../../../shared/utils/firestoreBatches';
import { fetchRoomCredentials, broadcastRoomCredentials } from '../../../shared/services/roomCredentials';

interface TournamentCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editTournament?: Tournament | null;
  defaultMatchType?: 'tournament' | 'scrims';
}

const STEPS = [
  { id: 1, title: 'Basic Info', icon: Gamepad2, description: 'Tournament identity' },
  { id: 2, title: 'Format', icon: Users, description: 'Match structure' },
  { id: 3, title: 'Economy', icon: DollarSign, description: 'Prizes & Entry' },
  { id: 4, title: 'Rules', icon: FileText, description: 'Terms & Conditions' },
  { id: 5, title: 'Review', icon: CheckCircle2, description: 'Final check' },
];

const TournamentCreateModal: React.FC<TournamentCreateModalProps> = ({ isOpen, onClose, onSuccess, editTournament, defaultMatchType = 'tournament' }) => {
  const { user, profile } = useAuth();
  const { showToast } = useNotification();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [games, setGames] = useState<any[]>([]);
  // ponytail: setter used by useInvisibleImage callbacks, getter intentionally unused
  const [, setIsUploadingBanner] = useState(false);
  const [isGeneratingBanner, setIsGeneratingBanner] = useState(false);

  const { handlePaste, handleDrop, handleDragOver, processAndUpload } = useInvisibleImage({
    onUploadStart: () => setIsUploadingBanner(true),
    onUploadEnd: () => setIsUploadingBanner(false),
    onUploadSuccess: (url) => setFormData(prev => ({ ...prev, bannerUrl: url })),
    onError: (err) => showToast(err, 'error')
  });

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    game: '',
    bannerUrl: '',
    type: 'Battle Royale',
    format: 'single_elimination' as any,
    map: '',
    teamType: 'solo' as 'solo' | 'duo' | 'squad',
    teamSize: 1,
    slots: 100,
    prizePool: 0,
    currency: 'NPR',
    entryFee: 0,
    startTime: '',
    rules: '',
    roomId: '',
    roomPass: '',
    prizeDistribution: [
      { id: 'prize-initial-1', rank: 1, label: '1st', amount: 0 },
    ] as any[],
    matchType: 'scrims' as 'scrims' | 'tournament',
    scheduleType: 'auto' as 'auto' | 'manual',
    registrationType: 'auto' as 'auto' | 'manual',
    tournamentMode: 'POINTS' as TournamentMode,
    rewardPerKill: 10,
    rewardCurrency: 'NPR',
    minimumKillsForReward: 0,
    maximumRewardPerPlayer: 0,
  });

  const [selectedGame, setSelectedGame] = useState<any>(null);

  useEffect(() => {
    const fetchGames = async () => {
      const snap = await withStaticCache('games_published', () =>
        getDocs(query(collection(db, 'games'), where('isPublished', '==', true)))
      );
      setGames(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchGames();
  }, []);

  useEffect(() => {
    if (editTournament) {
      setFormData({
        title: editTournament.title,
        game: editTournament.game,
        bannerUrl: editTournament.bannerUrl || '',
        type: editTournament.type,
        format: editTournament.format || 'single_elimination',
        map: editTournament.map || '',
        teamType: editTournament.teamType as any,
        teamSize: editTournament.teamSize,
        slots: editTournament.slots,
        prizePool: editTournament.prizePool,
        currency: editTournament.currency || 'NPR',
        entryFee: editTournament.entryFee,
        roomId: editTournament.roomId || '',
        roomPass: editTournament.roomPass || '',
        startTime: (() => {
          const startDate = toDateSafe(editTournament.startTime);
          if (!startDate) return '';
          return new Date(startDate.getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        })(),
        rules: editTournament.rules || '',
        matchType: editTournament.matchType || 'tournament',
        scheduleType: editTournament.scheduleType || 'auto',
        registrationType: editTournament.registrationType || 'auto',
        tournamentMode: (editTournament as any).tournamentMode || 'POINTS',
        rewardPerKill: (editTournament as any).rewardSnapshot?.rewardPerKill || (editTournament as any).rewardSnapshot?.rewardPerKill !== undefined ? (editTournament as any).rewardSnapshot?.rewardPerKill : 10,
        rewardCurrency: (editTournament as any).rewardSnapshot?.currency || 'NPR',
        minimumKillsForReward: (editTournament as any).rewardSnapshot?.minimumKillsForReward || 0,
        maximumRewardPerPlayer: (editTournament as any).rewardSnapshot?.maximumRewardPerPlayer || 0,
        prizeDistribution: editTournament.prizeDistribution && editTournament.prizeDistribution.length > 0 
          ? editTournament.prizeDistribution.map(p => ({
              id: p.id || `prize-${Date.now()}-${Math.random()}`,
              rank: p.rank,
              label: p.label || `${p.rank}`,
              amount: p.amount
            }))
          : [{ id: 'prize-initial-1', rank: 1, label: '1st', amount: 0 }]
      });

      // Load secured credentials from subcollection
      fetchRoomCredentials(
        editTournament.id,
        undefined,
        (editTournament.matchType === 'scrims' || (editTournament as any).isScrim) ? 'scrims' : 'tournaments'
      ).then(creds => {
        if (creds && (creds.roomId || creds.roomPass)) {
          setFormData(prev => ({
            ...prev,
            roomId: creds.roomId || prev.roomId,
            roomPass: creds.roomPass || prev.roomPass,
          }));
        }
      }).catch(() => {});

      setCurrentStep(1);
    } else {
      setFormData({
        title: '',
        game: '',
        bannerUrl: '',
        type: 'Battle Royale',
        format: 'single_elimination',
        map: '',
        teamType: 'solo',
        teamSize: 1,
        slots: 100,
        prizePool: 0,
        currency: 'NPR',
        entryFee: 0,
        roomId: '',
        roomPass: '',
        startTime: '',
        rules: '',
        matchType: defaultMatchType,
        scheduleType: 'auto',
        registrationType: 'auto',
        tournamentMode: 'POINTS' as TournamentMode,
        rewardPerKill: 10,
        rewardCurrency: 'NPR',
        minimumKillsForReward: 0,
        maximumRewardPerPlayer: 0,
        prizeDistribution: [
          { id: 'prize-initial-1', rank: 1, label: '1st', amount: 0 },
        ]
      });
    }
  }, [editTournament, isOpen, defaultMatchType]);

  const validateStep = () => {
    switch (currentStep) {
      case 1:
        return formData.title.trim() !== '' && formData.game !== '';
      case 2:
        return formData.type !== '' && formData.slots > 0 && formData.startTime !== '';
      case 3:
        const totalPrize = formData.prizeDistribution.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
        const hasValidPrizes = formData.prizeDistribution.length === 0 || 
          formData.prizeDistribution.every(p => p.amount > 0 && p.label.trim() !== '');
        return formData.prizePool >= 0 && formData.entryFee >= 0 && 
               (formData.prizePool === 0 || totalPrize <= formData.prizePool) && 
               hasValidPrizes;
      case 4:
        return formData.rules.trim() !== '';
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep()) {
      if (currentStep < STEPS.length) setCurrentStep(currentStep + 1);
    } else {
      showToast('Please fill all required fields correctly', 'error');
    }
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!validateStep()) {
      showToast('Please complete all steps correctly', 'error');
      return;
    }
    setLoading(true);
    try {
      const { roomId, roomPass, ...publicFormData } = formData;
      const isScrim = formData.matchType === 'scrims';
      const slotCount = Number(formData.slots) || 20;
      const initialSlots = isScrim ? Array.from({ length: slotCount }, (_, idx) => ({
        slotNumber: idx + 1,
        status: 'open' as const,
        teamName: null,
        teamId: null,
      })) : formData.slots;

      const requiredFunding = isScrim ? 0 : Math.max(0, Math.round(Number(formData.prizePool || 0)));
      const initialFundingStatus = isScrim || requiredFunding === 0 ? 'NOT_REQUIRED' : 'PENDING_FUNDING';
      const initialStatus = isScrim || requiredFunding === 0 ? 'upcoming' : 'pending_funding';

      const tournamentData = {
        ...publicFormData,
        matchType: formData.matchType || (isScrim ? 'scrims' : 'tournament'),
        isScrim,
        slots: initialSlots,
        totalSlots: slotCount,
        filledSlots: editTournament ? ((editTournament as any).filledSlots ?? editTournament.currentPlayers) : 0,
        tournamentMode: formData.tournamentMode,
        hostUid: editTournament ? editTournament.hostUid : user.uid,
        currentPlayers: editTournament ? editTournament.currentPlayers : 0,
        status: editTournament ? editTournament.status : initialStatus,
        fundingStatus: editTournament ? (editTournament.fundingStatus || initialFundingStatus) : initialFundingStatus,
        requiredFunding,
        reservedFunding: editTournament ? (editTournament.reservedFunding || 0) : 0,
        stage: editTournament ? editTournament.stage : 'registration',
        updatedAt: serverTimestamp(),
        startTime: Timestamp.fromDate(new Date(formData.startTime)),
        isFeatured: editTournament ? editTournament.isFeatured : false,
      };

      if (editTournament) {
        await Promise.all([
          setDoc(doc(db, 'tournaments', editTournament.id), tournamentData, { merge: true }).catch(() => {}),
          setDoc(doc(db, 'scrims', editTournament.id), tournamentData, { merge: true }).catch(() => {}),
        ]);
        if (roomId || roomPass) {
          await broadcastRoomCredentials(editTournament.id, roomId, roomPass, formData.bannerUrl, isScrim ? 'scrims' : 'tournaments');
        }
        showToast('Tournament updated successfully!', 'success');
      } else {
        // Create scoring snapshot from the selected game's scoring config
        let scoringSnapshot: TournamentScoringSnapshot | undefined;
        if (selectedGame?.scoring?.enabled) {
          scoringSnapshot = createScoringSnapshot({
            gameId: selectedGame.id,
            gameName: selectedGame.name,
            scoring: selectedGame.scoring,
          });
        }

        // Create reward snapshot for PER_KILL_REWARD tournaments
        let rewardSnapshot: RewardSnapshot | undefined;
        if (formData.tournamentMode === 'PER_KILL_REWARD') {
          rewardSnapshot = createRewardSnapshot({
            gameId: selectedGame?.id || '',
            gameName: selectedGame?.name || formData.game,
            rewardConfig: {
              enabled: true,
              rewardPerKill: formData.rewardPerKill,
              currency: formData.rewardCurrency,
              minimumKillsForReward: formData.minimumKillsForReward,
              maximumRewardPerPlayer: formData.maximumRewardPerPlayer > 0 ? formData.maximumRewardPerPlayer : undefined,
            },
          });
        }

        // Generate default roadmap based on slots + type
        const defaultRoadmap = generateDefaultRoadmap(formData.slots, formData.type);

        const docRef = await addDoc(collection(db, 'tournaments'), {
          ...tournamentData,
          tournamentMode: formData.tournamentMode,
          ...(scoringSnapshot ? { scoringSnapshot } : {}),
          ...(rewardSnapshot ? { rewardSnapshot } : {}),
          roadmap: defaultRoadmap,
          currentRound: 1,
          createdAt: serverTimestamp()
        });
        if (roomId || roomPass) {
          await setDoc(doc(db, 'tournaments', docRef.id, 'credentials', 'main'), { roomId, roomPass });
        }

        // If funded tournament, attempt atomic activation/fund reservation immediately
        if (!isScrim && requiredFunding > 0) {
          try {
            const token = await auth.currentUser?.getIdToken();
            if (token) {
              const activateRes = await fetch(`/api/tournaments/${docRef.id}/activate`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
              });
              const activateData = await activateRes.json().catch(() => ({}));
              if (activateRes.ok && activateData.fundingStatus === 'RESERVED') {
                showToast(`Tournament created and Rs. ${requiredFunding.toLocaleString()} prize funds secured in escrow!`, 'success');
              } else {
                showToast(`Tournament created in PENDING FUNDING. Top up your wallet to activate registration.`, 'info');
              }
            }
          } catch (fundErr) {
            console.warn("Auto-funding activation check deferred:", fundErr);
            showToast('Tournament created in PENDING FUNDING status.', 'info');
          }
        } else {
          showToast('Tournament created successfully!', 'success');
        }

        // Notify followers
        const followsSnap = await getDocs(query(collection(db, 'follows'), where('followingId', '==', user.uid)));
        const notificationOperations = followsSnap.docs.map(fDoc => batch => {
            const followerId = fDoc.data().followerId;
            const notifRef = doc(collection(db, 'notifications'));
            batch.set(notifRef, {
                userId: followerId,
                title: 'New Tournament!',
                message: `${formData.title} has been created by ${profile?.username || 'an organizer'}`,
                type: 'info',
                read: false,
                link: `/tournaments/${docRef.id}`,
                timestamp: serverTimestamp()
            });
        });
        await commitFirestoreBatches(db, notificationOperations);

        // Automatically announce new tournament to main Discord server if configured by admin
        try {
          const { announceNewTournament } = await import('../../../shared/services/DiscordService');
          announceNewTournament({
            id: docRef.id,
            title: formData.title,
            game: formData.game,
            teamType: formData.teamType as any,
            type: formData.type as any,
            map: formData.map,
            startTime: formData.startTime,
            prizePool: formData.prizePool,
            entryFee: formData.entryFee,
            currentPlayers: 0,
            slots: formData.slots,
            bannerUrl: formData.bannerUrl,
            status: 'upcoming',
            createdAt: new Date(),
            hostUid: user.uid,
          } as any).catch(err => console.warn('Auto Discord announcement deferred:', err));
        } catch (discordErr) {
          // ignore background discord notification error
        }
      }
      
      onSuccess();
      onClose();
      // Reset form
      if (!editTournament) {
        setFormData({
          title: '',
          game: '',
          bannerUrl: '',
          type: 'Battle Royale',
          format: 'single_elimination',
          map: '',
          teamType: 'solo',
          teamSize: 1,
          slots: 100,
          prizePool: 0,
          currency: 'NPR',
          entryFee: 0,
          roomId: '',
          roomPass: '',
          startTime: '',
          rules: '',
          matchType: 'tournament',
          scheduleType: 'auto',
          registrationType: 'auto',
          tournamentMode: 'POINTS' as TournamentMode,
          rewardPerKill: 10,
          rewardCurrency: 'NPR',
          minimumKillsForReward: 0,
          maximumRewardPerPlayer: 0,
          prizeDistribution: [
            { id: 'prize-initial-1', rank: 1, label: '1st', amount: 0 },
          ] as any[]
        });
        setCurrentStep(1);
      }
    } catch (error) {
      console.error("Error saving tournament:", error);
      showToast('Failed to save tournament', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateBanner = async () => {
    if (!user) return;
    if (!formData.title.trim() || !formData.game.trim()) {
      showToast('Add a title and game before generating a banner.', 'error');
      return;
    }

    setIsGeneratingBanner(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/generate-banner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: formData.title,
          game: formData.game,
          type: formData.type,
          tournamentType: formData.matchType,
          entryFee: formData.entryFee,
          prizePool: formData.prizePool,
          theme: selectedGame?.theme || 'competitive esports',
          mood: selectedGame?.modes?.[0] || formData.type || 'high-energy'
        })
      });

      const result = await response.json();
      if (!response.ok || !result.success || !result.url) {
        throw new Error(result.message || 'Failed to generate banner');
      }

      setFormData(prev => ({ ...prev, bannerUrl: result.url }));
      showToast('AI banner generated successfully!', 'success');
    } catch (error: any) {
      console.error('Error generating banner:', error);
      showToast(error?.message || 'Failed to generate banner', 'error');
    } finally {
      setIsGeneratingBanner(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }} 
            animate={{ opacity: 1, x: 0 }} 
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tournament Title</label>
              <input 
                type="text" 
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="e.g. Pro League Season 1"
                className="w-full bg-dark border border-gray-800 rounded-lg p-3 text-white focus:border-brand-500 focus-visible:outline-none transition"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Select Game</label>
              <select 
                value={formData.game}
                onChange={(e) => {
                  const gameName = e.target.value;
                  const game = games.find(g => g.name === gameName);
                  setSelectedGame(game);
                  setFormData({...formData, game: gameName, type: game?.modes?.[0] || 'Battle Royale'});
                }}
                className="w-full bg-dark border border-gray-800 rounded-lg p-3 text-white focus:border-brand-500 focus-visible:outline-none transition"
              >
                <option value="">Select a game</option>
                {games.map(g => (
                  <option key={g.id} value={g.name}>{formatGameName(g.name)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-gray-500 uppercase mb-2 tracking-widest">Banner Image</label>
              <div className="bg-dark/50 p-4 rounded-2xl border border-gray-800/50 space-y-4">
                <ImageUploader
                  category={MediaCategory.TOURNAMENT_BANNER}
                  value={formData.bannerUrl}
                  onChange={(url) => setFormData({ ...formData, bannerUrl: url })}
                  aspectRatio="banner"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleGenerateBanner}
                    disabled={isGeneratingBanner || !formData.title.trim() || !formData.game.trim()}
                    className="inline-flex items-center gap-2 rounded-lg border border-brand-500/40 bg-brand-500/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-brand-100 transition hover:bg-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isGeneratingBanner ? 'Generating...' : 'Generate AI Banner'}
                  </button>
                  <p className="text-[9px] text-gray-600 italic">Uses the title and game to generate a themed banner and saves it as the banner image.</p>
                </div>
                <p className="text-[9px] text-gray-600 italic">Recommended size: 1200x400px. You can skip this or upload to ImgBB.</p>
              </div>
                <div className="mt-4">
                  <p className="text-[10px] text-gray-500 font-bold uppercase mb-2">Or Choose a Preset</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {PRESET_TOURNAMENT_BANNERS.map((url, idx) => (
                      <button
                        key={url}
                        onClick={() => setFormData({...formData, bannerUrl: url})}
                        className={`relative aspect-[3/1] rounded overflow-hidden border-2 transition-colors ${formData.bannerUrl === url ? 'border-brand-500' : 'border-transparent hover:border-gray-600'}`}
                      >
                        <img src={url || undefined} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover" loading="lazy" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
          </motion.div>
        );
      case 2:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }} 
            animate={{ opacity: 1, x: 0 }} 
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Team Type</label>
                <select 
                  value={formData.teamType}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    setFormData({...formData, teamType: val, teamSize: val === 'solo' ? 1 : val === 'duo' ? 2 : 4});
                  }}
                  className="w-full bg-dark border border-gray-800 rounded-lg p-3 text-white focus:border-brand-500 focus-visible:outline-none transition"
                >
                  <option value="solo">Solo</option>
                  <option value="duo">Duo</option>
                  <option value="squad">Squad</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Game Mode</label>
                {selectedGame?.modes?.length > 0 ? (
                  <select 
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                    className="w-full bg-dark border border-gray-800 rounded-lg p-3 text-white focus:border-brand-500 focus-visible:outline-none transition"
                  >
                    {selectedGame.modes.map((m: string) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                ) : (
                  <input 
                    type="text" 
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                    placeholder="e.g. Battle Royale"
                    className="w-full bg-dark border border-gray-800 rounded-lg p-3 text-white focus:border-brand-500 focus-visible:outline-none transition"
                  />
                )}
              </div>
            </div>

            {formData.matchType === 'scrims' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Single Lobby Room ID</label>
                  <input 
                    type="text" 
                    value={(formData as any).roomId || ''}
                    onChange={(e) => setFormData({...formData, roomId: e.target.value})}
                    placeholder="e.g. 12345678"
                    className="w-full bg-dark border border-gray-800 rounded-lg p-3 text-white focus:border-brand-500 focus-visible:outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Lobby Password</label>
                  <input 
                    type="text" 
                    value={(formData as any).roomPass || ''}
                    onChange={(e) => setFormData({...formData, roomPass: e.target.value})}
                    placeholder="e.g. nexplay123"
                    className="w-full bg-dark border border-gray-800 rounded-lg p-3 text-white focus:border-brand-500 focus-visible:outline-none transition"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {formData.matchType !== 'scrims' && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tournament Format</label>
                  <select 
                    value={formData.format}
                    onChange={(e) => setFormData({...formData, format: e.target.value as any})}
                    className="w-full bg-dark border border-gray-800 rounded-lg p-3 text-white focus:border-brand-500 focus-visible:outline-none transition"
                  >
                    <option value="single_elimination">Single Elimination</option>
                    <option value="double_elimination">Double Elimination</option>
                    <option value="round_robin">Round Robin</option>
                    <option value="swiss">Swiss System</option>
                    <option value="hybrid">Hybrid (Groups + Knockout)</option>
                  </select>
                </div>
              )}
              <div className={formData.matchType === 'scrims' ? 'col-span-2' : ''}>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Total Slots</label>
                <input 
                  type="number" 
                  value={isNaN(formData.slots) ? '' : formData.slots}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setFormData({...formData, slots: isNaN(val) ? 0 : val});
                  }}
                  className="w-full bg-dark border border-gray-800 rounded-lg p-3 text-white focus:border-brand-500 focus-visible:outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Registration Control</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button type="button" 
                  onClick={() => setFormData({...formData, registrationType: 'auto'})}
                  className={`py-3 rounded-xl border font-black uppercase tracking-widest text-[10px] transition-colors ${formData.registrationType === 'auto' ? 'bg-brand-600 border-brand-500 text-white' : 'bg-dark border-gray-800 text-gray-500 hover:border-gray-700'}`}
                >
                  Auto-Approve
                </button>
                <button type="button" 
                  onClick={() => setFormData({...formData, registrationType: 'manual'})}
                  className={`py-3 rounded-xl border font-black uppercase tracking-widest text-[10px] transition-colors ${formData.registrationType === 'manual' ? 'bg-brand-600 border-brand-500 text-white' : 'bg-dark border-gray-800 text-gray-500 hover:border-gray-700'}`}
                >
                  Manual Review
                </button>
              </div>
              <p className="text-[10px] text-gray-600 mt-2 italic">Manual review allows you to approve/reject participants before they join the groups.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Map (Optional)</label>
                <select
                  value={formData.map}
                  onChange={(e) => setFormData({...formData, map: e.target.value})}
                  className="w-full bg-dark border border-gray-800 rounded-lg p-3 text-white focus:border-brand-500 focus-visible:outline-none transition"
                >
                  <option value="">Default ({getMapsForGame(formData.game)[0] || 'Bermuda'})</option>
                  {getMapsForGame(formData.game).map((mapName) => (
                    <option key={mapName} value={mapName}>{mapName}</option>
                  ))}
                  <option value="Custom">Custom Map...</option>
                </select>
                {formData.map === 'Custom' && (
                  <input 
                    type="text" 
                    placeholder={`e.g. ${getMapsForGame(formData.game)[0] || 'Bermuda'}`}
                    onChange={(e) => setFormData({...formData, map: e.target.value})}
                    className="w-full bg-dark border border-gray-800 rounded-lg p-3 mt-2 text-white focus:border-brand-500 focus-visible:outline-none transition"
                  />
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Start Date & Time</label>
                <input 
                  type="datetime-local" 
                  value={formData.startTime}
                  onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                  className="w-full bg-dark border border-gray-800 rounded-lg p-3 text-white focus:border-brand-500 focus-visible:outline-none transition"
                />
              </div>
            </div>
          </motion.div>
        );
      case 3:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }} 
            animate={{ opacity: 1, x: 0 }} 
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Total Prize Pool</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input 
                    type="number" 
                    value={formData.prizePool === 0 ? '' : formData.prizePool}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setFormData({...formData, prizePool: isNaN(val) ? 0 : val});
                    }}
                    className="w-full bg-dark border border-gray-800 rounded-lg p-3 pl-10 text-white focus:border-brand-500 focus-visible:outline-none transition"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Entry Fee</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input 
                    type="number" 
                    value={formData.entryFee === 0 ? '' : formData.entryFee}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setFormData({...formData, entryFee: isNaN(val) ? 0 : val});
                    }}
                    className="w-full bg-dark border border-gray-800 rounded-lg p-3 pl-10 text-white focus:border-brand-500 focus-visible:outline-none transition"
                  />
                </div>
              </div>
            </div>
            <PrizeDistributionInput
              prizes={formData.prizeDistribution}
              onChange={(newPrizes) => setFormData({ ...formData, prizeDistribution: newPrizes })}
              currency={formData.currency}
              onCurrencyChange={(newCurrency) => setFormData({ ...formData, currency: newCurrency })}
              totalPrizePool={formData.prizePool}
            />

            {/* ─── TOURNAMENT FUNDING & WALLET ESCROW STATUS ─── */}
            {(() => {
              const reqFunding = Math.max(0, Math.round(Number(formData.prizePool || 0)));
              const availableOrg = (profile?.orgWalletBalance || 0) + (profile?.balance || 0);
              const shortage = Math.max(0, reqFunding - availableOrg);
              const isFunded = availableOrg >= reqFunding;

              if (reqFunding === 0) {
                return (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-black text-emerald-300 uppercase tracking-wide">Free Event — Zero Prize Pool</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        This tournament requires NPR 0 organizer funding and will be published directly as upcoming upon creation.
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div className={`p-4 rounded-xl border space-y-3 ${isFunded ? 'bg-brand-500/10 border-brand-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isFunded ? <Lock className="w-4 h-4 text-brand-400" /> : <AlertTriangle className="w-4 h-4 text-amber-400" />}
                      <span className="text-xs font-black uppercase tracking-wider text-white">
                        {isFunded ? 'Prize Pool Funding Secured' : 'Organizer Funding Required'}
                      </span>
                    </div>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${isFunded ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
                      {isFunded ? 'Sufficient Funds' : 'Funding Shortage'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-black/40 p-3 rounded-lg border border-white/5 text-center">
                    <div>
                      <div className="text-[9px] text-gray-500 uppercase font-black tracking-widest">Required</div>
                      <div className="text-xs font-black text-white font-mono">Rs. {reqFunding.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-gray-500 uppercase font-black tracking-widest">Available</div>
                      <div className="text-xs font-black text-emerald-400 font-mono">Rs. {availableOrg.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-gray-500 uppercase font-black tracking-widest">{shortage > 0 ? 'Shortage' : 'Status'}</div>
                      <div className={`text-xs font-black font-mono ${shortage > 0 ? 'text-red-400' : 'text-brand-400'}`}>
                        {shortage > 0 ? `Rs. ${shortage.toLocaleString()}` : 'Ready'}
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    {isFunded
                      ? `Upon creation, NPR ${reqFunding.toLocaleString()} will be securely locked in escrow from your organization wallet. The platform does not advance or subsidize prize money.`
                      : `The platform does NOT advance or subsidize tournament prizes. This tournament will be saved in PENDING FUNDING status until your wallet is topped up.`}
                  </p>
                </div>
              );
            })()}
          </motion.div>
        );
      case 4:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }} 
            animate={{ opacity: 1, x: 0 }} 
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Rules & Regulations</label>
              <textarea 
                value={formData.rules}
                onChange={(e) => setFormData({...formData, rules: e.target.value})}
                rows={6}
                placeholder="Enter tournament rules..."
                className="w-full bg-dark border border-gray-800 rounded-lg p-3 text-white focus:border-brand-500 focus-visible:outline-none transition resize-none"
              />
            </div>
            <div className="bg-brand-500/10 border border-brand-500/20 p-4 rounded-lg flex gap-3">
              <Info className="w-5 h-5 text-brand-500 shrink-0" />
              <p className="text-xs text-gray-300 leading-relaxed">
                By creating this tournament, you agree to manage it fairly and distribute prizes as promised. 
                Players will be notified once the tournament is published.
              </p>
            </div>
          </motion.div>
        );
      case 5:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }} 
            animate={{ opacity: 1, x: 0 }} 
            className="space-y-6"
          >
            <div className="bg-surface p-6 rounded-2xl border border-gray-800">
              <h4 className="text-lg font-black text-white mb-4 uppercase tracking-tight">Tournament Summary</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase">Title</p>
                    <p className="text-sm text-white font-black">{formData.title}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase">Game & Mode</p>
                    <p className="text-sm text-white font-black">{formatGameName(formData.game)} • {formatGameModeLabel(formData.type)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase">Schedule</p>
                    <p className="text-sm text-white font-black">{toDateSafe(formData.startTime)?.toLocaleString() ?? 'TBD'}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase">Prize Pool</p>
                    <p className="text-sm text-brand-400 font-black">{formatCurrency(formData.prizePool)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase">Entry Fee</p>
                    <p className="text-sm text-white font-black">{formData.entryFee === 0 ? 'FREE' : formatCurrency(formData.entryFee)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase">Slots</p>
                    <p className="text-sm text-white font-black">{formData.slots} Players ({formData.teamType})</p>
                  </div>
                </div>
              </div>
            </div>
            {selectedGame?.scoring?.enabled ? (
              <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-2xl">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Scoring Config Inherited</p>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-lg font-black text-white">{selectedGame.scoring.killPoints}</p>
                    <p className="text-[9px] text-gray-500 uppercase font-bold">Per Kill</p>
                  </div>
                  <div>
                    <p className="text-lg font-black text-white">{Object.keys(selectedGame.scoring.placementPoints).length}</p>
                    <p className="text-[9px] text-gray-500 uppercase font-bold">Placements</p>
                  </div>
                  <div>
                    <p className="text-lg font-black text-white">v{selectedGame.scoring.scoringVersion || 1}</p>
                    <p className="text-[9px] text-gray-500 uppercase font-bold">Version</p>
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 mt-2 text-center">Frozen at creation — changes to game scoring won't affect this tournament</p>
              </div>
            ) : (
              <div className="bg-slate-800/30 border border-slate-800 p-4 rounded-2xl">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-slate-500" />
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">No Custom Scoring</p>
                </div>
                <p className="text-[10px] text-slate-500 mt-2">Free Fire default scoring will be used (1 pt/kill, 12 placements)</p>
              </div>
            )}
            <div className="flex items-center gap-3 p-4 bg-brand-500/5 border border-brand-500/20 rounded-xl">
              <CheckCircle2 className="w-6 h-6 text-brand-500" />
              <p className="text-xs text-gray-400">Everything looks good! Click launch to publish your tournament.</p>
            </div>
          </motion.div>
        );
      default:
        return null;
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={editTournament ? 'Edit Tournament' : 'Create New Tournament'}
      maxWidth="max-w-2xl"
    >
      <div className="mb-8">
        <div className="flex justify-between relative">
          {/* Progress Line */}
          <div className="absolute top-5 left-0 w-full h-0.5 bg-surface -z-10" />
          <div 
            className="absolute top-5 left-0 h-0.5 bg-brand-500 transition-colors duration-300 -z-10" 
            style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
          />

          {STEPS.map((step) => {
            const Icon = step.icon;
            const isActive = currentStep >= step.id;
            const isCurrent = currentStep === step.id;

            return (
              <div key={step.id} className="flex flex-col items-center group">
                <div className={`
                  w-11 h-11 rounded-full flex items-center justify-center transition-colors duration-500
                  ${isActive ? 'bg-brand-600 text-white shadow-[0_0_20px_rgba(var(--brand-primary-rgb),0.5)]' : 'bg-surface text-gray-500'}
                  ${isCurrent ? 'ring-4 ring-brand-500/20 scale-110' : ''}
                `}>
                  {isActive && currentStep > step.id ? <CheckCircle2 className="w-6 h-6" /> : <Icon className="w-5 h-5" />}
                </div>
                <div className="hidden md:flex flex-col items-center mt-2">
                  <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-white' : 'text-gray-500'}`}>
                    {step.title}
                  </span>
                  <span className="text-[8px] text-gray-600 font-bold uppercase tracking-tighter mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {step.description}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="min-h-[300px] sm:min-h-[350px]">
        <AnimatePresence mode="wait">
          {renderStep()}
        </AnimatePresence>
      </div>

      <div className="flex justify-between mt-8 pt-6 border-t border-gray-800">
        <button
          onClick={handleBack}
          disabled={currentStep === 1 || loading}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition ${
            currentStep === 1 ? 'opacity-0 pointer-events-none' : 'text-gray-400 hover:text-white'
          }`}
        >
          <ChevronLeft className="w-5 h-5" /> Back
        </button>

        {currentStep === STEPS.length ? (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-green-600 hover:bg-green-500 text-white px-8 py-2 rounded-lg font-bold shadow-lg flex items-center gap-2 transition disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Launch Tournament'} <Trophy className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="bg-brand-600 hover:bg-brand-500 text-white px-8 py-2 rounded-lg font-bold shadow-lg flex items-center gap-2 transition"
          >
            Next Step <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </Modal>
  );
};

export default TournamentCreateModal;
