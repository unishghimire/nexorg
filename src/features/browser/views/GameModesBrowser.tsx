import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../shared/config/firebase';
import { Game } from '../../../shared/types/types';
import Seo from '../../../shared/components/Seo';
import { Gamepad2, ChevronRight, Trophy, Swords, ArrowLeft } from 'lucide-react';
import { formatGameModeLabel, formatGameName } from '../../../shared/utils/utils';

const defaultImages = [
    'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&q=80',
];

const getModeImage = (mode: string, index: number) => {
    const m = mode.toLowerCase();
    if (m.includes('clash') || m.includes('tdm') || m.includes('deathmatch')) {
        return 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80';
    }
    if (m.includes('lone') || m.includes('1v1') || m.includes('solo')) {
        return 'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?auto=format&fit=crop&q=80';
    }
    if (m.includes('classic') || m.includes('battle') || m.includes('map')) {
        return 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&q=80';
    }
    if (m.includes('rank')) {
        return 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&q=80';
    }
    if (m.includes('arcade') || m.includes('fun')) {
        return 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80';
    }
    return defaultImages[index % defaultImages.length];
};
import { motion } from 'motion/react';

type SelectionType = 'tournaments' | 'scrims' | null;

const GameModesBrowser: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [game, setGame] = useState<Game | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedType, setSelectedType] = useState<SelectionType>(null);

    useEffect(() => {
        const fetchGame = async () => {
            if (!id) return;
            setLoading(true);
            try {
                const docRef = doc(db, 'games', id);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setGame({ id: docSnap.id, ...docSnap.data() } as Game);
                }
            } catch (error) {
                console.error("Error fetching game:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchGame();
    }, [id]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="w-12 h-12 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin mb-4"></div>
                <p className="text-brand-500 text-sm animate-pulse font-mono tracking-widest uppercase">Loading...</p>
            </div>
        );
    }

    if (!game) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <p className="text-gray-500 text-xl font-bold uppercase">Game not found</p>
                <button
                    onClick={() => navigate('/games')}
                    className="mt-4 px-6 py-2 bg-brand-500 text-black font-bold uppercase rounded-lg hover:bg-brand-400 transition min-h-[44px]"
                >
                    Back to Games
                </button>
            </div>
        );
    }

    const gameLabel = formatGameName(game.name);

    // Step 1: Choose between Tournaments and Scrims
    if (!selectedType) {
        return (
            <>
            <Seo
                title={`${gameLabel} Tournaments & Scrims in Nepal | NexPlay`}
                description={`Find ${gameLabel} tournaments and scrims in Nepal on NexPlay.`}
                canonicalPath={`/games/${id}`}
                jsonLd={{
                    "@context": "https://schema.org",
                    "@type": "VideoGame",
                    "name": gameLabel,
                    "genre": "Esports",
                    "url": `https://www.nexplayorg.app/games/${id}`,
                    "description": `Find ${gameLabel} tournaments and scrims in Nepal on NexPlay.`
                }}
            />
            <div className="animate-fade-in max-w-5xl mx-auto p-4 md:p-8">
                <Link to="/games" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-white transition mb-6 touch-target">
                    <ArrowLeft className="w-4 h-4" /> Back to Games
                </Link>

                <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6 border-b border-gray-800 pb-8">
                    <div className="space-y-2">
                        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white uppercase tracking-tighter flex items-center gap-4">
                            <img src={game.logoUrl || ''} alt={gameLabel} className="w-14 h-14 object-cover rounded-2xl border border-gray-800" referrerPolicy="no-referrer" loading="lazy" />
                            {gameLabel}
                        </h1>
                        <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">Choose what you want to play</p>
                    </div>
                </header>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <motion.button
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        whileHover={{ y: -8 }}
                        onClick={() => setSelectedType('tournaments')}
                        className="relative rounded-3xl overflow-hidden group border border-gray-800 bg-card/50 text-left w-full min-h-[280px] cursor-pointer"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent" />
                        <div className="relative p-8 flex flex-col items-center justify-center h-full">
                            <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <Trophy className="w-10 h-10 text-amber-400" />
                            </div>
                            <h3 className="text-2xl font-black text-white uppercase tracking-widest mb-2">Tournaments</h3>
                            <p className="text-sm text-gray-400 font-bold text-center">Compete in organized tournaments with prizes</p>
                            <div className="mt-4 flex items-center gap-1 text-amber-400 text-xs font-black uppercase tracking-widest">
                                Browse Tournaments <ChevronRight className="w-3 h-3" />
                            </div>
                        </div>
                    </motion.button>

                    <motion.button
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        whileHover={{ y: -8 }}
                        onClick={() => setSelectedType('scrims')}
                        className="relative rounded-3xl overflow-hidden group border border-gray-800 bg-card/50 text-left w-full min-h-[280px] cursor-pointer"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-brand-500/10 to-transparent" />
                        <div className="relative p-8 flex flex-col items-center justify-center h-full">
                            <div className="w-20 h-20 rounded-3xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <Swords className="w-10 h-10 text-brand-400" />
                            </div>
                            <h3 className="text-2xl font-black text-white uppercase tracking-widest mb-2">Scrims</h3>
                            <p className="text-sm text-gray-400 font-bold text-center">Join casual practice matches with other teams</p>
                            <div className="mt-4 flex items-center gap-1 text-brand-400 text-xs font-black uppercase tracking-widest">
                                Browse Scrims <ChevronRight className="w-3 h-3" />
                            </div>
                        </div>
                    </motion.button>
                </div>
            </div>
            </>
        );
    }

    // Step 2: Select a mode
    const typeLabel = selectedType === 'tournaments' ? 'Tournaments' : 'Scrims';
    const targetPath = selectedType === 'tournaments' ? '/tournaments' : '/scrims';

    return (
        <>
        <Seo
            title={`${gameLabel} ${typeLabel} in Nepal | NexPlay`}
            description={`Find ${gameLabel} ${typeLabel.toLowerCase()} in Nepal on NexPlay.`}
            canonicalPath={`/games/${id}`}
        />
        <div className="animate-fade-in max-w-5xl mx-auto p-4 md:p-8">
            <button
                onClick={() => setSelectedType(null)}
                className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-white transition mb-6 touch-target"
            >
                <ArrowLeft className="w-4 h-4" /> Back to {gameLabel}
            </button>

            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6 border-b border-gray-800 pb-8">
                <div className="space-y-2">
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white uppercase tracking-tighter flex items-center gap-4">
                        <img src={game.logoUrl || ''} alt={gameLabel} className="w-14 h-14 object-cover rounded-2xl border border-gray-800" referrerPolicy="no-referrer" loading="lazy" />
                        {gameLabel} {typeLabel}
                    </h1>
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">Select a mode to view {typeLabel.toLowerCase()}</p>
                </div>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {game.modes && game.modes.length > 0 ? (
                    game.modes.map((mode, idx) => {
                        const modeLabel = formatGameModeLabel(mode);

                        return (
                        <Link
                            key={idx}
                            to={`${targetPath}?game=${encodeURIComponent(game.name)}&mode=${encodeURIComponent(mode)}`}
                            className="block w-full h-full focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:outline-none rounded-3xl"
                        >
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            whileHover={{ y: -8 }}
                            className="relative rounded-3xl overflow-hidden group border border-gray-800 bg-card/50 text-left w-full h-full"
                        >
                            <div className="relative h-48 w-full overflow-hidden">
                                <img
                                    src={getModeImage(modeLabel, idx) || undefined}
                                    alt={modeLabel}
                                    className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                                    referrerPolicy="no-referrer" loading="lazy" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent"></div>

                                <div className="absolute bottom-6 left-6 right-6">
                                    <h3 className="text-xl font-black text-white uppercase tracking-widest mb-1 group-hover:text-brand-400 transition-colors">{modeLabel}</h3>
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        Explore <ChevronRight className="w-3 h-3" />
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                        </Link>
                        );
                    })
                ) : (
                    <div className="col-span-full py-20 bg-card/50 rounded-3xl border border-gray-800 text-center">
                        <Gamepad2 className="w-16 h-16 text-gray-700 mx-auto mb-6" />
                        <h3 className="text-xl font-black text-white uppercase tracking-widest">No Modes Found</h3>
                        <p className="text-gray-500 font-bold mt-2">This game currently has no active modes.</p>
                    </div>
                )}
            </div>
        </div>
        </>
    );
};

export default GameModesBrowser;
