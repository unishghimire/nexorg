import Seo from '../../../shared/components/Seo';
import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, limit, where, orderBy } from 'firebase/firestore';
import { db } from '../../../shared/config/firebase';
import { Tournament } from '../../../shared/types/types';
import { Trophy, Calendar, Gamepad2, ChevronRight, Search } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { formatCurrency, formatDate, formatGameName } from '../../../shared/utils/utils';

const Results: React.FC = () => {
    const [results, setResults] = useState<Tournament[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const fetchResults = async () => {
            setLoading(true);
            try {
                const resultsSnap = await getDocs(query(
                    collection(db, 'tournaments'),
                    where('status', '==', 'completed'),
                    orderBy('startTime', 'desc'),
                    limit(50)
                ));

                const resultsData = resultsSnap.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as Tournament))
                    .filter(t => (t as any).matchType !== 'scrims' && (t as any).isScrim !== true && (t as any).type !== 'scrim' && (t as any).type !== 'scrims')
                    .slice(0, 50);

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

    const filteredResults = results.filter(r => 
        (r.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (r.game || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const featuredResult = filteredResults[0] || results[0];
    const featuredChampion = featuredResult?.winners?.[0]?.username || featuredResult?.manualResults?.[0]?.team || 'Champion TBA';
    const featuredSummary = featuredResult?.winners?.length
        ? `${featuredResult.winners.length} winners on the podium`
        : featuredResult?.manualResults?.length
            ? `${featuredResult.manualResults.length} ranked entries published`
            : 'Official results pending';
    const featuredBanner = featuredResult?.bannerUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${featuredResult?.title || 'nexplay-results'}`;
    const resultsCount = filteredResults.length;
    const totalPrizePool = filteredResults.reduce((sum, tournament) => sum + (Number(tournament.prizePool) || 0), 0);

    if (loading) {
        return (
        <>
        <Seo
            title="Tournament Results | NexPlay — Esports Nepal"
            description="View completed esports tournament results, winners, and leaderboards on NexPlay."
            canonicalPath="/results" noindex
            jsonLd={{
                "@context": "https://schema.org",
                "@type": "ItemList",
                "name": "Esports Tournament Results in Nepal",
                "description": "View completed esports tournament results, winners, and leaderboards on NexPlay.",
                "url": `https://www.nexplayorg.app/results`
            }}
        />
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-brand-500 text-xs font-black uppercase tracking-widest animate-pulse">Fetching Hall of Fame...</p>
            </div>
        </>
        );
    }

    if (fetchError) {
        return (
        <>
        <Seo
            title="Tournament Results | NexPlay — Esports Nepal"
            description="View completed esports tournament results, winners, and leaderboards on NexPlay."
            canonicalPath="/results" noindex
            jsonLd={{
                "@context": "https://schema.org",
                "@type": "ItemList",
                "name": "Esports Tournament Results in Nepal",
                "description": "View completed esports tournament results, winners, and leaderboards on NexPlay.",
                "url": `https://www.nexplayorg.app/results`
            }}
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
        <div className="max-w-7xl mx-auto space-y-12 pb-20">
            <div className="relative overflow-hidden rounded-2xl sm:rounded-[2rem] border border-gray-800 bg-surface shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
                <div className="absolute inset-0">
                    <img src={featuredBanner} alt="Featured tournament banner" className="h-full w-full object-cover opacity-30" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-r from-gray-950 via-gray-950/90 to-gray-950/40" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(250,204,21,0.15),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(96,165,250,0.12),transparent_32%)]" />
                </div>

                <div className="relative grid gap-4 sm:gap-8 px-4 py-6 sm:px-6 sm:py-8 md:grid-cols-[1.3fr_0.7fr] md:px-10 md:py-10">
                    <div className="space-y-6">
                        <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.35em] text-brand-200">
                            <Trophy className="h-4 w-4" /> Public Results
                        </div>
                        <div>
                            <h1 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter leading-none mb-4">
                                Tournament <span className="text-brand-500">Results</span>
                            </h1>
                            <p className="text-gray-300 font-medium max-w-2xl text-base md:text-lg leading-7">
                                Witness the legends. Explore the history of champions and their path to victory on Nexplay.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <div className="rounded-2xl border border-gray-800 bg-black/30 px-4 py-3">
                                <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Featured Champion</div>
                                <div className="mt-1 text-lg font-black text-white">{featuredChampion}</div>
                            </div>
                            <div className="rounded-2xl border border-gray-800 bg-black/30 px-4 py-3">
                                <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Published Results</div>
                                <div className="mt-1 text-lg font-black text-white">{resultsCount}</div>
                            </div>
                            <div className="rounded-2xl border border-gray-800 bg-black/30 px-4 py-3">
                                <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Prize Pool</div>
                                <div className="mt-1 text-lg font-black text-white">{formatCurrency(totalPrizePool, 'Rs. ')}</div>
                            </div>
                        </div>
                    </div>

                    <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-black/40 p-4 shadow-2xl">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/0 via-white/0 to-brand-500/10" />
                        <div className="relative flex h-full flex-col justify-between gap-4">
                            <div className="overflow-hidden rounded-2xl border border-white/10 bg-dark/80">
                                <img src={featuredBanner} alt={featuredResult?.title || 'Featured tournament'} className="h-52 w-full object-cover" loading="lazy" />
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.35em] text-gray-500">Featured Event</p>
                                    <h2 className="mt-2 text-2xl font-black uppercase tracking-tight text-white line-clamp-1">
                                        {featuredResult?.title || 'No completed tournament yet'}
                                    </h2>
                                    <p className="mt-1 text-sm font-bold text-brand-400 uppercase tracking-widest flex items-center gap-2">
                                        <Gamepad2 className="h-4 w-4" /> {featuredResult ? formatGameName(featuredResult.game) : 'Awaiting data'}
                                    </p>
                                </div>
                                <p className="text-sm text-gray-300 leading-6">{featuredSummary}</p>
                                <div className="flex items-center justify-between gap-4 rounded-2xl border border-gray-800 bg-black/25 px-4 py-3">
                                    <div>
                                        <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Completed</div>
                                        <div className="mt-1 text-sm font-bold text-white">{featuredResult ? formatDate(featuredResult.startTime) : 'N/A'}</div>
                                    </div>
                                    <button
                                        onClick={() => featuredResult && navigate(`/tournaments/${featuredResult.id}`)}
                                        disabled={!featuredResult}
                                        className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-3 text-xs font-black uppercase tracking-[0.25em] text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        View Details <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input 
                    type="text" 
                    aria-label="Search tournament results"
                    placeholder="Search by tournament name or game..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-surface border border-gray-800 rounded-2xl py-4 pl-12 pr-6 text-white focus:border-brand-500 focus-visible:outline-none transition-colors shadow-xl font-bold"
                />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
                {filteredResults.length > 0 ? (
                    filteredResults.map(t => (
                        <Link
                            key={t.id} 
                            to={`/tournaments/${t.id}`}
                            className="bg-surface rounded-3xl border border-gray-800 hover:border-brand-500/30 transition-colors cursor-pointer group overflow-hidden block"
                        >
                            <div className="flex flex-col sm:flex-row h-full">
                                <div className="sm:w-48 h-48 sm:h-auto shrink-0 bg-dark overflow-hidden relative">
                                    <img src={t.bannerUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${t.title}`} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" loading="lazy" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-gray-950 to-transparent"></div>
                                    <div className="absolute bottom-4 left-4">
                                        <div className="flex items-center gap-1.5 bg-brand-500 px-3 py-1 rounded-full border border-brand-400/30">
                                            <Trophy className="w-3 h-3 text-white" />
                                            <span className="text-[10px] font-black text-white uppercase uppercase tracking-widest leading-none">Result</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-5 sm:p-8 flex-1 flex flex-col justify-between">
                                    <div>
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h4 className="text-white font-black text-2xl uppercase tracking-tight line-clamp-1">{t.title}</h4>
                                                <p className="text-xs text-brand-500 font-black uppercase tracking-widest flex items-center gap-2">
                                                    <Gamepad2 className="w-4 h-4" /> {formatGameName(t.game)}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Prize pool</p>
                                                <p className="text-lg font-black text-brand-500">{(t.prizePool).toLocaleString()} {t.currency || 'Rs.'}</p>
                                            </div>
                                        </div>

                                        {t.winners && t.winners.length > 0 ? (
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-4 bg-dark/50 p-3 rounded-2xl border border-gray-800">
                                                    <div className="w-10 h-10 rounded-xl bg-brand-500/20 flex items-center justify-center border border-brand-500/30">
                                                        <Trophy className="w-5 h-5 text-yellow-500" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] text-gray-500 font-black uppercase">Champion</p>
                                                        <p className="text-sm font-black text-white">{t.winners[0].username}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : t.manualResults && t.manualResults.length > 0 ? (
                                            <div className="space-y-2">
                                                {t.manualResults.slice(0, 3).map((r, ri) => (
                                                    <div key={ri} className="flex items-center gap-3 bg-dark/50 p-3 rounded-2xl border border-gray-800">
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm shrink-0 ${ri === 0 ? 'bg-yellow-500/20 text-yellow-400' : ri === 1 ? 'bg-gray-400/10 text-gray-300' : 'bg-amber-800/20 text-amber-600'}`}>
                                                            {r.rank}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-black text-white truncate">{r.team}</p>
                                                            <p className="text-[10px] text-gray-500 font-bold">{r.score} pts</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-gray-600 text-sm font-bold italic">Results pending official announcement.</p>
                                        )}
                                    </div>

                                    <div className="mt-8 flex items-center justify-between pt-6 border-t border-gray-800/50">
                                        <div className="flex items-center gap-2 text-[10px] text-gray-500 font-black uppercase tracking-widest">
                                            <Calendar className="w-4 h-4" /> {formatDate(t.startTime)}
                                        </div>
                                        <span className="text-brand-500 group-hover:text-white transition-colors flex items-center gap-2 text-xs font-black uppercase tracking-widest">
                                            Details <ChevronRight className="w-4 h-4" />
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))
                ) : (
                    <div className="col-span-2 py-32 text-center bg-card/30 rounded-[3rem] border border-dashed border-gray-800">
                        <Trophy className="w-20 h-20 text-gray-800 mx-auto mb-6" />
                        <h3 className="text-2xl font-black text-white uppercase mb-2">No Results Found</h3>
                        <p className="text-gray-500 font-bold max-w-sm mx-auto">
                            We couldn't find any completed tournaments matching your criteria.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Results;
