import React from 'react';
import { Link } from 'react-router-dom';
import { Game } from '../../../shared/types/types';
import { motion } from 'motion/react';
import { formatGameModeLabel, formatGameName } from '../../../shared/utils/utils';

interface GameCardProps {
    game: Game;
}

const GameCard: React.FC<GameCardProps> = ({ game }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02 }}
            className="bg-card rounded-xl overflow-hidden border border-gray-800 hover:border-brand-500/50 transition-colors group shadow-lg"
        >
            <Link
                to={`/games/${game.id}`}
                aria-label={`View ${formatGameName(game.name)} details`}
                className="block focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:outline-none rounded-xl"
            >
                <div className="relative h-36 sm:h-48 overflow-hidden">
                    <img
                        src={game.logoUrl || ''}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" loading="lazy"
                        referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                    <div className="absolute bottom-4 left-4 right-4">
                        <h3 className="text-lg sm:text-xl font-bold text-white drop-shadow-md truncate">{formatGameName(game.name)}</h3>
                    </div>
                </div>
                <div className="p-4 space-y-3" aria-hidden="true">
                    <div className="flex flex-wrap gap-2">
                        {game.modes.map((mode) => (
                            <span
                                key={mode}
                                className="px-2 py-1 bg-surface text-brand-400 text-xs font-bold uppercase rounded border border-brand-500/20"
                            >
                                {formatGameModeLabel(mode)}
                            </span>
                        ))}
                    </div>
                    <div className="pt-2 border-t border-gray-800 flex justify-between items-center min-w-0">
                        <span className="text-xs text-gray-500 font-mono uppercase truncate">Modes: {game.modes.length}</span>
                        <span className="text-xs font-bold text-brand-500 group-hover:text-brand-400 uppercase tracking-wider transition py-2 px-2 -mx-2 touch-target shrink-0">
                            Explore
                        </span>
                    </div>
                </div>
            </Link>
        </motion.div>
    );
};

export default GameCard;
