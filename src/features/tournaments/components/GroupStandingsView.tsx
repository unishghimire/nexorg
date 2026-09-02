import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Trophy, CheckCircle2, Copy, EyeOff, Eye, Users, Sword, Lock, Shield } from 'lucide-react';
import { Tournament, TournamentGroup, Participant } from '../../../shared/types/types';
import { useNotification } from '../../../shared/context/NotificationContext';
import { useAuth } from '../../../shared/context/AuthContext';
import { aggregateStandings } from '../../../shared/services/scoringEngine';
import { fetchRoomCredentials, subscribeRoomCredentials } from '../../../shared/services/roomCredentials';
import { useEffect } from 'react';

// ═══════════════════════════════════════════════════════════════
// GROUP ACCESS CONTROL
// ponytail: 3-tier access — organizer/admin sees all, player sees
// only their group, unregistered sees group names only (locked).
// Uses existing isPublic/passCode fields on TournamentGroup.
// ═══════════════════════════════════════════════════════════════

interface GroupStandingsViewProps {
    tournament: Tournament;
    participants: Participant[];
}

interface TeamStanding {
    id: string;
    name: string;
    logoUrl?: string;
    wins: number;
    losses: number;
    points: number;
    kills: number;
    isCurrentUser: boolean;
    placementPoints?: number;
    killPoints?: number;
    matches?: number;
    bestPlacement?: number;
}

function computeStandings(group: TournamentGroup, participants: Participant[], currentTeamId?: string): TeamStanding[] {
    const completedMatches = (group.matches ?? []).filter(m => m.status === 'completed');
    const hasBRResults = completedMatches.some(m => m.results && m.results.length > 0);

    if (hasBRResults) {
        const matchResults = completedMatches
            .filter(m => m.results && m.results.length > 0)
            .map(m => m.results!.map(r => ({
                teamId: r.teamId, teamName: r.teamName, placement: r.placement,
                kills: r.kills, placementPoints: 0, killPoints: 0,
                totalPoints: r.totalPoints, scoringVersion: 1,
            })));

        const teams = group.teams.map(t => {
            const p = participants.find(part => part.teamId === t.id || part.userId === t.id);
            return { id: t.id, name: t.name, logoUrl: p?.logoUrl };
        });

        const standings = aggregateStandings({ matchResults, teams });

        return standings.map(s => ({
            id: s.teamId, name: s.teamName, logoUrl: s.logoUrl,
            wins: 0, losses: 0, points: s.totalPoints, kills: s.kills,
            isCurrentUser: s.teamId === currentTeamId,
            placementPoints: s.placementPoints, killPoints: s.killPoints,
            matches: s.matches,
            bestPlacement: s.bestPlacement === Infinity ? undefined : s.bestPlacement,
        }));
    }

    // Head-to-head format
    const map: Record<string, TeamStanding> = {};
    group.teams.forEach(t => {
        const participant = participants.find(p => p.teamId === t.id || p.userId === t.id);
        map[t.id] = {
            id: t.id, name: t.name, logoUrl: participant?.logoUrl,
            wins: 0, losses: 0, points: 0, kills: 0,
            isCurrentUser: t.id === currentTeamId,
        };
    });

    completedMatches.forEach(m => {
        const s1 = m.score1 ?? 0;
        const s2 = m.score2 ?? 0;
        if (m.team1Id && map[m.team1Id]) {
            map[m.team1Id].points += s1;
            if (s1 > s2) map[m.team1Id].wins++; else map[m.team1Id].losses++;
        }
        if (m.team2Id && map[m.team2Id]) {
            map[m.team2Id].points += s2;
            if (s2 > s1) map[m.team2Id].wins++; else map[m.team2Id].losses++;
        }
    });

    return Object.values(map).sort((a, b) => b.points - a.points || b.wins - a.wins);
}

function resolveTeamName(id: string, group: TournamentGroup, participants: Participant[]): string {
    if (!id || id === 'TBD' || id === 'ALL_TEAMS') return id;
    const team = group.teams.find(t => t.id === id);
    if (team) return team.name;
    const p = participants.find(p => p.teamId === id || p.userId === id);
    return p?.teamName || p?.username || id;
}

