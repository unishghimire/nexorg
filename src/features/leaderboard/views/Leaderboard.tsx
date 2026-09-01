import Seo from '../../../shared/components/Seo';
import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../../shared/config/firebase';
import { UserProfile, Team } from '../../../shared/types/types';
import { Trophy, Users, ArrowUp, ArrowDown, Minus, Search, ChevronRight, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../shared/context/AuthContext';
import { motion } from 'motion/react';
import { formatCurrency } from '../../../shared/utils/utils';

const RankIndicator = ({ change }: { change?: number }) => {
    if (change === undefined || change === 0) return <Minus className="w-3 h-3 text-gray-600" />;
    if (change > 0) return (
        <div className="flex items-center text-green-500 gap-0.5">
            <ArrowUp className="w-3 h-3" />
            <span className="text-xs font-bold">{change}</span>
        </div>
    );
    return (
        <div className="flex items-center text-red-500 gap-0.5">
            <ArrowDown className="w-3 h-3" />
            <span className="text-xs font-bold">{Math.abs(change)}</span>
        </div>
    );
};

const PodiumCard = ({ item, rank, type, navigate }: { 
    item: UserProfile | Team; 
    rank: number; 
    type: 'player' | 'team'; 
    navigate: (path: string) => void;
}) => {
    const isFirst = rank === 1;
    const isSecond = rank === 2;
    
    const borderColor = isFirst ? 'border-amber-500' : isSecond ? 'border-gray-500' : 'border-amber-800';
    const bgColor = isFirst ? 'from-amber-500/10' : isSecond ? 'from-gray-500/10' : 'from-amber-800/10';
    const shadowColor = isFirst ? 'shadow-amber-500/20' : isSecond ? 'shadow-gray-500/20' : 'shadow-amber-800/20';

    const isPlayer = type === 'player';
    const player = isPlayer ? (item as UserProfile) : null;
    const team = !isPlayer ? (item as Team) : null;
    const itemId = isPlayer ? player!.uid : team!.id;
    const avatarUrl = isPlayer ? player?.profilePicUrl : team?.logoUrl;
    const avatarSeed = (isPlayer ? player?.username || player?.uid : team?.name || team?.id) || 'player';
    const displayName = (isPlayer ? player?.username : team?.name) || 'Anonymous';
    const subLabel = isPlayer ? player?.teamName || 'Free Agent' : team?.tag || 'TEAM';

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: rank * 0.1 }}
            onClick={() => {
                navigate(isPlayer ? `/user/${itemId}` : `/team/${itemId}`);
            }}
            className={`relative flex flex-col items-center p-4 sm:p-8 rounded-2xl sm:rounded-3xl border ${borderColor} bg-gradient-to-b ${bgColor} to-black ${shadowColor} shadow-2xl cursor-pointer group hover:border-brand-500/50 transition-colors duration-300 hover:-translate-y-2`}
        >
            {isFirst && (
                <div className="absolute -top-4 bg-amber-500 text-black p-2 rounded-full shadow-lg">
                    <Trophy className="w-5 h-5 fill-current" />
                </div>
            )}
            
            <div className="relative mb-6">
                <div className={`w-28 h-28 rounded-full border-4 ${borderColor} overflow-hidden bg-black shadow-xl`}>
                    <img 
                        src={avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`} 
                        alt={`${displayName} avatar`} 
                        className="w-full h-full object-cover" loading="lazy" />
                </div>
                {isPlayer && player?.status === 'online' && (
                    <div className="absolute bottom-1.5 right-1.5 w-5 h-5 bg-emerald-500 border-4 border-black rounded-full"></div>
                )}
                <div className={`absolute -bottom-2 -right-2 w-10 h-10 rounded-full ${isFirst ? 'bg-amber-500' : isSecond ? 'bg-gray-400' : 'bg-amber-800'} flex items-center justify-center font-black text-black text-lg shadow-lg`}>
                    {rank}
                </div>
            </div>

            <div className="text-center">
                <h3 className="text-xl font-black text-white truncate max-w-[180px] mb-2 group-hover:text-brand-400 transition">
                    {displayName}
                </h3>
                <div className="flex items-center justify-center gap-2 mb-4">
                    <span className="text-xs font-black text-gray-500 uppercase tracking-widest">
                        {subLabel}
                    </span>
                    <RankIndicator change={item.rankChange} />
                </div>
                <div className="bg-black px-6 py-2 rounded-full border border-gray-800">
                    <span className="text-brand-300 font-black tracking-widest">{formatCurrency(item.totalEarnings, 'NPR ')}</span>
                </div>
            </div>
        </motion.div>
    );
};

const Leaderboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [view, setView] = useState<'players' | 'teams'>('players');
    const [players, setPlayers] = useState<UserProfile[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchLeaderboard();
    }, [view]);

    const fetchLeaderboard = async () => {
        setLoading(true);
        setFetchError(null);
        try {
            if (view === 'players') {
                const q = query(
                    collection(db, 'users_public'),
                    orderBy('totalEarnings', 'desc'),
                    limit(50)
                );
                const querySnapshot = await getDocs(q);
                const playersData = querySnapshot.docs.map(doc => ({
                    uid: doc.id,
                    ...doc.data()
                } as UserProfile));
                setPlayers(playersData);
            } else {
                const q = query(
                    collection(db, 'teams'),
                    orderBy('totalEarnings', 'desc'),
                    limit(50)
                );
                const querySnapshot = await getDocs(q);
                const teamsData = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as Team));
                setTeams(teamsData);
            }
        } catch (error: any) {
            console.error("Error fetching leaderboard:", error);
            setFetchError(error?.message || "Something went wrong while loading the leaderboard.");
        } finally {
            setLoading(false);
        }
    };

    const filteredPlayers = players.filter(p => 
        p.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredTeams = teams.filter(t => 
        t.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const currentList = view === 'players' ? filteredPlayers : filteredTeams;
    const podium = currentList.slice(0, 3);
    const rest = currentList.slice(3);

    return (
        <div className="max-w-6xl mx-auto px-4 py-12 animate-fade-in">
            <Seo
                title="Leaderboard | NexPlay — Nepal Esports Rankings"
                description="Check NexPlay's national esports leaderboard. See top players and teams in Nepal's competitive gaming scene. Rankings updated daily based on tournament performance."
                canonicalPath="/leaderboard"
                jsonLd={{
                    "@context": "https://schema.org",
                    "@type": "FAQPage",
                    mainEntity: [
                        {
                            "@type": "Question",
                            name: "How are NexPlay leaderboard rankings calculated?",
                            acceptedAnswer: {
                                "@type": "Answer",
                                text: "NexPlay rankings are based on tournament performance, including wins, placement, and prize earnings. Rankings are updated daily to reflect the latest results."
                            }
                        },
                        {
                            "@type": "Question",
                            name: "Can I see my rank on the NexPlay leaderboard?",
                            acceptedAnswer: {
                                "@type": "Answer",
                                text: "Yes, registered players can view their current rank, rating, and tournament history on the leaderboard page."
                            }
                        }
                    ]
                }}
            />
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-8 mb-8 sm:mb-12">
                <div>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white uppercase tracking-tighter mb-4">Leaderboard</h1>
                    <p className="text-gray-400 font-bold">The elite of NexPlay. Updated in real-time.</p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    {/* View Toggle */}
                    <div className="flex bg-card/50 p-1.5 rounded-2xl border border-gray-800">
                        <button 
                            type="button"
                            aria-pressed={view === 'players'}
                            onClick={() => setView('players')}
                            className={`flex items-center gap-2 px-6 py-2.5 min-h-[44px] rounded-xl font-black uppercase tracking-widest text-xs transition ${view === 'players' ? 'bg-brand-500 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                        >
                            <Users className="w-4 h-4" /> Players
                        </button>
                        <button 
                            type="button"
                            aria-pressed={view === 'teams'}
                            onClick={() => setView('teams')}
                            className={`flex items-center gap-2 px-6 py-2.5 min-h-[44px] rounded-xl font-black uppercase tracking-widest text-xs transition ${view === 'teams' ? 'bg-brand-500 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                        >
                            <Trophy className="w-4 h-4" /> Teams
                        </button>
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <div className="relative mb-12">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input 
                    aria-label={`Search ${view}`}
                    type="text"
                    placeholder={`Search ${view}...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-card/50 border border-gray-800 rounded-3xl py-5 pl-16 pr-6 text-white font-black uppercase tracking-widest focus:border-brand-500 focus-visible:outline-none transition shadow-2xl"
                />
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-gray-500 font-black uppercase tracking-widest text-xs">Fetching Rankings...</p>
                </div>
            ) : fetchError ? (
                <div role="alert" className="text-center py-20 bg-card/50 rounded-3xl border border-red-500/30">
                    <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                    <p className="text-red-300 font-black uppercase tracking-widest mb-2">Unable to Load Rankings</p>
                    <p className="text-gray-400 font-bold max-w-sm mx-auto mb-8">{fetchError}</p>
                    <button
                        onClick={fetchLeaderboard}
                        className="px-6 py-3 bg-brand-500 hover:bg-brand-600 text-black font-black uppercase tracking-widest rounded-xl transition"
                    >
                        Try Again
                    </button>
                </div>
            ) : (
                <>
                    {/* Podium Section */}
                    {currentList.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-8 mb-8 sm:mb-16 items-end">
                            {/* 2nd Place */}
                            {podium[1] && <PodiumCard item={podium[1]} rank={2} type={view === 'players' ? 'player' : 'team'} navigate={navigate} />}
                            {/* 1st Place */}
                            {podium[0] && <PodiumCard item={podium[0]} rank={1} type={view === 'players' ? 'player' : 'team'} navigate={navigate} />}
                            {/* 3rd Place */}
                            {podium[2] && <PodiumCard item={podium[2]} rank={3} type={view === 'players' ? 'player' : 'team'} navigate={navigate} />}
                        </div>
                    )}

                    {/* Separator */}
                    <div className="h-px bg-gradient-to-r from-transparent via-gray-800 to-transparent mb-12"></div>

                    {/* List Section */}
                    <div className="space-y-3">
                        {rest.map((item, index) => {
                            const rank = index + 4;
                            const isPlayerView = view === 'players';
                            const player = isPlayerView ? (item as UserProfile) : null;
                            const team = !isPlayerView ? (item as Team) : null;
                            const itemId = isPlayerView ? player!.uid : team!.id;
                            const isUser = isPlayerView && player?.uid === user?.uid;
                            const avatarUrl = isPlayerView ? player?.profilePicUrl : team?.logoUrl;
                            const avatarSeed = isPlayerView ? player?.username : team?.name;
                            const displayName = isPlayerView ? player?.username : team?.name;
                            const subLabel = isPlayerView ? player?.teamName || 'Free Agent' : team?.tag || 'TEAM';
                            
                            return (
                                <motion.div 
                                    key={itemId}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    onClick={() => {
                                        navigate(isPlayerView ? `/user/${itemId}` : `/team/${itemId}`);
                                    }}
                                    className={`flex items-center justify-between p-4 sm:p-6 rounded-2xl sm:rounded-3xl border transition cursor-pointer group ${isUser ? 'bg-brand-500/10 border-brand-500/50' : 'bg-card/50 border-gray-800 hover:border-gray-700 hover:bg-card'}`}
                                >
                                    <div className="flex items-center gap-3 sm:gap-6">
                                        <div className="w-12 text-center">
                                            <span className={`font-black text-xl ${isUser ? 'text-brand-400' : 'text-gray-500'}`}>{rank}</span>
                                        </div>
                                        
                                        <div className="relative">
                                            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-black border border-gray-800">
                                                <img 
                                                    src={avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`} 
                                                    alt={`${displayName} avatar`} 
                                                    className="w-full h-full object-cover" loading="lazy" />
                                            </div>
                                            {isPlayerView && player?.status === 'online' && (
                                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 border-4 border-black rounded-full"></div>
                                            )}
                                        </div>

                                        <div>
                                            <div className="flex items-center gap-3">
                                                <h4 className={`font-black text-lg truncate max-w-[100px] sm:max-w-[140px] sm:max-w-[240px] ${isUser ? 'text-brand-400' : 'text-white'} group-hover:text-brand-400 transition`}>
                                                    {displayName}
                                                </h4>
                                                {isUser && (
                                                    <span className="bg-brand-500 text-white text-xs font-black px-2 py-0.5 rounded-full uppercase tracking-widest">YOU</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="text-xs font-black text-gray-500 uppercase tracking-widest">
                                                    {subLabel}
                                                </span>
                                                <RankIndicator change={item.rankChange} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-12">
                                        <div className="text-right hidden sm:block">
                                            <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Total Earnings</p>
                                            <p className="font-black text-white text-lg">{formatCurrency(item.totalEarnings, 'NPR ')}</p>
                                        </div>
                                        <ChevronRight className="w-6 h-6 text-gray-700 group-hover:text-brand-500 transition" />
                                    </div>
                                </motion.div>
                            );
                        })}

                        {rest.length === 0 && !loading && (
                            <div className="text-center py-20 bg-dark rounded-3xl border border-dashed border-gray-800">
                                <Search className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                                <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">No results found for your search</p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default Leaderboard;
