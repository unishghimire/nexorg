import Seo from '../../../shared/components/Seo';
import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../shared/config/firebase';
import { Game } from '../../../shared/types/types';
import GameCard from '../../home/components/GameCard';
import { Search, Filter, Gamepad2 } from 'lucide-react';
import { formatGameModeLabel } from '../../../shared/utils/utils';
import { withStaticCache } from '../../../shared/utils/staticCache';

export default function GameBrowser() {
    const [games, setGames] = useState<Game[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMode, setSelectedMode] = useState('all');

    useEffect(() => {
        const fetchGames = async () => {
            setLoading(true);
            try {
                const snap = await withStaticCache('games_published', () =>
                    getDocs(query(collection(db, 'games'), where('isPublished', '==', true)))
                );
                let gamesData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
                gamesData.sort((a,b) => {
                    const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                    const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                    return bTime - aTime;
                });
                setGames(gamesData);
            } catch (error) {
                console.error("Error fetching games:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchGames();
    }, []);

    const allModes = Array.from(new Set<string>(games.flatMap(g => g.modes || [])));

    const filteredGames = games.filter(g => {
        const matchesSearch = g.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesMode = selectedMode === 'all' || (g.modes && g.modes.includes(selectedMode));
        return matchesSearch && matchesMode;
    });

    if (loading) {
        return (
        <>
        <Seo
            title="Games | NexPlay — Esports Tournaments in Nepal"
            description="Explore esports games on NexPlay — PUBG Mobile, Free Fire, Valorant and more. Find tournaments and scrims for your favorite games."
            canonicalPath="/games"
            jsonLd={{
                "@context": "https://schema.org",
                "@type": "ItemList",
                "name": "Esports Games on NexPlay",
                "description": "Explore esports games on NexPlay — PUBG Mobile, Free Fire, Valorant and more.",
                "url": `https://www.nexplayorg.app/games`
            }}
        />
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="w-12 h-12 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin mb-4"></div>
                <p className="text-brand-500 text-xs font-black tracking-widest uppercase">Loading Games...</p>
            </div>
        </>
        );
    }

    return (
        <div className="animate-fade-in max-w-5xl mx-auto p-4 md:p-8">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6 border-b border-gray-800 pb-8">
                <div>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white uppercase tracking-tighter mb-2">Explore Games</h1>
                    <p className="text-gray-400 font-bold">Discover your next battlefield</p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                    <div className="relative flex-grow sm:w-64">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                        <input 
                            aria-label="Search games"
                            type="text" 
                            placeholder="Search games..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-black border border-gray-800 rounded-2xl py-3 pl-12 pr-4 text-white focus:border-brand-500 focus-visible:outline-none transition-colors font-bold"
                        />
                    </div>
                    <div className="relative sm:w-48">
                        <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                        <select 
                            aria-label="Filter games by mode"
                            value={selectedMode}
                            onChange={(e) => setSelectedMode(e.target.value)}
                            className="w-full bg-black border border-gray-800 rounded-2xl py-3 pl-12 pr-4 text-white focus:border-brand-500 focus-visible:outline-none transition-colors appearance-none cursor-pointer font-bold"
                        >
                            <option value="all">All Modes</option>
                            {allModes.map(mode => (
                                <option key={mode} value={mode}>{formatGameModeLabel(mode)}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredGames.length > 0 ? (
                    filteredGames.map(game => (
                        <GameCard key={game.id} game={game} />
                    ))
                ) : (
                    <div className="col-span-full py-20 bg-card/50 rounded-3xl border border-gray-800 text-center">
                        <Gamepad2 className="w-16 h-16 text-gray-700 mx-auto mb-6" />
                        <h3 className="text-xl font-black text-white uppercase tracking-widest">No Games Found</h3>
                        <p className="text-gray-500 font-bold mt-2">Try adjusting your search or filters.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
