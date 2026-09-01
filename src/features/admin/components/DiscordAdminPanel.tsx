import React, { useState } from 'react';
import { Send, Info, Trophy, Target } from 'lucide-react';
import { Tournament } from '../../../shared/types/types';

interface DiscordAdminPanelProps {
    allTournaments: Tournament[];
    showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const DiscordAdminPanel: React.FC<DiscordAdminPanelProps> = ({ allTournaments, showToast }) => {
    const [activeTab, setActiveTab] = useState<'tournaments' | 'scrims'>('tournaments');
    const [selectedTournamentId, setSelectedTournamentId] = useState('');
    const [sending, setSending] = useState<string | null>(null);

    const filteredTournaments = allTournaments.filter(t => 
        activeTab === 'scrims' ? t.matchType === 'scrims' : t.matchType !== 'scrims'
    );

    const selectedTournament = filteredTournaments.find(t => t.id === selectedTournamentId) ?? null;

    const handleSend = async (type: string) => {
        if (!selectedTournament) {
            showToast(`Select a ${activeTab === 'tournaments' ? 'tournament' : 'scrim'} first`, 'warning');
            return;
        }
        setSending(type);
        try {
            const token = await (await import('../../../shared/config/firebase')).auth.currentUser?.getIdToken();
            if (!token) { showToast('Not authenticated', 'error'); return; }

            const dataMap: Record<string, object> = {
                // Tournaments
                tournament_published: {
                    tournamentId: selectedTournament.id,
                    title: selectedTournament.title,
                    game: selectedTournament.game,
                    teamType: selectedTournament.teamType,
                    type: selectedTournament.type,
                    map: selectedTournament.map,
                    startTime: selectedTournament.startTime?.toDate?.().toLocaleString() ?? 'TBD',
                    prizePool: `Rs. ${selectedTournament.prizePool.toLocaleString()}`,
                    entryFee: selectedTournament.entryFee === 0 ? 'FREE' : `Rs. ${selectedTournament.entryFee}`,
                    currentPlayers: selectedTournament.currentPlayers || 0,
                    slots: selectedTournament.slots,
                    bannerUrl: selectedTournament.bannerUrl,
                },
                tournament_registration: {
                    tournamentId: selectedTournament.id,
                    title: selectedTournament.title,
                    teamName: 'Latest Squad Registration',
                    currentPlayers: selectedTournament.currentPlayers || 0,
                    slots: selectedTournament.slots,
                },
                group_published: {
                    tournamentId: selectedTournament.id,
                    title: selectedTournament.title,
                    groups: (selectedTournament.groups ?? []).map(g =>
                        `${g.name} (${g.teams.length} teams): ${g.teams.map(t => t.name).join(', ')}`
                    ),
                },
                game_start: {
                    tournamentId: selectedTournament.id,
                    title: selectedTournament.title,
                    groupName: 'All Groups',
                    map: selectedTournament.map ?? 'TBD',
                    roomId: selectedTournament.roomId,
                    roomPass: selectedTournament.roomPass,
                },
                game_time: {
                    tournamentId: selectedTournament.id,
                    title: selectedTournament.title,
                    groupName: 'All Groups',
                    startTime: selectedTournament.startTime?.toDate?.().toLocaleString() ?? 'TBD',
                    timeLeft: '30 minutes',
                    map: selectedTournament.map,
                },
                tournament_result: {
                    tournamentId: selectedTournament.id,
                    title: selectedTournament.title,
                    groupName: 'Grand Finals',
                    resultsSummary: 'Top standings & kill points updated on leaderboard.',
                },
                tournament_completed: {
                    tournamentId: selectedTournament.id,
                    title: selectedTournament.title,
                    prizePool: `Rs. ${selectedTournament.prizePool.toLocaleString()}`,
                    winner: selectedTournament.winners?.[0]?.username || 'Grand Champion Squad',
                    bannerUrl: selectedTournament.bannerUrl,
                },

                // Scrims
                scrim_published: {
                    tournamentId: selectedTournament.id,
                    title: selectedTournament.title,
                    game: selectedTournament.game,
                    teamType: selectedTournament.teamType,
                    startTime: selectedTournament.startTime?.toDate?.().toLocaleString() ?? 'TBD',
                    prizePool: `Rs. ${selectedTournament.prizePool.toLocaleString()}`,
                    entryFee: selectedTournament.entryFee === 0 ? 'FREE' : `Rs. ${selectedTournament.entryFee}`,
                    currentPlayers: selectedTournament.currentPlayers || 0,
                    slots: selectedTournament.slots,
                    bannerUrl: selectedTournament.bannerUrl,
                },
                scrim_registration: {
                    tournamentId: selectedTournament.id,
                    title: selectedTournament.title,
                    teamName: 'Registered Squad',
                    slotNumber: 1,
                    currentPlayers: selectedTournament.currentPlayers || 0,
                    slots: selectedTournament.slots,
                },
                scrim_group: {
                    tournamentId: selectedTournament.id,
                    title: selectedTournament.title,
                    slotsList: ['Slot 1: Team Alpha', 'Slot 2: Team Bravo', 'Slot 3: Team Charlie'],
                },
                scrim_game_start: {
                    tournamentId: selectedTournament.id,
                    title: selectedTournament.title,
                    map: selectedTournament.map || 'Bermuda',
                    roomId: selectedTournament.roomId,
                    roomPass: selectedTournament.roomPass,
                },
                scrim_game_time: {
                    tournamentId: selectedTournament.id,
                    title: selectedTournament.title,
                    startTime: selectedTournament.startTime?.toDate?.().toLocaleString() ?? 'TBD',
                    timeLeft: '15 minutes',
                    map: selectedTournament.map || 'Bermuda',
                },
                scrim_result: {
                    tournamentId: selectedTournament.id,
                    title: selectedTournament.title,
                    resultsSummary: 'Scrim scorecards & kill rewards verified.',
                },
                scrim_completed: {
                    tournamentId: selectedTournament.id,
                    title: selectedTournament.title,
                    winner: selectedTournament.winners?.[0]?.username || 'Top Team',
                    prizeAmount: `Rs. ${selectedTournament.prizePool.toLocaleString()}`,
                },
            };

            const data = dataMap[type];
            if (!data) { showToast('Unknown announcement type', 'error'); return; }

            const res = await fetch('/api/discord/announce', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ type, data, channel: activeTab }),
            });
            const json = await res.json();
            showToast(json.message, json.success ? 'success' : 'error');
        } catch (err: any) {
            showToast('Failed to send announcement', 'error');
        } finally {
            setSending(null);
        }
    };

    const tournamentActions = [
        { type: 'tournament_published', label: '📢 Announcement', desc: 'New Tournament', color: 'text-[#5865F2] bg-[#5865F2]/10 border-[#5865F2]/20 hover:bg-[#5865F2]/20' },
        { type: 'tournament_registration', label: '📝 Registration', desc: 'Slot updates', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20' },
        { type: 'group_published', label: '📋 Group Draw', desc: 'Brackets & Teams', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20 hover:bg-yellow-500/20' },
        { type: 'game_start', label: '⚔️ Match Room', desc: 'Room ID & Password', color: 'text-pink-400 bg-pink-500/10 border-pink-500/20 hover:bg-pink-500/20' },
        { type: 'tournament_result', label: '📊 Match Results', desc: 'Leaderboard & Kills', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20' },
        { type: 'tournament_completed', label: '👑 Grand Champion', desc: 'Winners & Payouts', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20' },
    ];

    const scrimActions = [
        { type: 'scrim_published', label: '📢 Announcement', desc: 'New Scrim Lobby', color: 'text-[#5865F2] bg-[#5865F2]/10 border-[#5865F2]/20 hover:bg-[#5865F2]/20' },
        { type: 'scrim_registration', label: '📝 Registration', desc: 'Slot booked', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20' },
        { type: 'scrim_group', label: '📋 Lobby Roster', desc: 'Confirmed slots', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20 hover:bg-yellow-500/20' },
        { type: 'scrim_game_start', label: '⚔️ Scrim Room', desc: 'Room ID & Pass', color: 'text-pink-400 bg-pink-500/10 border-pink-500/20 hover:bg-pink-500/20' },
        { type: 'scrim_result', label: '📊 Scrim Results', desc: 'Scorecards & Kills', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20' },
        { type: 'scrim_completed', label: '🏆 Scrim Winner', desc: 'MVP & Top Squads', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20' },
    ];

    const currentActions = activeTab === 'tournaments' ? tournamentActions : scrimActions;

    return (
        <div className="space-y-8">
            <div className="border-b border-gray-800 pb-6">
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                    <div className="p-2 bg-[#5865F2]/10 border border-[#5865F2]/20 rounded-xl">
                        <Send className="w-5 h-5 text-[#5865F2]" />
                    </div>
                    Discord Multi-Channel Announcement Center
                </h2>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-2">
                    Automated & granular manual dispatches across your dedicated Discord channels
                </p>
            </div>

            {/* Switch between Tournaments & Scrims */}
            <div className="flex bg-card/50 p-2 rounded-2xl border border-gray-800 gap-2 max-w-md">
                <button
                    type="button"
                    onClick={() => { setActiveTab('tournaments'); setSelectedTournamentId(''); }}
                    className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-2 ${
                        activeTab === 'tournaments'
                            ? 'bg-[#5865F2] text-white shadow-lg shadow-[#5865F2]/20'
                            : 'text-gray-400 hover:text-white'
                    }`}
                >
                    <Trophy className="w-4 h-4" /> Tournaments
                </button>
                <button
                    type="button"
                    onClick={() => { setActiveTab('scrims'); setSelectedTournamentId(''); }}
                    className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-2 ${
                        activeTab === 'scrims'
                            ? 'bg-[#5865F2] text-white shadow-lg shadow-[#5865F2]/20'
                            : 'text-gray-400 hover:text-white'
                    }`}
                >
                    <Target className="w-4 h-4" /> Scrims
                </button>
            </div>

            {/* Tournament selector */}
            <div className="bg-card/50 p-6 rounded-3xl border border-gray-800 space-y-4">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">
                    Select {activeTab === 'tournaments' ? 'Tournament' : 'Scrim'}
                </label>
                <select
                    value={selectedTournamentId}
                    onChange={e => setSelectedTournamentId(e.target.value)}
                    aria-label={`Select ${activeTab === 'tournaments' ? 'tournament' : 'scrim'}`}
                    className="w-full bg-black border border-gray-700 rounded-2xl px-5 py-4 text-white text-sm font-bold focus:border-[#5865F2] focus-visible:outline-none transition"
                >
                    <option value="">— Choose a {activeTab === 'tournaments' ? 'tournament' : 'scrim'} —</option>
                    {filteredTournaments.map(t => (
                        <option key={t.id} value={t.id}>
                            [{t.status.toUpperCase()}] {t.title} ({t.game})
                        </option>
                    ))}
                </select>

                {selectedTournament && (
                    <div className="flex items-center gap-3 p-4 bg-black/40 rounded-2xl border border-gray-800">
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-card border border-gray-700 shrink-0">
                            {selectedTournament.bannerUrl && (
                                <img src={selectedTournament.bannerUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <div className="text-white font-black text-sm truncate">{selectedTournament.title}</div>
                            <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest">
                                {selectedTournament.game} · {selectedTournament.teamType} · Category-Routed Webhooks
                            </div>
                        </div>
                        <span className={`ml-auto shrink-0 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            selectedTournament.status === 'live' ? 'bg-red-500/10 text-red-400' :
                            selectedTournament.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                            'bg-brand-500/10 text-brand-400'
                        }`}>
                            {selectedTournament.status}
                        </span>
                    </div>
                )}
            </div>

            {/* 6 Category Trigger Cards */}
            <div className="bg-card/50 p-6 rounded-3xl border border-gray-800">
                <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">
                    Granular Channel Dispatch (6 Dedicated Channels)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {currentActions.map(a => (
                        <button type="button"
                            key={a.type}
                            onClick={() => handleSend(a.type)}
                            disabled={sending !== null || !selectedTournament}
                            className={`flex items-center justify-between p-4 rounded-2xl border font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed text-left ${a.color}`}
                        >
                            <div>
                                <div className="text-xs uppercase tracking-wider font-black">{a.label}</div>
                                <div className="text-[10px] opacity-75 font-semibold mt-0.5">{a.desc}</div>
                            </div>
                            <div className="p-2.5 bg-black/20 rounded-xl shrink-0">
                                {sending === a.type ? (
                                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Send className="w-4 h-4" />
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Setup guide */}
            <div className="bg-[#5865F2]/5 border border-[#5865F2]/15 p-6 rounded-3xl space-y-3">
                <div className="text-[10px] font-black text-[#5865F2] uppercase tracking-widest flex items-center gap-2">
                    <Info className="w-4 h-4" /> Granular Webhook Architecture
                </div>
                <p className="text-xs text-gray-400 font-bold leading-relaxed">
                    Configure separate channels in your Discord server for <span className="text-white font-mono">Announcements</span>, <span className="text-white font-mono">Registrations</span>, <span className="text-white font-mono">Group Draws</span>, <span className="text-white font-mono">Match Schedules</span>, <span className="text-white font-mono">Results</span>, and <span className="text-white font-mono">Champions</span> under <span className="text-[#5865F2] font-mono">Settings &rarr; Site Configuration</span>. Each event will automatically route to its dedicated channel with fallback to the main channel if unassigned.
                </p>
            </div>
        </div>
    );
};

export default DiscordAdminPanel;
