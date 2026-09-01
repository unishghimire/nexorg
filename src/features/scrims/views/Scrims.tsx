import Seo from '../../../shared/components/Seo';
import Faq from '../../../shared/components/Faq';
import React, { useEffect, useState, useCallback } from 'react';
import { Scrim } from '../../../shared/types/types';
import { Trophy, Search, Filter, Calendar, Gamepad2, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { formatCurrency, formatDate, formatGameName } from '../../../shared/utils/utils';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../shared/config/firebase';
import TabErrorBoundary from '../../../shared/components/TabErrorBoundary';

const scrimFaqs = [
    {
        question: 'What are esports scrims?',
        answer: 'Scrims (scrimmages) are practice matches where teams compete in a competitive but non-tournament setting to improve their skills.',
    },
    {
        question: 'How do I join a scrim in Nepal?',
        answer: 'Browse available scrims on NexPlay Scrims page, find one for your game, and register your team. Most scrims are free to join.',
    },
    {
        question: 'What is the difference between scrims and tournaments?',
        answer: 'Tournaments are formal competitions with prizes and rankings. Scrims are practice matches focused on skill development without the pressure of a tournament bracket.',
    },
];

type ScrimRecord = Scrim & {
    currentPlayers?: number;
    isScrim?: boolean;
    totalSlots?: number;
};

const ACTIVE_SCRIM_STATUSES = new Set(['open', 'upcoming', 'published', 'live']);

const toScrimRecord = (id: string, data: Record<string, unknown>): ScrimRecord => ({
    id,
    ...data,
} as ScrimRecord);

const uniqueScrims = (scrims: ScrimRecord[]) =>
    Array.from(new Map(scrims.map(scrim => [scrim.id, scrim])).values());

const ScrimsContent: React.FC = () => {
    const [scrims, setScrims] = useState<ScrimRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchParams] = useSearchParams();
    const [filterGame, setFilterGame] = useState(searchParams.get('game') || 'All');
    const [filterMode, setFilterMode] = useState(searchParams.get('mode') || 'All');
    const navigate = useNavigate();

    useEffect(() => {
        const game = searchParams.get('game');
        if (game && game !== filterGame) setFilterGame(game);
        const mode = searchParams.get('mode');
        if (mode && mode !== filterMode) setFilterMode(mode);
    }, [searchParams]);

    const fetchScrims = useCallback(async () => {
        setLoading(true);
        setFetchError(null);
        // Scrims are public tournament records. Query their discriminating field directly
        // instead of scanning every published tournament, which avoids unbounded reads and
        // keeps this public page independent of privileged server credentials.
        // Sources are tried in order — the primary source (tournaments/matchType == 'scrims')
        // is authoritative; the legacy scans only run if it fails, so we never duplicate reads.
        let successfulSources = 0;
        let list: ScrimRecord[] = [];

        // Primary source: tournaments collection. Only reads the discriminating field.
        try {
            const primary = await getDocs(query(collection(db, 'tournaments'), where('matchType', '==', 'scrims')));
            successfulSources += 1;
            list.push(...primary.docs.map(docSnap => toScrimRecord(docSnap.id, docSnap.data())));
        } catch (err) {
            console.warn('Primary scrim source failed:', err);
        }

        // Legacy/flagged records only when the primary source returned nothing.
        if (list.length === 0) {
            try {
                const flagged = await getDocs(query(collection(db, 'tournaments'), where('isScrim', '==', true)));
                successfulSources += 1;
                list.push(...flagged.docs.map(docSnap => toScrimRecord(docSnap.id, docSnap.data())));
            } catch (err) {
                console.warn('Legacy flagged-scrim source failed:', err);
            }
        }
        if (list.length === 0) {
            try {
                const legacy = await getDocs(query(collection(db, 'scrims'), where('status', 'in', ['open', 'live'])));
                successfulSources += 1;
                list.push(...legacy.docs.map(docSnap => toScrimRecord(docSnap.id, docSnap.data())));
            } catch (err) {
                console.warn('Legacy scrims source failed:', err);
            }
        }

        list = uniqueScrims(list.filter(scrim => ACTIVE_SCRIM_STATUSES.has(scrim.status)));

        // Retain the API as a compatibility fallback only when both Firestore sources fail.
        if (successfulSources === 0) {
            try {
                const response = await fetch('/api/scrims');
                const result = await response.json().catch(() => null);
                if (!response.ok || !result?.success || !Array.isArray(result.scrims)) {
                    throw new Error(result?.message || `Scrims request failed (${response.status})`);
                }
                successfulSources += 1;
                list = uniqueScrims(result.scrims as ScrimRecord[]);
            } catch (apiErr) {
                console.warn('API scrim query fallback failed:', apiErr);
            }
        }

        if (successfulSources === 0) {
            setFetchError('Scrims could not be loaded. Check your connection and try again.');
            setScrims([]);
        } else {
            setScrims(list);
        }
        setLoading(false);
    }, []);

    const [dbGames, setDbGames] = useState<string[]>([]);

    useEffect(() => {
        const fetchDbGames = async () => {
            try {
                const snap = await getDocs(query(collection(db, 'games'), where('isPublished', '==', true)));
                const names = snap.docs.map(d => d.data().name).filter(Boolean);
                setDbGames(names);
            } catch (err) {
                console.warn('Could not fetch published games for scrims filter:', err);
            }
        };
        fetchDbGames();
    }, []);

    // Extract dynamic unique games list strictly from database games + active scrims
    const availableGames = React.useMemo(() => {
        const fromScrims = scrims.map(s => s.game).filter(Boolean);
        const combined = Array.from(new Set([...dbGames, ...fromScrims]));
        return combined.length > 0 ? ['All', ...combined] : ['All'];
    }, [dbGames, scrims]);

    const normalizeGameStr = (g?: string) => {
        if (!g) return '';
        const lower = g.trim().toLowerCase();
        if (lower === 'mlbb' || lower === 'mobile legends') return 'mlbb';
        if (lower === 'pubg' || lower === 'pubg mobile') return 'pubg';
        return lower;
    };

    const filteredScrims = scrims.filter(s => {
        const titleMatch = s.title ? s.title.toLowerCase().includes(searchTerm.toLowerCase()) : false;
        const gameMatch = s.game ? s.game.toLowerCase().includes(searchTerm.toLowerCase()) : false;
        const matchesSearch = !searchTerm || titleMatch || gameMatch;

        const matchesGame = filterGame === 'All' || 
            normalizeGameStr(s.game) === normalizeGameStr(filterGame) ||
            s.game === filterGame;

        const matchesMode = filterMode === 'All' || s.type === filterMode || s.type?.toLowerCase() === filterMode.toLowerCase() || (s as any).mode === filterMode || (s as any).mode?.toLowerCase() === filterMode.toLowerCase();
        return matchesSearch && matchesGame && matchesMode;
    });

    return (
        <>
            <Seo
                title="Esports Scrims in Nepal | NexPlay"
                description="Find and join esports scrims in Nepal. Practice matches for PUBG Mobile, Free Fire, Valorant and more on NexPlay. Free daily scrims with instant matchmaking."
                canonicalPath="/scrims"
                jsonLd={{
                    "@context": "https://schema.org",
                    "@type": "FAQPage",
                    mainEntity: [
                        {
                            "@type": "Question",
                            name: "What are esports scrims?",
                            acceptedAnswer: {
                                "@type": "Answer",
                                text: "Scrims are practice matches where teams compete against each other to improve skills without the pressure of a tournament. NexPlay hosts daily scrims for popular esports titles in Nepal."
                            }
                        },
                        {
                            "@type": "Question",
                            name: "Are NexPlay scrims free?",
                            acceptedAnswer: {
                                "@type": "Answer",
                                text: "Yes, NexPlay offers free daily scrims. Simply join a scrim room, connect with your team, and start practicing."
                            }
                        },
                        {
                            "@type": "Question",
                            name: "How do I join a scrim on NexPlay?",
                            acceptedAnswer: {
                                "@type": "Answer",
                                text: "Browse the scrims page, find an open scrim matching your game and skill level, and click Join. You may need a registered team for squad-based scrims."
                            }
                        }
                    ]
                }}
            />
            <div className="animate-fade-in max-w-5xl mx-auto p-4 md:p-8">
                <header className="mb-12 border-b border-gray-800 pb-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-6">
                        <div>
                            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white uppercase tracking-tighter leading-none mb-2">Daily Scrims</h1>
                            <p className="text-gray-400 font-bold max-w-lg">
                                Practice like a pro. Join high-tier scrims and test your team strategy.
                            </p>
                        </div>
                        <div className="flex items-center gap-3 bg-card/50 px-6 py-3 rounded-2xl border border-gray-800">
                            <Trophy className="w-5 h-5 text-yellow-500" />
                            <span className="text-white font-black tracking-widest uppercase text-sm">1,420 ELO</span>
                        </div>
                    </div>
                </header>

                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-12 bg-card/50 p-4 sm:p-8 rounded-2xl sm:rounded-3xl border border-gray-800">
                    <div className="md:col-span-8 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <input 
                            type="text" 
                            aria-label="Search scrims"
                            placeholder="Search by title or game..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-black border border-gray-800 rounded-2xl py-4 pl-12 pr-6 text-white focus:border-brand-500 focus-visible:outline-none transition-colors shadow-xl font-bold"
                        />
                    </div>
                    <div className="md:col-span-4 relative">
                        <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <select 
                            aria-label="Filter scrims by game"
                            value={filterGame}
                            onChange={(e) => setFilterGame(e.target.value)}
                            className="w-full bg-black border border-gray-800 rounded-2xl py-4 pl-12 pr-6 text-white focus:border-brand-500 focus-visible:outline-none transition-colors shadow-xl font-bold appearance-none"
                        >
                            {availableGames.map(game => (
                                <option key={game} value={game}>
                                    {game === 'All' ? 'All Games' : game}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                        {[1,2,3,4,5,6].map(i => (
                            <div key={i} className="bg-card/50 h-[400px] rounded-3xl animate-pulse border border-gray-800"></div>
                        ))}
                    </div>
                ) : fetchError ? (
                    <div role="alert" className="bg-card/50 p-6 sm:p-12 rounded-3xl border border-red-500/30 text-center">
                        <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-6" />
                        <h3 className="text-2xl font-black text-white uppercase mb-2">Unable to Load Scrims</h3>
                        <p className="text-gray-400 font-bold max-w-sm mx-auto mb-8">{fetchError}</p>
                        <button
                            onClick={fetchScrims}
                            className="min-h-[44px] inline-flex items-center px-6 py-2.5 bg-brand-500 hover:bg-brand-400 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-colors cursor-pointer"
                        >
                            Try Again
                        </button>
                    </div>
                ) : filteredScrims.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                        {filteredScrims.map((scrim) => {
                            const rawSlots = scrim.slots as unknown;
                            const totalSlots = typeof rawSlots === 'number'
                                ? rawSlots
                                : Array.isArray(rawSlots)
                                    ? rawSlots.length
                                    : scrim.totalSlots || 20;
                            const currentSlots = scrim.currentSlots
                                ?? scrim.filledSlots
                                ?? scrim.currentPlayers
                                ?? (Array.isArray(rawSlots) ? rawSlots.filter(slot => slot?.status === 'filled').length : 0);
                            const slotPercentage = Math.min(100, Math.max(0, (currentSlots / Math.max(1, totalSlots)) * 100));

                            return (
                                <motion.div 
                                    key={scrim.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    onClick={() => {
                                        navigate(`/tournaments/${scrim.tournamentId || scrim.id}`);
                                    }}
                                    className="bg-card/50 rounded-[2rem] border border-gray-800 overflow-hidden cursor-pointer group hover:border-brand-500/50 transition-colors hover:bg-card flex flex-col justify-between"
                                >
                                    <div className="h-48 relative overflow-hidden">
                                        <img 
                                            src={scrim.bannerUrl || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80'} 
                                            alt={scrim.title || 'Scrim match'}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" loading="lazy"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/20 to-transparent"></div>
                                        <div className="absolute top-4 left-4 right-4 flex flex-wrap gap-2">
                                            <span className="bg-brand-500/10 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest text-brand-300 border border-brand-500/20">
                                                {formatGameName(scrim.game || 'Esports')}
                                            </span>
                                            <span className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest text-white border border-white/10">
                                                {scrim.type || 'BR'}
                                            </span>
                                        </div>
                                        <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                                            <div className="text-xs text-brand-400 font-black uppercase tracking-widest mb-1 flex items-center gap-1">
                                                <Calendar className="w-3 h-3" /> {formatDate(scrim.time || scrim.startTime || new Date().toISOString())}
                                            </div>
                                            <h3 className="text-lg font-black text-white uppercase tracking-tight line-clamp-1">{scrim.title || 'Official Scrim'}</h3>
                                        </div>
                                    </div>

                                    <div className="p-6 space-y-6 flex-grow flex flex-col justify-between">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                            <div className="bg-black p-3 rounded-2xl border border-gray-800">
                                                <div className="text-[10px] text-gray-500 uppercase font-black mb-1">Entry</div>
                                                <div className="text-white font-black">{!scrim.entryFee || scrim.entryFee === 0 ? 'FREE' : formatCurrency(scrim.entryFee)}</div>
                                            </div>
                                            <div className="bg-black p-3 rounded-2xl border border-gray-800">
                                                <div className="text-[10px] text-gray-500 uppercase font-black mb-1">Prize Pool</div>
                                                <div className="text-brand-400 font-black">{formatCurrency(scrim.prizePool || 0)}</div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-gray-500 font-black tracking-widest uppercase">{currentSlots} / {totalSlots} Joined</span>
                                            <div className="w-24 bg-black rounded-full h-1.5 overflow-hidden">
                                                <div 
                                                    className="bg-brand-500 h-full rounded-full transition-colors duration-300" 
                                                    style={{ width: `${slotPercentage}%` }}
                                                ></div>
                                            </div>
                                        </div>

                                        <button type="button" className="w-full min-h-[44px] bg-brand-500/10 group-hover:bg-brand-500 text-brand-300 group-hover:text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors border border-brand-500/20 group-hover:border-brand-500 cursor-pointer">
                                            Join Scrim
                                        </button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="bg-card/50 p-6 sm:p-12 rounded-3xl border border-gray-800 text-center">
                        <Gamepad2 className="w-16 h-16 text-gray-700 mx-auto mb-6" />
                        <h3 className="text-2xl font-black text-white uppercase mb-2">No Scrims Available</h3>
                        <p className="text-gray-500 font-bold max-w-sm mx-auto mb-8">
                            There are no active scrims matching your selection right now. Check back later or clear your filters.
                        </p>
                        <div className="flex justify-center gap-4">
                            <button type="button" 
                                onClick={() => { setFilterGame('All'); setFilterMode('All'); setSearchTerm(''); }}
                                className="min-h-[44px] inline-flex items-center px-6 py-2.5 bg-brand-500 hover:bg-brand-400 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-colors cursor-pointer"
                            >
                                Clear Filters
                            </button>
                        </div>
                    </div>
                )}
                <Faq items={scrimFaqs} />
            </div>
        </>
    );
};

const Scrims: React.FC = () => (
    <TabErrorBoundary tabName="Scrims">
        <ScrimsContent />
    </TabErrorBoundary>
);

export default Scrims;