// ─── Standings Table ──────────────────────────────────────────────────
function StandingsTable({ standings }: { standings: TeamStanding[] }) {
    const isBR = standings.some(s => s.placementPoints !== undefined);

    if (isBR) {
        return (
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                <table className="w-full text-left min-w-[580px]">
                    <thead>
                        <tr className="border-b border-gray-800 text-[10px] font-black uppercase tracking-widest text-gray-500">
                            <th className="pb-3 pl-2 w-12 text-center">#</th>
                            <th className="pb-3 w-14">LOGO</th>
                            <th className="pb-3">NAME</th>
                            <th className="pb-3 text-center w-20">KILL</th>
                            <th className="pb-3 text-center w-24">PLACEMENT</th>
                            <th className="pb-3 text-right pr-4 w-20">TOTAL</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                        {standings.map((s, idx) => (
                            <tr key={s.id} className={`transition ${s.isCurrentUser ? 'bg-brand-500/10 font-bold' : 'hover:bg-white/[0.02]'}`}>
                                <td className="py-3.5 pl-2 text-center font-black text-sm">
                                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-xs font-black ${
                                        idx === 0 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                                        idx === 1 ? 'bg-gray-400/20 text-gray-300 border border-gray-400/30' :
                                        idx === 2 ? 'bg-amber-800/20 text-amber-600 border border-amber-800/30' :
                                        'text-gray-500'
                                    }`}>
                                        {idx + 1}
                                    </span>
                                </td>
                                <td className="py-3.5">
                                    <div className="w-9 h-9 rounded-xl bg-surface border border-gray-700 flex items-center justify-center font-black text-xs text-brand-400 overflow-hidden shrink-0">
                                        {s.logoUrl ? (
                                            <img src={s.logoUrl} alt={s.name} className="w-full h-full object-cover" loading="lazy" />
                                        ) : (
                                            s.name.charAt(0).toUpperCase()
                                        )}
                                    </div>
                                </td>
                                <td className="py-3.5">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-sm font-black truncate max-w-[200px] ${s.isCurrentUser ? 'text-brand-400' : 'text-white'}`}>
                                            {s.name}
                                        </span>
                                        {s.isCurrentUser && (
                                            <span className="bg-brand-500 text-white text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0">
                                                YOU
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="py-3.5 text-center font-black text-red-400 text-sm">{s.killPoints ?? (s.kills || 0)}</td>
                                <td className="py-3.5 text-center font-black text-blue-400 text-sm">{s.placementPoints ?? 0}</td>
                                <td className="py-3.5 text-right pr-4 font-black text-amber-400 text-base">{s.points}</td>
                            </tr>
                        ))}
                        {standings.length === 0 && (
                            <tr>
                                <td colSpan={6} className="py-8 text-center text-gray-500 text-xs uppercase font-black tracking-widest">
                                    No teams assigned yet
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        );
    }

    // Head-to-head standings
    return (
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="w-full text-left min-w-[550px]">
                <thead>
                    <tr className="border-b border-gray-800 text-[10px] font-black uppercase tracking-widest text-gray-500">
                        <th className="pb-3 pl-2 w-12">#</th>
                        <th className="pb-3">Team / Player</th>
                        <th className="pb-3 text-center w-16">PTS</th>
                        <th className="pb-3 text-center w-16">W</th>
                        <th className="pb-3 text-center w-16">L</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                    {standings.map((s, idx) => (
                        <tr
                            key={s.id}
                            className={`transition ${s.isCurrentUser ? 'bg-brand-500/10 font-bold' : 'hover:bg-white/[0.02]'}`}
                        >
                            <td className="py-3.5 pl-2 font-black text-sm">
                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-xs font-black ${
                                    idx === 0 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                                    idx === 1 ? 'bg-gray-400/20 text-gray-300 border border-gray-400/30' :
                                    idx === 2 ? 'bg-amber-800/20 text-amber-600 border border-amber-800/30' :
                                    'text-gray-500'
                                }`}>
                                    {idx + 1}
                                </span>
                            </td>
                            <td className="py-3.5">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-surface border border-gray-700 flex items-center justify-center font-black text-xs text-brand-400 overflow-hidden shrink-0">
                                        {s.logoUrl ? (
                                            <img src={s.logoUrl} alt={s.name} className="w-full h-full object-cover" loading="lazy" />
                                        ) : (
                                            s.name.charAt(0).toUpperCase()
                                        )}
                                    </div>
                                    <span className={`text-sm font-black truncate max-w-[180px] ${s.isCurrentUser ? 'text-brand-400' : 'text-white'}`}>
                                        {s.name}
                                    </span>
                                    {s.isCurrentUser && (
                                        <span className="bg-brand-500 text-white text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0">
                                            YOU
                                        </span>
                                    )}
                                </div>
                            </td>
                            <td className="py-3.5 text-center font-black text-brand-400 text-sm">{s.points}</td>
                            <td className="py-3.5 text-center font-bold text-emerald-400/80 text-sm">{s.wins}</td>
                            <td className="py-3.5 text-center font-bold text-red-400/80 text-sm">{s.losses}</td>
                        </tr>
                    ))}
                    {standings.length === 0 && (
                        <tr>
                            <td colSpan={5} className="py-8 text-center text-gray-500 text-xs uppercase font-black tracking-widest">
                                No teams assigned yet
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

// ─── Locked Group Card (shown to players who aren't in this group) ─────
function LockedGroupCard({ group }: { group: TournamentGroup }) {
    return (
        <div className="rounded-3xl border border-gray-800 overflow-hidden">
            <div className="px-6 py-4 flex items-center justify-between bg-card/70">
                <div className="flex items-center gap-3">
                    <Lock className="w-5 h-5 text-gray-600" />
                    <h3 className="text-gray-500 font-black text-lg uppercase tracking-tighter">{group.name}</h3>
                </div>
                <div className="flex items-center gap-2 text-xs font-black text-gray-600 uppercase tracking-widest">
                    <Users className="w-4 h-4" />
                    {group.teams.length} Teams
                </div>
            </div>
            <div className="p-6 bg-dark/20">
                <div className="flex flex-col items-center justify-center py-6 text-center">
                    <Shield className="w-8 h-8 text-gray-700 mb-3" />
                    <p className="text-gray-500 text-sm font-bold mb-1">Other groups are private during the match</p>
                    <p className="text-gray-600 text-xs">Standings and matches from other groups will be visible after the round is completed</p>
                </div>
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────
export default function GroupStandingsView({ tournament, participants }: GroupStandingsViewProps) {
    const { profile } = useAuth();
    const { showToast } = useNotification();
    const [showPass, setShowPass] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);

    const groups = tournament.groups ?? [];
    const currentTeamId = profile?.teamId || profile?.uid;

    // Access control: organizer/admin sees all, player sees only their group
    const isOrganizer = profile?.uid === tournament.hostUid || profile?.role === 'admin' || profile?.role === 'organizer';

    // Find which group the current player is in
    const myGroup = useMemo(() =>
        groups.find(g => g.teams.some(t => t.id === currentTeamId)) ?? null,
        [groups, currentTeamId]
    );

    const isLive = tournament.status === 'live';
    const [secureCreds, setSecureCreds] = useState<{ roomId?: string; roomPass?: string } | null>(null);

    useEffect(() => {
        if (!tournament.id) return;
        const targetGroupId = myGroup?.id;
        if (!targetGroupId && !isOrganizer) return;

        const unsub = subscribeRoomCredentials(
            tournament.id,
            (creds) => {
                if (creds && (creds.roomId || creds.roomPass)) {
                    setSecureCreds(creds);
                } else {
                    fetchRoomCredentials(tournament.id).then(mainCreds => {
                        if (mainCreds) setSecureCreds(mainCreds);
                    });
                }
            },
            targetGroupId
        );

        return () => unsub();
    }, [tournament.id, myGroup?.id, isOrganizer]);

    const groupRoomId = secureCreds?.roomId;
    const groupRoomPass = secureCreds?.roomPass;
    const showRoom = (isLive || Boolean(groupRoomId)) && Boolean(groupRoomId || groupRoomPass);

    // Is the tournament past the group stage? If so, reveal all groups.
    const isPastGroupStage = tournament.stage === 'knockout' || tournament.status === 'completed';
    const canSeeAllGroups = isOrganizer || isPastGroupStage;

    const copy = (value: string, key: string) => {
        navigator.clipboard.writeText(value);
        setCopied(key);
        showToast('Copied!', 'success');
        setTimeout(() => setCopied(null), 2000);
    };

    if (groups.length === 0) {
        return (
            <div className="text-center py-16 bg-card/50 rounded-3xl border border-dashed border-gray-800">
                <Trophy className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                <h3 className="text-white font-black text-lg uppercase tracking-tighter mb-2">Groups Not Published Yet</h3>
                <p className="text-gray-500 font-bold text-sm max-w-xs mx-auto">
                    The organizer hasn't drawn the groups yet. Check back once registration closes.
                </p>
            </div>
        );
    }

    // ── Privacy Gate 1: Unauthenticated visitors cannot view private match groups ──
    if (!profile) {
        return (
            <div className="text-center py-16 bg-card/50 rounded-3xl border border-dashed border-gray-800 p-8">
                <Lock className="w-12 h-12 text-brand-500 mx-auto mb-4" />
                <h3 className="text-white font-black text-lg uppercase tracking-tighter mb-2">Match Groups Are Private</h3>
                <p className="text-gray-400 font-bold text-sm max-w-sm mx-auto mb-6">
                    Tournament group allocations, match schedules, and brackets are private. Sign in with your registered account to view your assigned group.
                </p>
                <a href="/login" className="inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-xs font-black uppercase tracking-wider px-6 py-3 rounded-full transition shadow-lg shadow-brand-500/20">
                    Log In to View Your Group
                </a>
            </div>
        );
    }

    // ── Privacy Gate 2: Non-participants cannot view groups ──
    if (!myGroup && !isOrganizer) {
        return (
            <div className="text-center py-16 bg-card/50 rounded-3xl border border-dashed border-gray-800 p-8">
                <Shield className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-white font-black text-lg uppercase tracking-tighter mb-2">Private Group Allocation</h3>
                <p className="text-gray-400 font-bold text-sm max-w-sm mx-auto">
                    Only registered players and teams in this tournament can view their assigned group. If you recently registered, your group assignment will appear here once published by the organizer.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* ── Room credentials strip (live + joined players only) ── */}
            {showRoom && myGroup && (
                <div className="bg-brand-500/10 border border-brand-500/20 p-6 rounded-3xl">
                    <div className="text-brand-400 font-black text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Lock className="w-4 h-4" /> Match Credentials — {myGroup.name}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {groupRoomId && (
                            <div className="bg-black/50 p-4 rounded-2xl border border-white/5 flex justify-between items-center">
                                <div>
                                     <div className="text-[9px] text-gray-500 uppercase font-black tracking-widest mb-1">Room ID</div>
                                    <div className="text-white font-mono font-black text-xl">{groupRoomId}</div>
                                </div>
                                <button type="button" onClick={() => copy(groupRoomId!, 'roomId')} aria-label="Copy Room ID" className="p-2 hover:bg-white/10 rounded-xl transition">
                                    {copied === 'roomId' ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5 text-gray-500" />}
                                </button>
                            </div>
                        )}
                        {groupRoomPass && (
                            <div className="bg-black/50 p-4 rounded-2xl border border-white/5 flex justify-between items-center">
                                <div>
                                    <div className="text-[9px] text-gray-500 uppercase font-black tracking-widest mb-1">Password</div>
                                    <div className="text-white font-mono font-black text-xl">
                                        {showPass ? groupRoomPass : '••••••'}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button type="button" onClick={() => setShowPass(p => !p)} aria-label={showPass ? 'Hide password' : 'Show password'} className="p-2 hover:bg-white/10 rounded-xl transition">
                                        {showPass ? <EyeOff className="w-5 h-5 text-gray-500" /> : <Eye className="w-5 h-5 text-gray-500" />}
                                    </button>
                                    <button type="button" onClick={() => copy(groupRoomPass!, 'roomPass')} aria-label="Copy Password" className="p-2 hover:bg-white/10 rounded-xl transition">
                                        {copied === 'roomPass' ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5 text-gray-500" />}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── My group (Registered player's assigned group) ── */}
            {myGroup && (
                <GroupCard
                    group={myGroup}
                    participants={participants}
                    currentTeamId={currentTeamId}
                    isHighlighted
                    label="Your Assigned Group"
                />
            )}

            {/* ── Organizer / Admin View: All other groups ── */}
            {isOrganizer && groups.filter(g => g.id !== myGroup?.id).length > 0 && (
                <div>
                    <div className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-3">
                        <span className="inline-block w-6 h-px bg-surface" />
                        All Tournament Groups (Organizer View)
                    </div>
                    <div className="space-y-6">
                        {groups
                            .filter(g => g.id !== myGroup?.id)
                            .map(group => (
                                <GroupCard
                                    key={group.id}
                                    group={group}
                                    participants={participants}
                                    currentTeamId={currentTeamId}
                                    isHighlighted={false}
                                />
                            ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── GroupCard sub-component ──────────────────────────────────────────────────

interface GroupCardProps {
    group: TournamentGroup;
    participants: Participant[];
    currentTeamId?: string;
    isHighlighted: boolean;
    label?: string;
}

function GroupCard({ group, participants, currentTeamId, isHighlighted, label }: GroupCardProps) {
    const [activeView, setActiveView] = useState<'standings' | 'matches' | 'teams'>('standings');
    const standings = computeStandings(group, participants, currentTeamId);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-3xl border overflow-hidden ${isHighlighted ? 'border-brand-500/40 shadow-lg shadow-brand-500/10' : 'border-gray-800'}`}
        >
            {/* Header */}
            <div className={`px-6 py-4 flex items-center justify-between ${isHighlighted ? 'bg-brand-500/10' : 'bg-card/70'}`}>
                <div className="flex items-center gap-3">
                    <Trophy className={`w-5 h-5 ${isHighlighted ? 'text-brand-400' : 'text-gray-600'}`} />
                    <h3 className="text-white font-black text-lg uppercase tracking-tighter">{group.name}</h3>
                    {label && (
                        <span className="bg-brand-500 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                            {label}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 text-xs font-black text-gray-500 uppercase tracking-widest">
                    <Users className="w-4 h-4" />
                    {group.teams.length} Teams
                </div>
            </div>

            {/* Tab switcher */}
            <div role="tablist" aria-label={`${group.name} views`} className="flex border-b border-gray-800/80 bg-dark/40 px-6 pt-2">
                {(['standings', 'matches', 'teams'] as const).map(tab => (
                    <button
                        key={tab}
                        type="button"
                        role="tab"
                        id={`tab-${group.id}-${tab}`}
                        aria-selected={activeView === tab}
                        aria-controls={`tabpanel-${group.id}-${tab}`}
                        onClick={() => setActiveView(tab)}
                        className={`pb-3 px-4 font-black text-xs uppercase tracking-widest border-b-2 transition -mb-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-t-lg ${
                            activeView === tab
                                ? 'border-brand-500 text-brand-400'
                                : 'border-transparent text-gray-500 hover:text-gray-300'
                        }`}
                    >
                        {tab === 'standings' && 'Standings'}
                        {tab === 'matches' && `Matches (${group.matches?.length ?? 0})`}
                        {tab === 'teams' && `Teams (${group.teams.length})`}
                    </button>
                ))}
            </div>

            {/* Content area */}
            <div className="p-6 bg-dark/20">
                {/* ── Standings Table ── */}
                {activeView === 'standings' && (
                    <StandingsTable standings={standings} />
                )}

                {/* ── Matches View ── */}
                {activeView === 'matches' && (
                    <div className="space-y-3">
                        {(group.matches ?? []).map((m, idx) => {
                            const t1Name = resolveTeamName(m.team1Id ?? '', group, participants);
                            const t2Name = resolveTeamName(m.team2Id ?? '', group, participants);
                            const isDone = m.status === 'completed';
                            const isLive = m.status === 'live';

                            return (
                                <div
                                    key={m.id || idx}
                                    className="p-4 rounded-2xl bg-black/40 border border-gray-800/80 flex items-center justify-between gap-4"
                                >
                                    <div className="flex items-center gap-2 text-xs font-black text-gray-500 uppercase tracking-widest shrink-0 w-24">
                                        <Sword className="w-3.5 h-3.5 text-brand-500" />
                                        Match {m.round || idx + 1}
                                    </div>

                                    <div className="flex-1 grid grid-cols-3 items-center text-center max-w-md mx-auto">
                                        <div className={`text-sm font-black truncate text-right ${m.winnerId === m.team1Id ? 'text-brand-400' : 'text-gray-200'}`}>
                                            {t1Name || 'TBD'}
                                        </div>

                                        <div className="px-3">
                                            {isDone ? (
                                                <span className="font-mono font-black text-white bg-surface px-3 py-1 rounded-xl text-sm border border-gray-700">
                                                    {m.score1 ?? 0} - {m.score2 ?? 0}
                                                </span>
                                            ) : isLive ? (
                                                <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full animate-pulse">
                                                    LIVE
                                                </span>
                                            ) : (
                                                <span className="text-gray-600 text-xs font-black uppercase tracking-widest">VS</span>
                                            )}
                                        </div>

                                        <div className={`text-sm font-black truncate text-left ${m.winnerId === m.team2Id ? 'text-brand-400' : 'text-gray-200'}`}>
                                            {t2Name || 'TBD'}
                                        </div>
                                    </div>

                                    <div className="shrink-0 w-24 text-right">
                                        {isDone && (
                                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                                                Done
                                            </span>
                                        )}
                                        {!isDone && !isLive && (
                                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 bg-card border border-gray-800 px-2.5 py-1 rounded-full">
                                                Upcoming
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {(group.matches ?? []).length === 0 && (
                            <div className="py-8 text-center text-gray-500 text-xs font-black uppercase tracking-widest">
                                No matches scheduled for this group yet
                            </div>
                        )}
                    </div>
                )}

                {/* ── Teams Roster View ── */}
                {activeView === 'teams' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {group.teams.map(t => {
                            const isMe = t.id === currentTeamId;
                            const participant = participants.find(p => p.teamId === t.id || p.userId === t.id);

                            return (
                                <div
                                    key={t.id}
                                    className={`p-4 rounded-2xl border flex items-center gap-3 ${
                                        isMe
                                            ? 'bg-brand-500/10 border-brand-500/30'
                                            : 'bg-black/30 border-gray-800/80'
                                    }`}
                                >
                                    <div className="w-10 h-10 rounded-xl bg-surface border border-gray-700 flex items-center justify-center font-black text-sm text-brand-400 overflow-hidden shrink-0">
                                        {participant?.logoUrl ? (
                                            <img src={participant?.logoUrl} alt={t.name} className="w-full h-full object-cover" loading="lazy" />
                                        ) : (
                                            t.name.charAt(0).toUpperCase()
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-white font-black text-sm truncate">{t.name}</div>
                                        {isMe && (
                                            <div className="text-brand-400 font-black text-[9px] uppercase tracking-widest">
                                                Your Team
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {group.teams.length === 0 && (
                            <div className="col-span-full py-8 text-center text-gray-500 text-xs font-black uppercase tracking-widest">
                                No teams in this group yet
                            </div>
                        )}
                    </div>
                )}
            </div>
        </motion.div>
    );
}
