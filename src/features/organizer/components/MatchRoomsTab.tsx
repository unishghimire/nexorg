import React, { useState, useMemo } from 'react';
import {
  Radio,
  Key,
  Copy,
  ShieldAlert,
  ExternalLink,
  Clock,
  Check,
  MapPin,
  Eye,
  EyeOff,
  Sparkles,
  Trophy,
  Flame,
  Users,
  Search,
  AlertCircle,
  Send,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  X,
  Shield,
  Gamepad2,
  Share2,
} from 'lucide-react';
import { sanitizeUrl, formatDate } from '../../../shared/utils/utils';

export interface MatchRoomsTabProps {
  matchRooms: any[];
  disputes: any[];
  onOpenRoomDispatch: (room: any) => void;
  onResolveDispute: (disputeId: string, action: 'solve' | 'warn' | 'ban' | 'dismiss', note?: string) => void;
  onOpenDisputeOverlay?: (disputeId: string) => void;
  onBroadcastLobby?: (
    id: string,
    roomId: string,
    roomPass: string,
    streamUrl: string,
    collection: 'tournaments' | 'scrims'
  ) => Promise<void>;
  onSwitchToDisputesTab?: () => void;
}

export const MatchRoomsTab: React.FC<MatchRoomsTabProps> = ({
  matchRooms = [],
  disputes = [],
  onOpenRoomDispatch,
  onResolveDispute,
  onOpenDisputeOverlay,
  onBroadcastLobby,
  onSwitchToDisputesTab,
}) => {
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'tournaments' | 'scrims'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'upcoming' | 'broadcasted' | 'missing'>('all');

  // Copy & Password Visibility states
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});

  // Quick In-Tab Broadcast Modal State
  const [broadcastTarget, setBroadcastTarget] = useState<any | null>(null);
  const [modalRoomId, setModalRoomId] = useState('');
  const [modalRoomPass, setModalRoomPass] = useState('');
  const [modalStreamUrl, setModalStreamUrl] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState(false);
  const [broadcastError, setBroadcastError] = useState<string | null>(null);

  // Map disputes by tournament/scrim ID for fast O(1) dispute count lookup
  const disputesByEventId = useMemo(() => {
    const map = new Map<string, any[]>();
    disputes.forEach((d: any) => {
      const targetId = d.tournamentId || d.scrimId || d.matchRoom;
      if (targetId) {
        const list = map.get(targetId) || [];
        list.push(d);
        map.set(targetId, list);
      }
    });
    return map;
  }, [disputes]);

  // Overall KPI metrics
  const metrics = useMemo(() => {
    const total = matchRooms.length;
    const live = matchRooms.filter(r => (r.status || '').toLowerCase() === 'live').length;
    const upcoming = matchRooms.filter(r => {
      const s = (r.status || '').toLowerCase();
      return s === 'upcoming' || s === 'open' || s === 'active';
    }).length;
    const broadcasted = matchRooms.filter(r => Boolean(r.roomId || r.roomPass)).length;
    const missing = matchRooms.filter(r => !r.roomId && !r.roomPass).length;
    const pendingDisputes = disputes.filter(d => (d.status || 'pending') === 'pending').length;

    return { total, live, upcoming, broadcasted, missing, pendingDisputes };
  }, [matchRooms, disputes]);

  // Filtered rooms list
  const filteredRooms = useMemo(() => {
    return matchRooms.filter(room => {
      const isScrim = room.isScrim || room.matchType === 'scrims' || room.type === 'scrim' || (room.title && room.title.toLowerCase().includes('scrim'));
      
      // Type Filter
      if (typeFilter === 'tournaments' && isScrim) return false;
      if (typeFilter === 'scrims' && !isScrim) return false;

      // Status Filter
      const roomStatus = (room.status || '').toLowerCase();
      const hasCreds = Boolean(room.roomId || room.roomPass);

      if (statusFilter === 'live' && roomStatus !== 'live') return false;
      if (statusFilter === 'upcoming' && roomStatus !== 'upcoming' && roomStatus !== 'open') return false;
      if (statusFilter === 'broadcasted' && !hasCreds) return false;
      if (statusFilter === 'missing' && hasCreds) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const title = (room.title || room.tournamentName || '').toLowerCase();
        const game = (room.game || room.gameName || '').toLowerCase();
        const map = (room.map || '').toLowerCase();
        const roomId = (room.roomId || '').toLowerCase();
        const roomPass = (room.roomPass || '').toLowerCase();
        return title.includes(q) || game.includes(q) || map.includes(q) || roomId.includes(q) || roomPass.includes(q);
      }

      return true;
    });
  }, [matchRooms, typeFilter, statusFilter, searchQuery]);

  // Helper to copy text to clipboard with key-based feedback
  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  // Helper to copy formatted match announcement for Discord / WhatsApp
  const handleCopyFormattedAnnouncement = (room: any) => {
    const isScrim = room.isScrim || room.matchType === 'scrims' || room.type === 'scrim';
    const typeLabel = isScrim ? '🔥 SCRIM' : '🏆 TOURNAMENT';
    const title = room.title || room.tournamentName || 'NexPlay Esports Match';
    const roomId = room.roomId || 'TBA';
    const roomPass = room.roomPass || 'TBA';
    const stream = room.streamUrl || room.ytLink;

    let text = `🎮 [${typeLabel}] ${title}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🔑 Room ID: ${roomId}\n` +
      `🔒 Password: ${roomPass}\n`;

    if (room.map) {
      text += `🗺️ Map: ${room.map}\n`;
    }
    if (stream) {
      text += `📺 Live Stream: ${stream}\n`;
    }
    text += `━━━━━━━━━━━━━━━━━━━━\n` +
      `⚡ Join the custom room now and take your designated slot!`;

    navigator.clipboard.writeText(text);
    setCopiedKey(`formatted-${room.id}`);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  // Toggle password masking per room card
  const togglePasswordVisibility = (roomIdKey: string) => {
    setRevealedPasswords(prev => ({
      ...prev,
      [roomIdKey]: !prev[roomIdKey],
    }));
  };

  // Generate random room password
  const generateRandomPassword = () => {
    const prefixes = ['ff', 'nex', 'pro', 'war', 'top'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}${num}`;
  };

  // Open Quick Broadcast Modal
  const openBroadcastModal = (room: any) => {
    setBroadcastTarget(room);
    setModalRoomId(room.roomId || '');
    setModalRoomPass(room.roomPass || generateRandomPassword());
    setModalStreamUrl(room.streamUrl || room.ytLink || '');
    setBroadcastSuccess(false);
    setBroadcastError(null);
  };

  // Submit Broadcast from In-Tab Modal
  const handleSubmitBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTarget) return;

    if (!modalRoomId.trim() && !modalRoomPass.trim()) {
      setBroadcastError('Please enter at least a Room ID or Room Password.');
      return;
    }

    setIsBroadcasting(true);
    setBroadcastError(null);

    try {
      const targetId = broadcastTarget.id || broadcastTarget.tournamentId;
      const isScrim = broadcastTarget.isScrim || broadcastTarget.matchType === 'scrims' || broadcastTarget.type === 'scrim';
      const collection = isScrim ? 'scrims' : 'tournaments';

      if (onBroadcastLobby) {
        await onBroadcastLobby(targetId, modalRoomId.trim(), modalRoomPass.trim(), modalStreamUrl.trim(), collection);
      } else {
        // Fallback to onOpenRoomDispatch
        onOpenRoomDispatch({
          ...broadcastTarget,
          roomId: modalRoomId.trim(),
          roomPass: modalRoomPass.trim(),
          streamUrl: modalStreamUrl.trim(),
          ytLink: modalStreamUrl.trim(),
        });
      }

      setBroadcastSuccess(true);
      setTimeout(() => {
        setBroadcastTarget(null);
        setBroadcastSuccess(false);
      }, 1500);
    } catch (err: any) {
      setBroadcastError(err?.message || 'Failed to broadcast room credentials. Please check your connection.');
    } finally {
      setIsBroadcasting(false);
    }
  };

  return (
    <div className="space-y-6 text-white animate-fade-in pb-12">
      {/* 1. Header Banner & KPIs */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-surface to-dark border border-emerald-500/20 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-600/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-400 mb-1">
              <Radio className="w-4 h-4 animate-pulse" /> Custom Match Lobbies &amp; Credentials Center
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
              Match Rooms &amp; Credentials
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 font-medium mt-1">
              Manage, generate, and broadcast Room ID, Password, and Live Streams for Tournaments and Scrims in real-time.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="px-4 py-2.5 bg-surface/80 border border-gray-800 rounded-xl text-center">
              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Rooms</div>
              <div className="text-lg font-black text-white">{metrics.total}</div>
            </div>
            <div className="px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center">
              <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center justify-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> Live Lobbies
              </div>
              <div className="text-lg font-black text-emerald-400">{metrics.live}</div>
            </div>
            <div className="px-4 py-2.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-center">
              <div className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">Broadcasted</div>
              <div className="text-lg font-black text-blue-400">{metrics.broadcasted}</div>
            </div>
            <div className={`px-4 py-2.5 rounded-xl text-center border ${
              metrics.missing > 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-surface/80 border-gray-800'
            }`}>
              <div className={`text-[10px] font-bold uppercase tracking-wider ${
                metrics.missing > 0 ? 'text-amber-400' : 'text-gray-400'
              }`}>
                Awaiting Pass
              </div>
              <div className={`text-lg font-black ${
                metrics.missing > 0 ? 'text-amber-400' : 'text-white'
              }`}>
                {metrics.missing}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Controls Toolbar: Event Filter, Status Filter & Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-surface/40 p-2.5 rounded-2xl border border-gray-800">
        <div className="flex flex-wrap items-center gap-2">
          {/* Match Type Pills */}
          <div className="flex items-center gap-1 bg-dark/70 p-1 rounded-xl border border-gray-800">
            <button
              type="button"
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition ${
                typeFilter === 'all'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              All Events
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('tournaments')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition flex items-center gap-1.5 ${
                typeFilter === 'tournaments'
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-900/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Trophy className="w-3 h-3 text-amber-400" /> Tournaments
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('scrims')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition flex items-center gap-1.5 ${
                typeFilter === 'scrims'
                  ? 'bg-orange-600 text-white shadow-md shadow-orange-900/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Flame className="w-3 h-3 text-orange-400" /> Scrims
            </button>
          </div>

          {/* Status Pills */}
          <div className="hidden sm:flex items-center gap-1 overflow-x-auto">
            {[
              { id: 'all', label: 'All Status' },
              { id: 'live', label: '🔴 Live Now' },
              { id: 'upcoming', label: '⏳ Upcoming' },
              { id: 'broadcasted', label: '🔑 Broadcasted' },
              { id: 'missing', label: '⚠️ Awaiting Pass' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as any)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  statusFilter === tab.id
                    ? 'bg-surface text-white border border-gray-700 shadow-sm'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-surface/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by title, game, map, room ID..."
            className="w-full bg-dark border border-gray-800 rounded-xl pl-10 pr-4 py-2 text-xs font-semibold text-white placeholder-gray-500 focus:border-emerald-500 focus-visible:outline-none transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 3. Match Rooms List */}
      {filteredRooms.length === 0 ? (
        <div className="bg-surface/20 border border-dashed border-gray-800 rounded-3xl p-12 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center mx-auto text-gray-500">
            <Radio className="w-8 h-8 text-emerald-400" />
          </div>
          <h3 className="text-base font-black text-white uppercase tracking-wider">No Match Rooms Found</h3>
          <p className="text-xs text-gray-400 max-w-md mx-auto">
            {searchQuery || typeFilter !== 'all' || statusFilter !== 'all'
              ? 'No tournament or scrim lobbies match your current filter criteria.'
              : 'Create a tournament or scrim to manage its match room credentials and broadcast to players.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredRooms.map(room => {
            const isScrim = room.isScrim || room.matchType === 'scrims' || room.type === 'scrim';
            const roomStatus = (room.status || 'upcoming').toLowerCase();
            const isLive = roomStatus === 'live';
            const hasCredentials = Boolean(room.roomId || room.roomPass);
            const isPassRevealed = Boolean(revealedPasswords[room.id]);

            // Slot progress calculation
            const totalSlots = Number(room.totalSlots || room.slots?.length || room.maxPlayers || 12);
            const filledSlots = Number(room.filledSlots ?? room.currentPlayers ?? (Array.isArray(room.slots) ? room.slots.filter((s: any) => s.status === 'filled').length : 0));
            const fillPercentage = totalSlots > 0 ? Math.min(Math.round((filledSlots / totalSlots) * 100), 100) : 0;

            // Check for associated disputes
            const roomDisputes = disputesByEventId.get(room.id) || [];
            const pendingDisputesCount = roomDisputes.filter((d: any) => (d.status || 'pending') === 'pending').length;

            const roomIdCopyKey = `room-${room.id}-id`;
            const roomPassCopyKey = `room-${room.id}-pass`;
            const formattedCopyKey = `formatted-${room.id}`;

            return (
              <div
                key={room.id}
                className={`bg-card/90 border rounded-2xl p-5 sm:p-6 transition-all space-y-4 hover:border-gray-700 flex flex-col justify-between ${
                  isLive
                    ? 'border-emerald-500/40 shadow-xl shadow-emerald-950/20'
                    : hasCredentials
                    ? 'border-gray-800'
                    : 'border-amber-500/30'
                }`}
              >
                {/* Header Row: Event Type Badge, Game, Status & Start Time */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3 border-b border-gray-800/80 pb-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isScrim ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center gap-1">
                            <Flame className="w-3 h-3 text-orange-400" /> Scrim
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand-500/20 text-brand-300 border border-brand-500/30 flex items-center gap-1">
                            <Trophy className="w-3 h-3 text-amber-400" /> Tournament
                          </span>
                        )}

                        {room.game && (
                          <span className="text-[11px] text-gray-400 font-semibold flex items-center gap-1">
                            <Gamepad2 className="w-3.5 h-3.5 text-gray-500" /> {room.game}
                          </span>
                        )}

                        {room.map && (
                          <span className="text-[11px] text-gray-400 font-semibold flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-gray-500" /> {room.map}
                          </span>
                        )}

                        {room.format && (
                          <span className="text-[10px] text-gray-400 bg-surface px-2 py-0.5 rounded uppercase font-bold">
                            {room.format}
                          </span>
                        )}
                      </div>

                      <h3 className="text-base sm:text-lg font-black text-white truncate tracking-tight">
                        {room.title || room.tournamentName || 'Match Room'}
                      </h3>
                    </div>

                    {/* Status Badge */}
                    <div className="shrink-0">
                      {isLive ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          Live Now
                        </span>
                      ) : roomStatus === 'upcoming' || roomStatus === 'open' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-500/10 text-blue-300 border border-blue-500/20">
                          <Clock className="w-3.5 h-3.5" />
                          {room.startDate ? formatDate(room.startDate) : 'Upcoming'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-gray-800 text-gray-400 border border-gray-700">
                          {roomStatus}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Slot Registration Progress */}
                  <div className="space-y-1.5 bg-dark/40 p-3 rounded-xl border border-gray-800/60">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400 font-bold flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-gray-500" /> Registration &amp; Slots
                      </span>
                      <span className="font-mono text-white font-bold">
                        {filledSlots} / {totalSlots} Teams ({fillPercentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          fillPercentage >= 100
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                            : fillPercentage >= 70
                            ? 'bg-gradient-to-r from-blue-500 to-indigo-500'
                            : 'bg-gradient-to-r from-amber-500 to-orange-500'
                        }`}
                        style={{ width: `${fillPercentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Credentials Box (Room ID & Password) */}
                  {hasCredentials ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Room ID */}
                      <div className="bg-dark/80 border border-gray-800 rounded-xl p-3 flex flex-col justify-between space-y-2">
                        <div className="flex items-center justify-between text-xs text-gray-400">
                          <span className="font-bold flex items-center gap-1.5">
                            <Key className="w-3.5 h-3.5 text-emerald-400" /> Room ID
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(room.roomId, roomIdCopyKey)}
                            className="text-xs text-gray-400 hover:text-white transition flex items-center gap-1 font-semibold px-2 py-1 rounded bg-surface/60 hover:bg-surface border border-gray-700/50"
                            title="Copy Room ID"
                          >
                            {copiedKey === roomIdCopyKey ? (
                              <span className="text-emerald-400 flex items-center gap-1">
                                <Check className="w-3 h-3" /> Copied
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <Copy className="w-3 h-3" /> Copy
                              </span>
                            )}
                          </button>
                        </div>
                        <div className="font-mono text-base font-black text-white tracking-wider truncate">
                          {room.roomId || 'N/A'}
                        </div>
                      </div>

                      {/* Password */}
                      <div className="bg-dark/80 border border-gray-800 rounded-xl p-3 flex flex-col justify-between space-y-2">
                        <div className="flex items-center justify-between text-xs text-gray-400">
                          <span className="font-bold flex items-center gap-1.5">
                            <Shield className="w-3.5 h-3.5 text-emerald-400" /> Password
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => togglePasswordVisibility(room.id)}
                              className="text-gray-400 hover:text-white transition p-1 rounded hover:bg-surface"
                              title={isPassRevealed ? 'Hide Password' : 'Show Password'}
                            >
                              {isPassRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopy(room.roomPass, roomPassCopyKey)}
                              className="text-xs text-gray-400 hover:text-white transition flex items-center gap-1 font-semibold px-2 py-1 rounded bg-surface/60 hover:bg-surface border border-gray-700/50"
                              title="Copy Password"
                            >
                              {copiedKey === roomPassCopyKey ? (
                                <span className="text-emerald-400 flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Copied
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <Copy className="w-3 h-3" /> Copy
                                </span>
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="font-mono text-base font-black text-white tracking-wider truncate">
                          {isPassRevealed ? (room.roomPass || 'N/A') : '••••••••'}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-amber-300">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>Room ID &amp; Password not released yet. Players are waiting.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => openBroadcastModal(room)}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-[10px] tracking-wider rounded-lg transition shrink-0"
                      >
                        Set Now
                      </button>
                    </div>
                  )}

                  {/* Active Dispute Alert Banner */}
                  {pendingDisputesCount > 0 && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-red-300">
                        <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 animate-pulse" />
                        <span>
                          <strong className="font-black text-red-200">{pendingDisputesCount} Active Dispute(s)</strong> filed for this match room.
                        </span>
                      </div>
                      {onSwitchToDisputesTab && (
                        <button
                          type="button"
                          onClick={onSwitchToDisputesTab}
                          className="px-2.5 py-1 bg-red-600/30 hover:bg-red-600/50 text-red-200 border border-red-500/40 rounded-lg text-[10px] font-bold uppercase transition"
                        >
                          Review
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="pt-4 border-t border-gray-800 flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    {/* Broadcast / Edit Button */}
                    <button
                      type="button"
                      onClick={() => openBroadcastModal(room)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-2 shadow-lg shadow-emerald-950/20"
                    >
                      <Radio className="w-3.5 h-3.5" />
                      {hasCredentials ? 'Update Credentials' : 'Broadcast Lobby'}
                    </button>

                    {/* Copy Formatted for Discord / WhatsApp */}
                    {hasCredentials && (
                      <button
                        type="button"
                        onClick={() => handleCopyFormattedAnnouncement(room)}
                        className="px-3 py-2 bg-surface hover:bg-surface text-gray-300 hover:text-white rounded-xl text-xs font-bold border border-gray-700 transition flex items-center gap-1.5"
                        title="Copy Formatted Text for Discord or WhatsApp"
                      >
                        {copiedKey === formattedCopyKey ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Post Copied!
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5">
                            <Share2 className="w-3.5 h-3.5 text-blue-400" /> Share Post
                          </span>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Stream URL link */}
                  {(room.streamUrl || room.ytLink) && (
                    <a
                      href={sanitizeUrl(room.streamUrl || room.ytLink)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-brand-400 hover:text-brand-300 font-bold flex items-center gap-1 px-3 py-2 rounded-xl bg-brand-500/10 border border-brand-500/20 hover:bg-brand-500/20 transition"
                    >
                      Live Stream <ExternalLink className="w-3.5 h-3.5 ml-0.5" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Quick In-Tab Broadcast Modal */}
      {broadcastTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-gray-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-tight">
                    Broadcast Room Credentials
                  </h3>
                  <p className="text-xs text-gray-400 truncate max-w-xs">
                    {broadcastTarget.title || broadcastTarget.tournamentName || 'Match Lobby'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBroadcastTarget(null)}
                className="text-gray-500 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Broadcast Form */}
            <form onSubmit={handleSubmitBroadcast} className="space-y-4">
              {broadcastSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Credentials broadcasted instantly to all registered players!</span>
                </div>
              )}

              {broadcastError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-bold flex items-center gap-2 animate-fade-in">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{broadcastError}</span>
                </div>
              )}

              {/* Room ID Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-300">
                  Custom Room ID <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={modalRoomId}
                  onChange={e => setModalRoomId(e.target.value)}
                  placeholder="e.g. 8492015"
                  className="w-full bg-dark border border-gray-800 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-white placeholder-gray-500 focus:border-emerald-500 focus-visible:outline-none transition"
                  required
                />
              </div>

              {/* Room Password Input + Generator */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-300">
                    Room Password <span className="text-red-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setModalRoomPass(generateRandomPassword())}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 transition"
                  >
                    <Sparkles className="w-3 h-3" /> Generate Random
                  </button>
                </div>
                <input
                  type="text"
                  value={modalRoomPass}
                  onChange={e => setModalRoomPass(e.target.value)}
                  placeholder="e.g. ffpro84"
                  className="w-full bg-dark border border-gray-800 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-white placeholder-gray-500 focus:border-emerald-500 focus-visible:outline-none transition"
                  required
                />
              </div>

              {/* Stream URL (Optional) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-300">
                  Live Stream Link <span className="text-gray-500">(Optional)</span>
                </label>
                <input
                  type="url"
                  value={modalStreamUrl}
                  onChange={e => setModalStreamUrl(e.target.value)}
                  placeholder="https://youtube.com/live/... or Twitch URL"
                  className="w-full bg-dark border border-gray-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:border-emerald-500 focus-visible:outline-none transition"
                />
              </div>

              {/* Notification Simulation Preview */}
              <div className="space-y-1.5 bg-dark/60 p-3.5 rounded-xl border border-gray-800">
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Send className="w-3 h-3 text-blue-400" /> Player In-App Notification Preview:
                </div>
                <div className="text-xs text-gray-300 font-medium">
                  <strong>Title:</strong> Match Room Credentials Released!
                </div>
                <div className="text-xs text-gray-400 font-mono mt-0.5">
                  Room ID: {modalRoomId || '...'} | Password: {modalRoomPass || '...'}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setBroadcastTarget(null)}
                  className="flex-1 bg-surface hover:bg-surface text-gray-300 hover:text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wider border border-gray-700 transition"
                  disabled={isBroadcasting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBroadcasting}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-3 rounded-xl font-black text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/30"
                >
                  {isBroadcasting ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Radio className="w-4 h-4" />
                  )}
                  <span>{isBroadcasting ? 'Broadcasting...' : 'Broadcast to Players'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatchRoomsTab;
