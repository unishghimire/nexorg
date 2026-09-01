import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../shared/config/firebase';
import { useAuth } from '../../../shared/context/AuthContext';
import { Tournament } from '../../../shared/types/types';
import { formatCurrency, formatGameName, toDateSafe } from '../../../shared/utils/utils';
import { useNavigate } from 'react-router-dom';
import { Trophy, Eye, Upload, BarChart, User, Shield, Users, AlertCircle } from 'lucide-react';
import ResultUploadModal from '../../results/components/ResultUploadModal';
import TournamentResultModal from '../../tournaments/components/TournamentResultModal';
import { Seo } from '../../../shared/components/Seo';
import { fetchRoomCredentials } from '../../../shared/services/roomCredentials';

const Dashboard: React.FC = () => {
    const { user, profile } = useAuth();
    const [myTournaments, setMyTournaments] = useState<(Tournament & { role: 'participant' | 'organizer'; registration?: any })[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
    const [isResultModalOpen, setIsResultModalOpen] = useState(false);
    const [viewResultTournament, setViewResultTournament] = useState<Tournament | null>(null);
    const navigate = useNavigate();

    const fetchAllData = async () => {
        if (!user) return;
        setFetchError(null);
        try {
            // Fetch Joined Tournaments
            const partSnap = await getDocs(query(
                collection(db, 'participants'),
                where('userId', '==', user.uid)
            ));
            
            const partDocs = partSnap.docs.map(doc => doc.data());
            partDocs.sort((a, b) => {
                const aTime = toDateSafe(a.timestamp)?.getTime() || 0;
                const bTime = toDateSafe(b.timestamp)?.getTime() || 0;
                return bTime - aTime;
            });
            const joinedTours: (Tournament & { role: 'participant' | 'organizer'; registration?: any })[] = [];
            const tournamentIds = partDocs.map(data => data.tournamentId);
            const uniqueTournamentIds = [...new Set(tournamentIds)];
            
            if (uniqueTournamentIds.length > 0) {
                const chunks = [];
                for (let i = 0; i < uniqueTournamentIds.length; i += 10) {
                    chunks.push(uniqueTournamentIds.slice(i, i + 10));
                }
                
                for (const chunk of chunks) {
                    const q = query(collection(db, 'tournaments'), where('__name__', 'in', chunk));
                    const tSnap = await getDocs(q);
                    
                    tSnap.docs.forEach(tDoc => {
                        // Find the corresponding participant record
                        const pDoc = partSnap.docs.find(p => p.data().tournamentId === tDoc.id);
                        if (pDoc) {
                            joinedTours.push({ 
                                id: tDoc.id, 
                                ...tDoc.data(), 
                                role: 'participant',
                                registration: pDoc.data() 
                             } as Tournament & { role: 'participant' | 'organizer'; registration?: any });
                        }
                    });
                }
            }

            // Fetch Hosted Tournaments if organizer/admin
            let hostedTours: (Tournament & { role: 'participant' | 'organizer'; registration?: any })[] = [];
            if (profile?.role === 'organizer' || profile?.role === 'admin') {
                const hostedSnap = await getDocs(query(
                    collection(db, 'tournaments'),
                    where('hostUid', '==', user.uid)
                ));
                hostedTours = hostedSnap.docs
                    .map(d => ({ id: d.id, ...d.data(), role: 'organizer' } as Tournament & { role: 'participant' | 'organizer'; registration?: any }))
                    .filter(t => (t as any).matchType !== 'scrims' && (t as any).isScrim !== true && (t as any).type !== 'scrim' && (t as any).type !== 'scrims');
                hostedTours.sort((a, b) => {
                    const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                    const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                    return bTime - aTime;
                });
            }

            // Merge and remove duplicates (if any)
            const allTours = [...hostedTours, ...joinedTours];
            const uniqueTours = allTours.filter((t, index, self) => 
                index === self.findIndex((m) => m.id === t.id)
            );
            
            const tournamentsWithCredentials = await Promise.all(uniqueTours.map(async tournament => {
                if (tournament.status !== 'live' && tournament.status !== 'upcoming') return tournament;
                const credentials = await fetchRoomCredentials(tournament.id);
                return credentials ? { ...tournament, ...credentials } : tournament;
            }));
            setMyTournaments(tournamentsWithCredentials);

        } catch (error: any) {
            console.error("Error fetching dashboard data:", error);
            setFetchError(error?.message || "Something went wrong while loading your dashboard.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, [user, profile]);

    const handleUploadResult = (t: Tournament) => {
        setSelectedTournament(t);
        setIsResultModalOpen(true);
    };

    if (loading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-xs text-gray-500 font-black uppercase tracking-widest">Loading Dashboard...</p>
            </div>
        );
    }

    if (fetchError) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center gap-4 px-4">
                <div className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center border border-red-500/30">
                    <AlertCircle className="w-7 h-7" />
                </div>
                <p className="text-sm text-gray-400 font-bold max-w-md">{fetchError}</p>
                <button
                    onClick={fetchAllData}
                    className="px-6 py-3 bg-brand-500 hover:bg-brand-600 text-black font-black uppercase tracking-widest rounded-xl transition"
                >
                    Try Again
                </button>
            </div>
        );
    }

    return (
        <div className="animate-fade-in max-w-5xl mx-auto p-4 md:p-8">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6 border-b border-gray-800 pb-8">
            <Seo title="Dashboard | NexPlay" description="Your personal dashboard" noindex />
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white uppercase tracking-tighter">My Dashboard</h2>
            </header>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-8 sm:mb-12">
                {[
                    { title: 'Profile', icon: User, path: '/profile', interaction: 'ClickProfileIcon' },
                    { title: 'Teams', icon: Users, path: '/teams', interaction: 'ClickTeamsIcon' },
                    { title: 'Tournaments', icon: Trophy, path: '#my-tournaments', interaction: 'ClickMyTournamentsAnchor' },
                    { title: 'Leaderboard', icon: BarChart, path: '/leaderboard', interaction: 'ClickLeaderboardIcon' },
                ].map((item, idx) => {
                    const Component = item.path.startsWith('#') ? 'a' : 'div';
                    const props = item.path.startsWith('#') ? { href: item.path } : { onClick: () => { navigate(item.path); } };
                    
                    return (
                        <Component 
                            key={idx}
                            {...props}
                            className="bg-card/50 p-4 sm:p-8 rounded-2xl sm:rounded-3xl border border-gray-800 hover:border-brand-500/50 transition-colors hover:-translate-y-1 cursor-pointer group shadow-2xl flex flex-col items-center text-center gap-5"
                        >
                            <div className="w-16 h-16 rounded-2xl bg-black flex items-center justify-center border border-gray-800 group-hover:bg-brand-500/10 group-hover:border-brand-500/50 transition duration-300">
                                <item.icon className="w-7 h-7 text-brand-500" />
                            </div>
                            <h3 className="text-white font-black uppercase tracking-widest text-xs group-hover:text-brand-400 transition">{item.title}</h3>
                        </Component>
                    );
                })}
            </div>

            <h3 id="my-tournaments" className="text-xl sm:text-2xl md:text-3xl font-black text-white uppercase tracking-tighter mb-8 pt-4 border-t border-gray-800 pt-8">My Tournaments</h3>
            <div className="grid gap-6">
                {myTournaments.length > 0 ? (
                    myTournaments.map(t => {
                        const isLive = t.status === 'live';
                        const isCompleted = t.status === 'completed';
                        const showRoom = isLive || (t.status === 'upcoming' && t.roomId);

                        return (
                            <div key={t.id} className="bg-black border border-gray-800 p-4 sm:p-8 rounded-2xl sm:rounded-3xl transition duration-300 hover:border-gray-700 hover:bg-card/50 group">
                                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 sm:gap-6">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-4 flex-wrap">
                                            {t.role === 'organizer' ? (
                                                <span className="bg-brand-500/10 text-brand-400 text-xs font-black px-4 py-1.5 rounded-full border border-brand-500/20 flex items-center gap-2 uppercase tracking-widest">
                                                    <Shield className="w-4 h-4" /> Host
                                                </span>
                                            ) : (
                                                <span className="bg-blue-500/10 text-blue-400 text-xs font-black px-4 py-1.5 rounded-full border border-blue-500/20 flex items-center gap-2 uppercase tracking-widest">
                                                    <User className="w-4 h-4" /> Participant
                                                </span>
                                            )}
                                            <span className="bg-surface text-gray-400 text-xs font-black px-4 py-1.5 rounded-full border border-gray-700 uppercase tracking-widest">{formatGameName(t.game)}</span>
                                            <span className="bg-brand-500/10 text-brand-300 text-xs font-black px-4 py-1.5 rounded-full border border-brand-500/20 uppercase tracking-widest">{t.teamType}</span>
                                        </div>
                                        <h3 
                                            className="text-xl sm:text-2xl font-black text-white mb-3 hover:text-brand-400 truncate min-w-0 transition cursor-pointer tracking-tighter" 
                                            onClick={() => {
                                                    navigate(`/tournaments/${t.id}`);
                                                }}
                                        >
                                            {t.title}
                                        </h3>
                                        {t.registration && (
                                            <div className="flex flex-wrap gap-6 mt-4">
                                                <div className="text-xs text-gray-400 font-black uppercase tracking-widest">
                                                    Team: <span className="text-brand-300">{t.registration.teamName || 'SOLO'}</span>
                                                </div>
                                                <div className="text-xs text-gray-400 font-black uppercase tracking-widest">
                                                    UID: <span className="text-brand-300 break-all">{t.registration.inGameId}</span>
                                                </div>
                                            </div>
                                        )}
                                        <div className={`text-xs font-black uppercase tracking-widest mt-4 ${isLive ? 'text-emerald-400 animate-pulse' : isCompleted ? 'text-gray-500' : 'text-blue-400'}`}>
                                            Status: {t.status}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xl font-black text-brand-400">{formatCurrency(t.prizePool)}</div>
                                    </div>
                                </div>
                                {showRoom && (
                                    <div className="mt-4 sm:mt-8 bg-card/50 p-4 sm:p-6 rounded-2xl border border-gray-800 flex flex-wrap sm:flex-nowrap gap-4 sm:gap-8 text-sm font-mono items-center justify-center">
                                        <div>
                                            <span className="text-gray-500 uppercase text-xs font-black tracking-widest">Room ID:</span> <span className="text-white font-black select-all ml-3">{t.roomId || 'Wait'}</span>
                                        </div>
                                        <div className="hidden sm:block w-px h-6 bg-surface"></div>
                                        <div>
                                            <span className="text-gray-500 uppercase text-xs font-black tracking-widest">Pass:</span> <span className="text-white font-black select-all ml-3">{t.roomPass || 'Wait'}</span>
                                        </div>
                                    </div>
                                )}
                                <div className="mt-6 sm:mt-8 flex flex-wrap gap-4 sm:gap-6 border-t border-gray-800 pt-6 sm:pt-8">
                                    <button type="button" onClick={() => {
                                            navigate(`/tournaments/${t.id}`);
                                        }} className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-white transition touch-target">
                                        <Eye className="w-5 h-5" /> View Details
                                    </button>
                                    {isLive && t.role === 'organizer' && (
                                        <button type="button" 
                                            onClick={() => {
                                                    handleUploadResult(t);
                                                }}
                                            className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-emerald-400 hover:text-white transition touch-target"
                                        >
                                            <Upload className="w-5 h-5" /> Upload Result
                                        </button>
                                    )}
                                    {isCompleted && (
                                        <button type="button" 
                                            onClick={() => {
                                                    setViewResultTournament(t);
                                                }}
                                            className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-blue-400 hover:text-white transition touch-target"
                                        >
                                            <BarChart className="w-5 h-5" /> View Result
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="bg-card/50 p-8 sm:p-16 rounded-2xl sm:rounded-3xl border border-gray-800 text-center">
                        <p className="text-gray-500 font-bold uppercase tracking-widest">No matches found.</p>
                    </div>
                )}
            </div>
            {selectedTournament && (
                <ResultUploadModal 
                    isOpen={isResultModalOpen}
                    onClose={() => setIsResultModalOpen(false)}
                    tournament={selectedTournament}
                    onSuccess={fetchAllData}
                />
            )}

            {viewResultTournament && (
                <TournamentResultModal
                    isOpen={!!viewResultTournament}
                    onClose={() => setViewResultTournament(null)}
                    tournament={viewResultTournament}
                />
            )}
        </div>
    );
};

export default Dashboard;
