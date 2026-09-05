import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, serverTimestamp, Timestamp, updateDoc, doc, setDoc, where, query } from 'firebase/firestore';
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
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatCurrency, formatGameName, toDateSafe, cleanFirestoreData } from '../../../shared/utils/utils';
import { commitFirestoreBatches } from '../../../shared/utils/firestoreBatches';
import { normalizeScrimSlots, countFilledScrimSlots, ScrimSlot } from '../../../shared/utils/scrimSlots';
import { fetchRoomCredentials, broadcastRoomCredentials } from '../../../shared/services/roomCredentials';

interface ScrimCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  editScrim?: any;
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

export default function ScrimCreateModal({
  isOpen,
  onClose,
  editScrim,
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
    entryFee: 0,
    prizePool: 0,
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
      setFormData({
        title: '',
        game: dbGames[0]?.name || 'Free Fire',
        format: 'Battle Royale',
        teamType: 'squad',
        map: MAP_OPTIONS[dbGames[0]?.name]?.[0] || 'Bermuda',
        totalSlots: 12,
        entryFee: 0,
        prizePool: 0,
        startTime: '',
        bannerUrl: '',
        roomId: '',
        roomPass: '',
        streamUrl: '',
        rules: '1. All players must join room on time.\n2. Emulators prohibited unless specified.\n3. Hacking/cheating results in immediate ban.',
      });
      setCurrentStep(1);
    }
  }, [editScrim, isOpen]);

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
        entryFee: Number(formData.entryFee) || 0,
        prizePool: Number(formData.prizePool) || 0,
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
        await Promise.all([
          updateDoc(doc(db, 'tournaments', editScrim.id), cleanedPayload).catch(() => {}),
          updateDoc(doc(db, 'scrims', editScrim.id), cleanedPayload).catch(() => {}),
          setDoc(doc(db, 'scrims', editScrim.id), cleanedPayload, { merge: true }).catch(() => {}),
          setDoc(doc(db, 'tournaments', editScrim.id), cleanedPayload, { merge: true }).catch(() => {}),
        ]);

        if (formData.roomId || formData.roomPass) {
          await broadcastRoomCredentials(editScrim.id, formData.roomId, formData.roomPass, formData.streamUrl, 'scrims').catch(() => {});
        }
        showToast('Scrim updated successfully!', 'success');
      } else {
        const docRef = await addDoc(collection(db, 'tournaments'), {
          ...scrimPayload,
          createdAt: serverTimestamp(),
        });

        // Also mirror to dedicated scrims collection
        await setDoc(doc(db, 'scrims', docRef.id), {
          ...scrimPayload,
          id: docRef.id,
          createdAt: serverTimestamp(),
        }).catch(() => {});

        if (formData.roomId || formData.roomPass) {
          await broadcastRoomCredentials(docRef.id, formData.roomId, formData.roomPass, formData.streamUrl, 'scrims').catch(() => {});
        }
        showToast('Scrim created successfully!', 'success');
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
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                Scrim Title *
              </label>
              <input
                type="text"
                placeholder="e.g. Free Fire Night Scrim #12"
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
                    setFormData({ ...formData, teamType: type, totalSlots: slots });
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
                  onChange={(e) => setFormData({ ...formData, totalSlots: Number(e.target.value) })}
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
                  Prize Pool (Rs.)
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
