import Seo from '../../../shared/components/Seo';
import Faq from '../../../shared/components/Faq';
import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../../shared/config/firebase';
import { Tournament, Game, Slide } from '../../../shared/types/types';
import { PromoSlide } from '../components/HotPromotionsSlider';
import TournamentCard from '../../tournaments/components/TournamentCard';
import GameCard from '../components/GameCard';
import HotPromotionsSlider from '../components/HotPromotionsSlider';
import { useNavigate, Link } from 'react-router-dom';
import { 
    Star, 
    ChevronRight, 
    Gamepad2, 
    Wallet, 
    Trophy, 
    CheckCircle2, 
    Users, 
    Flame,
    BarChart3,
    Newspaper,
    Building2
} from 'lucide-react';
import { formatGameName } from '../../../shared/utils/utils';






const homeFaqs = [
    {
        question: 'What is NexPlay?',
        answer: 'NexPlay is a Nepal-focused esports tournament and scrim platform that allows players and teams to discover, register for, and participate in gaming competitions.',
    },
    {
        question: 'How do I join a NexPlay tournament?',
        answer: 'Create a free NexPlay account, browse available tournaments, and click Register on any tournament that fits your skill level and game.',
    },
    {
        question: 'What games does NexPlay support?',
        answer: 'NexPlay supports popular esports titles including PUBG Mobile, Free Fire, and Valorant. New games are added based on community demand.',
    },
    {
        question: 'Are NexPlay tournaments free to join?',
        answer: 'Many NexPlay tournaments are free to enter. Some premium tournaments may have an entry fee, which is clearly displayed on each tournament page.',
    },
    {
        question: 'How do NexPlay scrims work?',
        answer: 'Scrims are practice matches organized through NexPlay. Organizers create scrim events, and teams can register to participate in competitive practice sessions.',
    },
];


