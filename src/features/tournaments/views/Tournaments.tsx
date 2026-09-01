import Seo from '../../../shared/components/Seo';
import Faq from '../../../shared/components/Faq';
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../shared/config/firebase';
import { Tournament, Game } from '../../../shared/types/types';
import TournamentCard from '../components/TournamentCard';
import { Filter, Search } from 'lucide-react';
import { formatGameModeLabel, formatGameName, toDateSafe } from '../../../shared/utils/utils';


const tournamentFaqs = [
    {
        question: 'How do I join an esports tournament in Nepal?',
        answer: 'Browse tournaments on NexPlay, choose one that matches your game and skill level, and click Register. You will need a free NexPlay account.',
    },
    {
        question: 'What types of tournaments are available?',
        answer: 'NexPlay hosts both free and paid tournaments across games like PUBG Mobile, Free Fire, and Valorant. Formats include solo, duo, and squad competitions.',
    },
    {
        question: 'Can I see tournament results?',
        answer: 'Yes, completed tournament results, winners, and leaderboards are publicly available on NexPlay Results page.',
    },
];


const Tournaments: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [games, setGames] = useState<Game[]>([]);
    
    const [gameFilter, setGameFilter] = useState(searchParams.get('game') || 'all');
    const [modeFilter, setModeFilter] = useState(searchParams.get('mode') || 'all');
    const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
    const [entryFilter, setEntryFilter] = useState(searchParams.get('entry') || 'all');
    const [teamTypeFilter, setTeamTypeFilter] = useState(searchParams.get('teamType') || 'all');
    
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch visible tournaments only — excludes draft/cancelled to reduce reads
                const [tournamentsSnap, gamesSnap] = await Promise.all([
                    getDocs(query(collection(db, 'tournaments'), where('status', 'in', ['upcoming', 'published', 'live', 'completed']))),
                    getDocs(query(collection(db, 'games'), where('isPublished', '==', true)))
                ]);
                
                let tours = tournamentsSnap.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as Tournament))
                    .filter(t => (t as any).matchType !== 'scrims' && (t as any).isScrim !== true && (t as any).type !== 'scrim' && (t as any).type !== 'scrims');
                
                tours.sort((a, b) => {
                    if (a.status === 'live' && b.status !== 'live') return -1;
                    if (b.status === 'live' && a.status !== 'live') return 1;
                    return (toDateSafe(a.startTime)?.getTime() || 0) - (toDateSafe(b.startTime)?.getTime() || 0);
                });

                setTournaments(tours);
                setGames(gamesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game)));
            } catch (error: any) {
                console.error("Error fetching tournament data:", error);
                setFetchError("Failed to load tournaments. Please check your connection.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    useEffect(() => {
        const game = searchParams.get('game');
        if (game && game !== gameFilter) setGameFilter(game);
        const mode = searchParams.get('mode');
        if (mode && mode !== modeFilter) setModeFilter(mode);
        const status = searchParams.get('status');
        if (status && status !== statusFilter) setStatusFilter(status);
    }, [searchParams]);

    useEffect(() => {
        const params = new URLSearchParams();
        if (gameFilter !== 'all') params.set('game', gameFilter);
        if (modeFilter !== 'all') params.set('mode', modeFilter);
        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (entryFilter !== 'all') params.set('entry', entryFilter);
        if (teamTypeFilter !== 'all') params.set('teamType', teamTypeFilter);
        setSearchParams(params, { replace: true });
    }, [gameFilter, modeFilter, statusFilter, entryFilter, teamTypeFilter, setSearchParams]);

    const filteredTournaments = tournaments.filter(t => {
        const matchesGame = gameFilter === 'all' || t.game === gameFilter || t.game?.toLowerCase() === gameFilter.toLowerCase();
        const matchesMode = modeFilter === 'all' || t.type === modeFilter || t.type?.toLowerCase() === modeFilter.toLowerCase();
        const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
        const matchesEntry = entryFilter === 'all' || (entryFilter === 'free' ? t.entryFee === 0 : t.entryFee > 0);
        const matchesTeamType = teamTypeFilter === 'all' || t.teamType === teamTypeFilter || t.teamType?.toLowerCase() === teamTypeFilter.toLowerCase();
        
        return matchesGame && matchesMode && matchesStatus && matchesEntry && matchesTeamType;
    });

    const statusTabs = [
        { id: 'all',       label: 'All',      count: tournaments.length },
        { id: 'upcoming',  label: 'Upcoming', count: tournaments.filter(t => t.status === 'upcoming').length },
        { id: 'live',      label: 'Live Now', count: tournaments.filter(t => t.status === 'live').length },
        { id: 'completed', label: 'Ended',    count: tournaments.filter(t => t.status === 'completed').length }
    ];

    const selectedGameObj = games.find(g => g.name === gameFilter);
    const availableModes = selectedGameObj ? selectedGameObj.modes : Array.from(new Set(games.flatMap(g => g.modes)));

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4 sm:mb-6"></div>
                <p className="text-brand-500 text-xs font-black uppercase tracking-widest animate-pulse">Establishing Uplink...</p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in max-w-7xl mx-auto p-4 sm:p-6 md:p-8 w-full min-w-0">
            <Seo
                title="Esports Tournaments in Nepal | NexPlay"
                description="Browse and join upcoming esports tournaments in Nepal. PUBG Mobile, Free Fire, Valorant and more on NexPlay. Free and paid tournaments with real cash prizes."
                canonicalPath="/tournaments"
                jsonLd={{
                    "@context": "https://schema.org",
                    "@type": "FAQPage",
                    mainEntity: [
                        {
                            "@type": "Question",
                            name: "How do I join an esports tournament on NexPlay?",
                            acceptedAnswer: {
                                "@type": "Answer",
                                text: "Browse the tournaments page, select a tournament, and click Register. You may need a team for squad-based tournaments. Entry fees are paid through your NexPlay wallet."
                            }
                        },
                        {
                            "@type": "Question",
                            name: "What games are available on NexPlay?",
                            acceptedAnswer: {
                                "@type": "Answer",
                                text: "NexPlay hosts tournaments for PUBG Mobile, Free Fire, Valorant, Mobile Legends, and other popular esports titles in Nepal."
                            }
                        },
                        {
                            "@type": "Question",
                            name: "Are NexPlay tournaments free to enter?",
                            acceptedAnswer: {
                                "@type": "Answer",
                                text: "NexPlay offers both free and paid tournaments. Free tournaments are a great way to compete without risk, while paid tournaments offer real cash prizes."
                            }
                        },
                        {
                            "@type": "Question",
                            name: "How are tournament payouts handled?",
                            acceptedAnswer: {
                                "@type": "Answer",
                                text: "Prize pools are distributed through the NexPlay wallet system. Winners receive payouts directly to their wallet after tournament completion and admin verification."
                            }
                        }
                    ]
                }}
            />

            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 sm:mb-12 gap-4 sm:gap-6 border-b border-gray-800 pb-6 sm:pb-8 w-full">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white uppercase tracking-tighter break-words">Tournament Browser</h1>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-black text-gray-500 uppercase tracking-widest">
                    <span>{filteredTournaments.length} tournament{filteredTournaments.length !== 1 ? 's' : ''}</span>
                    {tournaments.filter(t => t.status === 'live').length > 0 && (
                        <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full flex items-center gap-1.5 sm:gap-2 min-h-[32px]">
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse inline-block shrink-0" />
                            {tournaments.filter(t => t.status === 'live').length} Live
                        </span>
                    )}
                </div>
            </header>
            {fetchError && (
                <div className="p-4 mb-6 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-2xl">{fetchError}</div>
            )}

            <div className="flex items-center gap-1 sm:gap-2 border-b border-gray-800 mb-8 sm:mb-10 overflow-x-auto py-1 w-full no-scrollbar">
                {statusTabs.map(s => (
                    <button
                        key={s.id}
                        onClick={() => setStatusFilter(s.id)}
                        className={`min-h-[44px] flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 text-xs font-black uppercase tracking-widest transition-colors whitespace-nowrap shrink-0 ${
                            statusFilter === s.id
                                ? 'text-white border-b-2 border-brand-500'
                                : 'text-gray-500 hover:text-white'
                        }`}
                    >
                        <span>{s.label}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-black tabular-nums ${
                            statusFilter === s.id
                                ? s.id === 'live' ? 'bg-red-500/20 text-red-400' : 'bg-brand-500/20 text-brand-400'
                                : 'bg-surface text-gray-600'
                        }`}>
                            {s.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Filter Bar: Stacks on mobile, 2 columns on tablet, 4 columns on desktop */}
            <div className="bg-card/50 p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl border border-gray-800 mb-8 sm:mb-12 w-full">
                <div className="flex items-center gap-2 sm:gap-3 mb-6 sm:mb-8">
                    <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-brand-500 shrink-0" />
                    <h3 className="text-xs font-black text-white uppercase tracking-widest">Filter Options</h3>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                    <div className="min-w-0">
                        <label className="block text-xs font-black text-gray-500 uppercase mb-2 sm:mb-3 tracking-widest">Game</label>
                        <select 
                            aria-label="Filter tournaments by game"
                            value={gameFilter}
                            onChange={(e) => {
                                setGameFilter(e.target.value);
                                setModeFilter('all');
                            }}
                            className="w-full min-h-[44px] bg-black border border-gray-800 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-white focus:border-brand-500 focus-visible:outline-none transition text-sm font-bold cursor-pointer"
                        >
                            <option value="all">All Games</option>
                            {games.map(g => <option key={g.id} value={g.name}>{formatGameName(g.name)}</option>)}
                        </select>
                    </div>

                    <div className="min-w-0">
                        <label className="block text-xs font-black text-gray-500 uppercase mb-2 sm:mb-3 tracking-widest">Mode</label>
                        <select 
                            aria-label="Filter tournaments by mode"
                            value={modeFilter}
                            onChange={(e) => setModeFilter(e.target.value)}
                            className="w-full min-h-[44px] bg-black border border-gray-800 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-white focus:border-brand-500 focus-visible:outline-none transition text-sm font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={gameFilter === 'all' && availableModes.length === 0}
                        >
                            <option value="all">All Modes</option>
                            {availableModes.map(m => <option key={m} value={m}>{formatGameModeLabel(m)}</option>)}
                        </select>
                    </div>

                    <div className="min-w-0">
                        <label className="block text-xs font-black text-gray-500 uppercase mb-2 sm:mb-3 tracking-widest">Entry</label>
                        <select 
                            aria-label="Filter tournaments by entry type"
                            value={entryFilter}
                            onChange={(e) => setEntryFilter(e.target.value)}
                            className="w-full min-h-[44px] bg-black border border-gray-800 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-white focus:border-brand-500 focus-visible:outline-none transition text-sm font-bold cursor-pointer"
                        >
                            <option value="all">All Types</option>
                            <option value="free">Free Entry</option>
                            <option value="paid">Paid Entry</option>
                        </select>
                    </div>

                    <div className="min-w-0">
                        <label className="block text-xs font-black text-gray-500 uppercase mb-2 sm:mb-3 tracking-widest">Player Size</label>
                        <select 
                            aria-label="Filter tournaments by player size"
                            value={teamTypeFilter}
                            onChange={(e) => setTeamTypeFilter(e.target.value)}
                            className="w-full min-h-[44px] bg-black border border-gray-800 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-white focus:border-brand-500 focus-visible:outline-none transition text-sm font-bold cursor-pointer"
                        >
                            <option value="all">All Sizes</option>
                            <option value="solo">Solo</option>
                            <option value="duo">Duo</option>
                            <option value="squad">Squad</option>
                        </select>
                    </div>
                </div>
            </div>
            
            {/* Tournaments Grid: 1 col on mobile, 2 cols on tablet, 3 cols on desktop */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8 min-h-[50vh] w-full">
                {filteredTournaments.length > 0 ? (
                    filteredTournaments.map(t => <TournamentCard key={t.id} tournament={t} />)
                ) : (
                    <div className="col-span-full py-12 sm:py-20 bg-card/50 rounded-2xl sm:rounded-3xl border border-gray-800 text-center p-4 sm:p-8">
                        <Search className="w-12 h-12 sm:w-16 sm:h-16 text-gray-700 mx-auto mb-4 sm:mb-6" />
                        <h3 className="text-base sm:text-xl font-black text-white uppercase tracking-widest">No Matches Found</h3>
                        <p className="text-xs sm:text-sm text-gray-500 font-bold mt-2">Adjust your filters to see more tournaments.</p>
                    </div>
                )}
            </div>

            <Faq items={tournamentFaqs} />
        </div>
    );
};

export default Tournaments;
