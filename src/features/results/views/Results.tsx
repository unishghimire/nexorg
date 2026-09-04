import Seo from '../../../shared/components/Seo';
import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, getDocs, limit, where, orderBy } from 'firebase/firestore';
import { db } from '../../../shared/config/firebase';
import { Tournament } from '../../../shared/types/types';
import { Trophy, Calendar, Gamepad2, ChevronRight, Search, Users, ShieldCheck, Flame } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { formatCurrency, formatDate, formatGameName } from '../../../shared/utils/utils';
import TournamentResultModal from '../../tournaments/components/TournamentResultModal';

const Results: React.FC = () => {
    const [results, setResults] = useState<Tournament[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState<'all' | 'tournaments' | 'scrims'>('all');
    const [selectedResult, setSelectedResult] = useState<Tournament | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchResults = async () => {
            setLoading(true);
            try {
                // Query completed tournaments
                const tourneysPromise = getDocs(query(
                    collection(db, 'tournaments'),
                    where('status', '==', 'completed'),
                    orderBy('startTime', 'desc'),
                    limit(50)
                )).catch((e) => {
                    console.warn('Completed tournaments fetch fallback:', e);
                    return null;
                });

                // Query completed scrims
                const scrimsPromise = getDocs(query(
                    collection(db, 'scrims'),
                    where('status', '==', 'completed'),
                    limit(50)
                )).catch((e) => {
                    console.warn('Completed scrims fetch fallback:', e);
                    return null;
                });

                const [tourneysSnap, scrimsSnap] = await Promise.all([tourneysPromise, scrimsPromise]);

                const combinedMap = new Map<string, Tournament>();

                if (tourneysSnap) {
                    tourneysSnap.docs.forEach(docSnap => {
                        combinedMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as Tournament);
                    });
                }

                if (scrimsSnap) {
                    scrimsSnap.docs.forEach(docSnap => {
                        const data = docSnap.data();
                        combinedMap.set(docSnap.id, {
                            id: docSnap.id,
                            matchType: 'scrims',
                            isScrim: true,
                            ...data
                        } as any);
                    });
                }

                const resultsData = Array.from(combinedMap.values()).sort((a, b) => {
                    const timeA = (a.startTime as any)?.seconds || (a as any).completedAt?.seconds || 0;
                    const timeB = (b.startTime as any)?.seconds || (b as any).completedAt?.seconds || 0;
                    return timeB - timeA;
                });

                setResults(resultsData);
            } catch (error) {
                console.error("Error fetching results:", error);
                setFetchError("Failed to load results. Please check your connection.");
            } finally {
                setLoading(false);
            }
        };

        fetchResults();
    }, []);

    const isScrimEvent = (t: any) => {
        return t.matchType === 'scrims' || t.isScrim === true || t.type === 'scrim' || t.type === 'scrims';
    };

    const categoryResults = useMemo(() => {
        if (filterCategory === 'tournaments') {
            return results.filter(r => !isScrimEvent(r));
        }
        if (filterCategory === 'scrims') {
            return results.filter(r => isScrimEvent(r));
        }
        return results;
    }, [results, filterCategory]);

    const filteredResults = useMemo(() => {
        return categoryResults.filter(r => 
            (r.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
            (r.game || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [categoryResults, searchTerm]);

    const featuredResult = filteredResults[0] || results[0];
    const featuredChampion = (featuredResult?.winners?.[0] as any)?.teamName ||
        featuredResult?.winners?.[0]?.username ||
        featuredResult?.manualResults?.[0]?.team ||
        'Champion Finalized';

    const featuredSummary = featuredResult?.winners?.length
        ? `${featuredResult.winners.length} winners rewarded on the podium`
        : featuredResult?.manualResults?.length
            ? `${featuredResult.manualResults.length} registered entries finalized`
            : 'Official results published';

    const featuredBanner = featuredResult?.bannerUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${featuredResult?.title || 'nexplay-results'}`;
    const resultsCount = filteredResults.length;
    const totalPrizePool = filteredResults.reduce((sum, tournament) => sum + (Number(tournament.prizePool) || 0), 0);

    if (loading) {
        return (
        <>
            <Seo
                title="Tournament & Scrim Results | NexPlay — Esports Nepal"
                description="View completed esports tournament and scrim results, winners, and leaderboards on NexPlay."
                canonicalPath="/results" noindex
            />
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-brand-500 text-xs font-black uppercase tracking-widest animate-pulse">Fetching Match Leaderboards...</p>
            </div>
        </>
        );
    }

    if (fetchError) {
        return (
        <>
            <Seo
                title="Tournament & Scrim Results | NexPlay — Esports Nepal"
                description="View completed esports tournament and scrim results, winners, and leaderboards on NexPlay."
                canonicalPath="/results" noindex
            />
            <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl max-w-md text-center">
                    <p className="text-red-400 text-sm font-bold mb-4">{fetchError}</p>
                    <button type="button" onClick={() => window.location.reload()} className="text-xs font-black uppercase tracking-widest text-red-400 hover:text-red-300 border border-red-500/30 rounded-lg px-4 py-2.5">Retry</button>
                </div>
            </div>
        </>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-10 pb-20">
            {/* Hero Section */}
            <div className="relative overflow-hidden rounded-2xl sm:rounded-[2rem] border border-gray-800 bg-surface shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
                <div className="absolute inset-0">
                    <img src={featuredBanner} alt="Featured tournament banner" className="h-full w-full object-cover opacity-30" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-r from-gray-950 via-gray-950/90 to-gray-950/40" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(250,204,21,0.15),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(96,165,250,0.12),transparent_32%)]" />
                </div>

                <div className="relative grid gap-4 sm:gap-8 px-4 py-6 sm:px-6 sm:py-8 md:grid-cols-[1.3fr_0.7fr] md:px-10 md:py-10">
                    <div className="space-y-6">
                        <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.35em] text-brand-200">
                            <Trophy className="h-4 w-4" /> Official Results Hub
                        </div>
                        <div>
                            <h1 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter leading-none mb-4">
                                Match <span className="text-brand-500">Results</span>
                            </h1>
                            <p className="text-gray-300 font-medium max-w-2xl text-base md:text-lg leading-7">
                                Explore the history of champions, verified leaderboards, and complete participant standings for all tournaments and scrims.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <div className="rounded-2xl border border-gray-800 bg-black/30 px-4 py-3">
                                <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Latest Champion</div>
                                <div className="mt-1 text-lg font-black text-white truncate max-w-[200px]">{featuredChampion}</div>
                            </div>
                            <div className="rounded-2xl border border-gray-800 bg-black/30 px-4 py-3">
                                <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Published Results</div>
                                <div className="mt-1 text-lg font-black text-white">{resultsCount}</div>
                            </div>
                            <div className="rounded-2xl border border-gray-800 bg-black/30 px-4 py-3">
                                <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Total Prize Awarded</div>
                                <div className="mt-1 text-lg font-black text-emerald-400">{formatCurrency(totalPrizePool, 'Rs. ')}</div>
                            </div>
                        </div>
                    </div>

                    <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-black/40 p-4 shadow-2xl">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/0 via-white/0 to-brand-500/10" />
                        <div className="relative flex h-full flex-col justify-between gap-4">
                            <div className="overflow-hidden rounded-2xl border border-white/10 bg-dark/80">
                                <img src={featuredBanner} alt={featuredResult?.title || 'Featured event'} className="h-52 w-full object-cover" loading="lazy" />
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="text-[10px] font-black uppercase tracking-[0.35em] text-gray-500">Featured Event</p>
                                        {featuredResult && isScrimEvent(featuredResult) ? (
                                            <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-brand-500/20 text-brand-400 uppercase tracking-widest">
                                                Scrim
                                            </span>
                                        ) : (
                                            <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 uppercase tracking-widest">
                                                Tournament
                                            </span>
                                        )}
                                    </div>
                                    <h2 className="mt-2 text-2xl font-black uppercase tracking-tight text-white line-clamp-1">
                                        {featuredResult?.title || 'No completed events yet'}
                                    </h2>
                                    <p className="mt-1 text-sm font-bold text-brand-400 uppercase tracking-widest flex items-center gap-2">
                                        <Gamepad2 className="h-4 w-4" /> {featuredResult ? formatGameName(featuredResult.game) : 'Awaiting data'}
                                    </p>
                                </div>
                                <p className="text-sm text-gray-300 leading-6">{featuredSummary}</p>
                                <div className="flex items-center justify-between gap-4 rounded-2xl border border-gray-800 bg-black/25 px-4 py-3">
                                    <div>
                                        <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Completed</div>
                                        <div className="mt-1 text-sm font-bold text-white">{featuredResult ? formatDate(featuredResult.startTime || (featuredResult as any).completedAt) : 'N/A'}</div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => featuredResult && setSelectedResult(featuredResult)}
                                        disabled={!featuredResult}
                                        className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-3 text-xs font-black uppercase tracking-[0.25em] text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        View Results <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter Tabs & Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                {/* Category Filters: All, Tournaments, Scrims */}
                <div className="flex items-center p-1 bg-surface rounded-xl border border-gray-800 w-full sm:w-auto">
                    {[
                        { id: 'all', label: 'All Results' },
                        { id: 'tournaments', label: 'Tournaments' },
                        { id: 'scrims', label: 'Scrims' },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setFilterCategory(tab.id as any)}
                            className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                                filterCategory === tab.id
                                    ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Search Bar */}
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input 
                        type="text" 
                        aria-label="Search results"
                        placeholder="Search tournament or game..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-surface border border-gray-800 rounded-xl py-3 pl-11 pr-4 text-sm text-white focus:border-brand-500 focus-visible:outline-none transition-colors shadow-lg font-bold placeholder-gray-500"
                    />
                </div>
            </div>

            {/* Results Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
                {filteredResults.length > 0 ? (
                    filteredResults.map(t => {
                        const isScrim = isScrimEvent(t);
                        const champName = (t.winners?.[0] as any)?.teamName || t.winners?.[0]?.username || t.manualResults?.[0]?.team || 'Winner Finalized';

                        return (
                            <div
                                key={t.id} 
                                onClick={() => setSelectedResult(t)}
                                className="bg-surface rounded-3xl border border-gray-800 hover:border-brand-500/40 transition-colors cursor-pointer group overflow-hidden block"
                            >
                                <div className="flex flex-col sm:flex-row h-full">
                                    <div className="sm:w-48 h-48 sm:h-auto shrink-0 bg-dark overflow-hidden relative">
                                        <img src={t.bannerUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${t.title}`} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" loading="lazy" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 to-transparent"></div>
                                        <div className="absolute bottom-4 left-4 flex flex-col gap-1.5">
                                            <div className="flex items-center gap-1.5 bg-brand-500 px-3 py-1 rounded-full border border-brand-400/30">
                                                <Trophy className="w-3 h-3 text-white" />
                                                <span className="text-[10px] font-black text-white uppercase tracking-widest leading-none">Result</span>
                                            </div>
                                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                isScrim ? 'bg-amber-500/30 text-amber-300 border border-amber-500/40' : 'bg-indigo-500/30 text-indigo-300 border border-indigo-500/40'
                                            }`}>
                                                {isScrim ? 'Scrim Match' : 'Tournament'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="p-5 sm:p-7 flex-1 flex flex-col justify-between">
                                        <div>
                                            <div className="flex justify-between items-start mb-4 gap-2">
                                                <div className="min-w-0">
                                                    <h4 className="text-white font-black text-xl uppercase tracking-tight line-clamp-1">{t.title}</h4>
                                                    <p className="text-xs text-brand-500 font-black uppercase tracking-widest flex items-center gap-2 mt-0.5">
                                                        <Gamepad2 className="w-4 h-4" /> {formatGameName(t.game)}
                                                    </p>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-0.5">Prize pool</p>
                                                    <p className="text-base font-black text-brand-400">{(t.prizePool || 0).toLocaleString()} {t.currency || 'Rs.'}</p>
                                                </div>
                                            </div>

                                            {/* Champion Card */}
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-3 bg-dark/60 p-3 rounded-2xl border border-gray-800 group-hover:border-gray-700 transition-colors">
                                                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30 shrink-0">
                                                        <Trophy className="w-4 h-4 text-yellow-400" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-wider">
                                                            {isScrim ? 'Match Winner' : 'Champion'}
                                                        </p>
                                                        <p className="text-sm font-black text-white truncate">{champName}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-6 flex items-center justify-between pt-4 border-t border-gray-800/60">
                                            <div className="flex items-center gap-2 text-[10px] text-gray-400 font-black uppercase tracking-widest">
                                                <Calendar className="w-3.5 h-3.5 text-gray-500" /> {formatDate(t.startTime || (t as any).completedAt)}
                                            </div>
                                            <span className="text-brand-500 group-hover:text-white transition-colors flex items-center gap-1.5 text-xs font-black uppercase tracking-widest">
                                                View Scoreboard <ChevronRight className="w-4 h-4" />
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="col-span-2 py-24 text-center bg-card/30 rounded-[3rem] border border-dashed border-gray-800">
                        <Trophy className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                        <h3 className="text-xl font-black text-white uppercase mb-1">No Results Found</h3>
                        <p className="text-gray-500 font-bold text-sm max-w-sm mx-auto">
                            We couldn't find any completed events matching your search criteria.
                        </p>
                    </div>
                )}
            </div>

            {/* Complete Results Modal: Shows all registered teams & players */}
            {selectedResult && (
                <TournamentResultModal
                    isOpen={Boolean(selectedResult)}
                    onClose={() => setSelectedResult(null)}
                    tournament={selectedResult}
                />
            )}
        </div>
    );
};

export default Results;