const Home: React.FC = () => {
    
    const [featuredTournaments, setFeaturedTournaments] = useState<Tournament[]>([]);
    const [popularGames, setPopularGames] = useState<Game[]>([]);
    const [slides, setSlides] = useState<Slide[]>([]);
    const [recentResults, setRecentResults] = useState<Tournament[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        // Track Page View

        const fetchData = async () => {
            
            // Fetch active slides
            try {
                const slidesSnap = await getDocs(query(
                    collection(db, 'slides'),
                    where('isActive', '==', true),
                    limit(10)
                ));
                let slidesData = slidesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Slide));
                slidesData.sort((a, b) => {
                    const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                    const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                    return bTime - aTime;
                });
                setSlides(slidesData.slice(0, 5));
            } catch (error) {
                console.warn("Could not fetch slides:", error);
            }

            // Fetch featured tournaments
            try {
                const tournamentsSnap = await getDocs(query(
                    collection(db, 'tournaments'),
                    where('isFeatured', '==', true),
                    limit(10)
                ));
                let tournamentsData = tournamentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tournament));
                tournamentsData = tournamentsData.filter(t => t.status === 'upcoming' && (t as any).matchType !== 'scrims' && (t as any).isScrim !== true && (t as any).type !== 'scrim' && (t as any).type !== 'scrims');
                setFeaturedTournaments(tournamentsData.slice(0, 6));
            } catch (error) {
                console.warn("Could not fetch tournaments:", error);
            }

            // Fetch popular games
            try {
                const gamesSnap = await getDocs(query(
                    collection(db, 'games'),
                    where('isPublished', '==', true),
                    limit(8)
                ));
                const gamesData = gamesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
                setPopularGames(gamesData);
            } catch (error) {
                console.warn("Could not fetch games:", error);
            }

            // Fetch recent results
            try {
                const resultsSnap = await getDocs(query(
                    collection(db, 'tournaments'),
                    where('status', '==', 'completed'),
                    orderBy('startTime', 'desc'),
                    limit(4)
                ));
                const resultsData = resultsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tournament));
                setRecentResults(resultsData);
            } catch (error) {
                console.warn("Could not fetch results:", error);
            }

            setLoading(false);
        };

        fetchData();
    }, []);

    const handleCtaClick = (destination: string, source: string) => {
        navigate(destination);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]" role="status">
                <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-brand-400 text-xs font-black uppercase tracking-widest animate-pulse">Establishing Uplink...</p>
            </div>
        );
    }

    return (
        <>
        <Seo
            title="NexPlay | Esports Tournaments & Scrims in Nepal"
            description="Join esports tournaments and scrims in Nepal on NexPlay. Register for PUBG Mobile, Free Fire, Valorant and more. Secure wallets, live brackets, and national rankings."
            canonicalPath="/"
            jsonLd={[{
                "@context": "https://schema.org",
                "@type": "Organization",
                name: "NexPlay",
                url: "https://www.nexplayorg.app",
                logo: "https://www.nexplayorg.app/nexplay-logo.png",
                description: "Nepal's premier esports tournament and scrim platform. Host and compete in PUBG Mobile, Free Fire, Valorant, and Mobile Legends tournaments with secure wallets, live brackets, and national rankings.",
                foundingDate: "2025",
                areaServed: {
                    "@type": "Country",
                    name: "Nepal",
                },
                sameAs: [
                    "https://www.facebook.com/nexplayorg",
                    "https://www.instagram.com/nexplayorg",
                    "https://twitter.com/nexplayorg",
                    "https://www.youtube.com/@nexplayorg",
                    "https://discord.gg/nexplay",
                ],
            }, {
                "@context": "https://schema.org",
                "@type": "WebSite",
                name: "NexPlay",
                url: "https://www.nexplayorg.app",
                potentialAction: {
                    "@type": "SearchAction",
                    target: {
                        "@type": "EntryPoint",
                        urlTemplate: "https://www.nexplayorg.app/tournaments?q={search_term_string}",
                    },
                    "query-input": "required name=search_term_string",
                },
            }, {
                "@context": "https://schema.org",
                "@type": "WebApplication",
                name: "NexPlay",
                url: "https://www.nexplayorg.app",
                applicationCategory: "GameApplication",
                operatingSystem: "Web Browser",
                description: "Nepal's premier esports tournament and scrim platform. Host and compete in PUBG Mobile, Free Fire, Valorant, and Mobile Legends tournaments with secure wallets, live brackets, and national rankings.",
                offers: {
                    "@type": "Offer",
                    price: "0",
                    priceCurrency: "NPR",
                    description: "Free to join. Premium tournaments may have entry fees.",
                },
                areaServed: {
                    "@type": "Country",
                    name: "Nepal",
                },
                featureList: [
                    "Esports tournament hosting and registration",
                    "Daily scrim matchmaking",
                    "Secure wallet-based entry with escrow",
                    "Real-time national leaderboard rankings",
                    "Team management and roster tracking",
                    "Admin-refereed tournament brackets",
                    "Match result tracking and history",
                ],
            }]}
        />
        <div className="animate-fade-in space-y-8 sm:space-y-12 md:space-y-16 pb-12 sm:pb-20 relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            {/* SEO: h1 for search engines — visually hidden */}
            <h1 className="sr-only">NexPlay — Esports Tournaments & Scrims in Nepal</h1>

            {/* Real-time Status and Security Badges Banner */}
            <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl sm:rounded-3xl p-5 sm:p-8 flex flex-col md:flex-row justify-between items-center gap-4 sm:gap-6 shadow-2xl">
                <div className="flex items-center gap-4">
                    <div className="bg-brand-500/10 p-3 rounded-2xl shrink-0">
                        <CheckCircle2 className="text-brand-400 w-7 h-7 sm:w-8 sm:h-8" />
                    </div>
                    <div>
                        <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-tight">Secure Matchmaking Active</h3>
                        <p className="text-xs sm:text-sm text-gray-400">All escrow entries and payouts are guarded server-side.</p>
                    </div>
                </div>
                <button
                    onClick={() => handleCtaClick('/wallet', 'InstantPayouts')}
                    className="flex items-center gap-2 bg-brand-500/10 hover:bg-brand-500/20 px-5 py-3 rounded-xl border border-brand-500/40 text-xs sm:text-sm text-brand-400 font-black uppercase tracking-widest transition-colors shrink-0 cursor-pointer"
                >
                    <Wallet className="w-4 h-4 sm:w-5 sm:h-5" /> Instant Payouts
                </button>
            </div>

            {/* Main Promotion Carousel Section */}
            {slides.length > 0 && (
                <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-gray-800">
                    <HotPromotionsSlider slides={slides} variant="hero" />
                </div>
            )}

            {/* Hot Promotions Section — only show when real promo data exists */}

            {/* Value Highlights (Conversion Funnel Indicators) */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                <div className="bg-card/50 p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl border border-gray-800 hover:border-brand-500/50 transition-colors duration-300 hover:-translate-y-1 group">
                    <div className="bg-brand-500/10 p-3 sm:p-4 rounded-xl sm:rounded-2xl text-brand-500 mb-4 sm:mb-6 inline-block group-hover:scale-110 transition-transform">
                        <Trophy className="w-6 h-6 sm:w-8 sm:h-8" />
                    </div>
                    <h4 className="text-white font-black uppercase text-sm sm:text-base md:text-lg mb-1 sm:mb-2">Tournaments</h4>
                    <p className="text-xs sm:text-sm text-gray-500">Compete in verified, admin-refereed ladders.</p>
                </div>
                <div className="bg-card/50 p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl border border-gray-800 hover:border-emerald-500/50 transition-colors duration-300 hover:-translate-y-1 group">
                    <div className="bg-emerald-500/10 p-3 sm:p-4 rounded-xl sm:rounded-2xl text-emerald-500 mb-4 sm:mb-6 inline-block group-hover:scale-110 transition-transform">
                        <Flame className="w-6 h-6 sm:w-8 sm:h-8" />
                    </div>
                    <h4 className="text-white font-black uppercase text-sm sm:text-base md:text-lg mb-1 sm:mb-2">Daily Scrims</h4>
                    <p className="text-xs sm:text-sm text-gray-500">Train with top competitive squads daily.</p>
                </div>
                <div className="bg-card/50 p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl border border-gray-800 hover:border-yellow-500/50 transition-colors duration-300 hover:-translate-y-1 group">
                    <div className="bg-yellow-500/10 p-3 sm:p-4 rounded-xl sm:rounded-2xl text-yellow-500 mb-4 sm:mb-6 inline-block group-hover:scale-110 transition-transform">
                        <Wallet className="w-6 h-6 sm:w-8 sm:h-8" />
                    </div>
                    <h4 className="text-white font-black uppercase text-sm sm:text-base md:text-lg mb-1 sm:mb-2">Secure Wallet</h4>
                    <p className="text-xs sm:text-sm text-gray-500">Double-guarded entry escrows and fast logs.</p>
                </div>
                <div className="bg-card/50 p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl border border-gray-800 hover:border-purple-500/50 transition-colors duration-300 hover:-translate-y-1 group">
                    <div className="bg-purple-500/10 p-3 sm:p-4 rounded-xl sm:rounded-2xl text-purple-500 mb-4 sm:mb-6 inline-block group-hover:scale-110 transition-transform">
                        <Users className="w-6 h-6 sm:w-8 sm:h-8" />
                    </div>
                    <h4 className="text-white font-black uppercase text-sm sm:text-base md:text-lg mb-1 sm:mb-2">Organizations</h4>
                    <p className="text-xs sm:text-sm text-gray-500">Join gaming teams or host custom matches.</p>
                </div>
            </section>

            {/* Featured Tournaments Container */}
            <section className="px-0 sm:px-2" aria-labelledby="featured-tournaments-heading">
                <div className="flex justify-between items-center mb-6 sm:mb-8">
                    <div className="space-y-1 min-w-0">
                        <h2 id="featured-tournaments-heading" className="text-xl sm:text-2xl md:text-4xl font-black text-white uppercase tracking-tight flex items-center gap-2 sm:gap-3">
                            <Star className="text-yellow-500 w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 fill-yellow-500 shrink-0" />
                            Featured <span className="text-yellow-500">Tournaments</span>
                        </h2>
                        <p className="text-gray-500 text-xs md:text-sm font-medium hidden sm:block">Join the most prestigious battles on Nexplay</p>
                    </div>
                    <button type="button" 
                        onClick={() => handleCtaClick('/tournaments', 'ViewAllFeatured')} 
                        className="bg-surface/50 hover:bg-surface text-white min-h-[44px] px-3 py-2 sm:px-4 sm:py-2.5 md:px-6 md:py-3 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-colors flex items-center gap-1 sm:gap-2 border border-gray-700 shrink-0"
                        aria-label="View all scheduled tournaments"
                    >
                        View All <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
                    </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
                    {featuredTournaments.length > 0 ? (
                        featuredTournaments.map((t, idx) => <TournamentCard key={t.id || `feat-${idx}`} tournament={t} />)
                    ) : (
                        <div className="col-span-full py-20 text-center text-gray-500 bg-card/50 rounded-3xl border border-dashed border-gray-800">
                            <Trophy className="w-12 h-12 mx-auto mb-4 opacity-20 text-brand-500" />
                            <p className="font-bold uppercase tracking-widest text-sm text-gray-400">No active featured tournaments</p>
                            <p className="text-xs text-gray-600 mt-1">Check back later or explore other games.</p>
                        </div>
                    )}
                </div>
            </section>

            {/* Popular Games Browser Layout */}
            <section className="px-0 sm:px-2" aria-labelledby="popular-games-heading">
                <div className="flex justify-between items-center mb-6 sm:mb-8">
                    <div className="space-y-1 min-w-0">
                        <h2 id="popular-games-heading" className="text-xl sm:text-2xl md:text-4xl font-black text-white uppercase tracking-tight flex items-center gap-2 sm:gap-3">
                            <Gamepad2 className="text-brand-500 w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 shrink-0" />
                            Popular <span className="text-brand-500">Games</span>
                        </h2>
                        <p className="text-gray-500 text-xs md:text-sm font-medium hidden sm:block">Explore tournaments across your favorite titles</p>
                    </div>
                    <button type="button" 
                        onClick={() => handleCtaClick('/games', 'ViewAllGames')} 
                        className="bg-surface/50 hover:bg-surface text-white min-h-[44px] px-3 py-2 sm:px-4 sm:py-2.5 md:px-6 md:py-3 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-colors flex items-center gap-1 sm:gap-2 border border-gray-700 shrink-0"
                        aria-label="Explore tournament categories by game"
                    >
                        Explore <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
                    </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-8">
                    {popularGames.length > 0 ? (
                        popularGames.map((g, idx) => <GameCard key={g.id || `game-${idx}`} game={g} />)
                    ) : (
                        <div className="col-span-full py-20 text-center text-gray-500 bg-card/50 rounded-3xl border border-dashed border-gray-800">
                            <p className="font-bold uppercase tracking-widest text-sm text-gray-400">No games listed yet</p>
                        </div>
                    )}
                </div>
            </section>

            {/* Concluded Tournaments (Hall of Fame) */}
            {recentResults.length > 0 && (
                <section className="px-0 sm:px-2" aria-labelledby="hall-of-fame-heading">
                    <div className="flex justify-between items-center mb-6 sm:mb-8">
                        <div className="space-y-1 min-w-0">
                            <h2 id="hall-of-fame-heading" className="text-xl sm:text-2xl md:text-4xl font-black text-white uppercase tracking-tight flex items-center gap-2 sm:gap-3">
                                <Trophy className="text-yellow-500 w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 fill-yellow-500 shrink-0" />
                                Hall of <span className="text-brand-500">Fame</span>
                            </h2>
                            <p className="text-gray-500 text-xs md:text-sm font-medium hidden sm:block">Recently concluded battles and their champions</p>
                        </div>
                        <button type="button" 
                            onClick={() => handleCtaClick('/results', 'ViewAllResults')} 
                            className="bg-surface/50 hover:bg-surface text-white min-h-[44px] px-3 py-2 sm:px-4 sm:py-2.5 md:px-6 md:py-3 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-colors flex items-center gap-1 sm:gap-2 border border-gray-700 shrink-0"
                            aria-label="View all historic results"
                        >
                            View All <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
                        </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        {recentResults.map((t, idx) => (
                            <div 
                                key={t.id || `result-${idx}`} 
                                onClick={() => handleCtaClick(`/tournaments/${t.id}`, `ConcludedTournament_${t.id}`)}
                                className="bg-surface p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-gray-800 hover:border-brand-500/30 transition-colors cursor-pointer group"
                            >
                                <div className="flex flex-wrap gap-4 sm:gap-6 min-w-0">
                                    <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-xl sm:rounded-2xl bg-dark overflow-hidden shrink-0 border border-gray-800">
                                        <img src={t.bannerUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${t.title}`} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" loading="lazy" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-2 min-w-0 gap-2">
                                            <div>
                                                <h4 className="text-white font-black text-lg uppercase truncate min-w-0">{t.title}</h4>
                                                <p className="text-xs text-brand-500 font-black uppercase tracking-widest">{formatGameName(t.game)}</p>
                                            </div>
                                            <span className="text-xs text-gray-500 font-bold bg-card px-2 py-1 rounded">COMPLETED</span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-4 min-w-0">
                                            {t.winners?.slice(0, 1).map((w, wIdx) => (
                                                <div key={w.uid || `winner-${wIdx}`} className="flex items-center gap-3 bg-brand-600/10 px-4 py-2 rounded-xl border border-brand-500/20">
                                                    <Trophy className="w-4 h-4 text-yellow-500" />
                                                    <div>
                                                        <p className="text-xs text-gray-500 font-black uppercase">Champion</p>
                                                        <p className="text-xs font-black text-white truncate max-w-[120px]">{w.username || 'Unknown'}</p>
                                                    </div>
                                                </div>
                                            ))}
                                            <div className="flex flex-col">
                                                <p className="text-xs text-gray-500 font-black uppercase tracking-widest">Prize Pool</p>
                                                <p className="text-xs font-black text-brand-500">{(t.prizePool).toLocaleString()} {t.currency || 'Rs.'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}
            {/* Quick Links — internal linking for SEO */}
            <section className="mb-8 sm:mb-12">
                <h2 className="text-white font-black text-lg sm:text-xl uppercase tracking-tight mb-3 sm:mb-4">Explore NexPlay</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
                    <Link to="/games" className="bg-card rounded-xl sm:rounded-2xl border border-gray-800 p-3 sm:p-4 hover:border-brand-500/50 touch-target transition-colors group">
                        <Gamepad2 className="w-5 h-5 sm:w-6 sm:h-6 text-brand-500 mb-1.5 sm:mb-2 group-hover:scale-110 transition-transform" />
                        <h3 className="text-white font-bold text-xs sm:text-sm">Games</h3>
                        <p className="text-gray-500 text-[10px] sm:text-xs hidden sm:block">Browse by game</p>
                    </Link>
                    <Link to="/organizations" className="bg-card rounded-xl sm:rounded-2xl border border-gray-800 p-3 sm:p-4 hover:border-brand-500/50 touch-target transition-colors group">
                        <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-brand-500 mb-1.5 sm:mb-2 group-hover:scale-110 transition-transform" />
                        <h3 className="text-white font-bold text-xs sm:text-sm">Organizations</h3>
                        <p className="text-gray-500 text-[10px] sm:text-xs hidden sm:block">Esports orgs</p>
                    </Link>
                    <Link to="/news" className="bg-card rounded-xl sm:rounded-2xl border border-gray-800 p-3 sm:p-4 hover:border-brand-500/50 touch-target transition-colors group">
                        <Newspaper className="w-5 h-5 sm:w-6 sm:h-6 text-brand-500 mb-1.5 sm:mb-2 group-hover:scale-110 transition-transform" />
                        <h3 className="text-white font-bold text-xs sm:text-sm">News</h3>
                        <p className="text-gray-500 text-[10px] sm:text-xs hidden sm:block">Latest updates</p>
                    </Link>
                    <Link to="/leaderboard" className="bg-card rounded-xl sm:rounded-2xl border border-gray-800 p-3 sm:p-4 hover:border-brand-500/50 touch-target transition-colors group">
                        <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-brand-500 mb-1.5 sm:mb-2 group-hover:scale-110 transition-transform" />
                        <h3 className="text-white font-bold text-xs sm:text-sm">Leaderboard</h3>
                        <p className="text-gray-500 text-[10px] sm:text-xs hidden sm:block">Top rankings</p>
                    </Link>
                </div>
            </section>
            {/* ponytail: FAQ section for Home page */}
            <Faq items={homeFaqs} />
        </div>
        </>
    );
};


export default Home;
