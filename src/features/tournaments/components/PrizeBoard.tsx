import { motion } from 'motion/react';
import { Trophy, Medal, Award } from 'lucide-react';
import { PrizeDistribution } from '../../../shared/types/types';
import { formatCurrency } from '../../../shared/utils/utils';

interface PrizeBoardProps {
    prizes: PrizeDistribution[];
    currency?: string;
    totalPrizePool?: number;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
    'NPR': 'Rs',
    'INR': '₹',
    'USD': '$',
    'EUR': '€'
};

export default function PrizeBoard({ prizes, currency = 'NPR', totalPrizePool }: PrizeBoardProps) {
    if (!prizes || prizes.length === 0) return null;

    const symbol = CURRENCY_SYMBOLS[currency] || currency;

    const getRankIcon = (rank: number) => {
        switch (rank) {
            case 1: return <Trophy className="w-6 h-6 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]" />;
            case 2: return <Medal className="w-6 h-6 text-gray-300 drop-shadow-[0_0_8px_rgba(209,213,219,0.5)]" />;
            case 3: return <Medal className="w-6 h-6 text-amber-600 drop-shadow-[0_0_8px_rgba(217,119,6,0.5)]" />;
            default: return <Award className="w-5 h-5 text-brand-400" />;
        }
    };

    const getRankStyle = (rank: number) => {
        switch (rank) {
            case 1: return 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 border-yellow-500/50';
            case 2: return 'bg-gradient-to-r from-gray-400/20 to-gray-500/10 border-gray-400/50';
            case 3: return 'bg-gradient-to-r from-amber-600/20 to-amber-700/10 border-amber-600/50';
            default: return 'bg-dark-700 border-dark-600 hover:border-brand-500/50';
        }
    };

    const getRankTextColor = (rank: number) => {
        switch (rank) {
            case 1: return 'text-yellow-400 font-black';
            case 2: return 'text-gray-300 font-bold';
            case 3: return 'text-amber-500 font-bold';
            default: return 'text-gray-300 font-medium';
        }
    };

    return (
        <div className="bg-dark-800 rounded-2xl border border-dark-700 overflow-hidden">
            <div className="bg-dark-900/50 p-3 sm:p-4 border-b border-dark-700 flex justify-between items-center">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-brand-500" />
                    Prize Pool Distribution
                </h3>
                {totalPrizePool !== undefined && totalPrizePool > 0 && (
                    <div className="text-right">
                        <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Total Pool</p>
                        <p className="text-lg font-black text-brand-400">{formatCurrency(totalPrizePool, symbol + ' ')}</p>
                    </div>
                )}
            </div>

            <div className="p-3 sm:p-4 space-y-3">
                {prizes.map((prize, index) => (
                    <motion.div
                        key={prize.id || index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`flex items-center justify-between p-4 rounded-xl border transition-colors duration-300 hover:scale-[1.01] ${getRankStyle(prize.rank)}`}
                    >
                        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-dark-900/50 border border-dark-600/50">
                                {getRankIcon(prize.rank)}
                            </div>
                            <div>
                                <p className={`text-lg tracking-wide ${getRankTextColor(prize.rank)}`}>
                                    {prize.label}
                                </p>
                                {prize.rank > 3 && (
                                    <p className="text-xs text-gray-500 uppercase font-bold">Rank {prize.rank}</p>
                                )}
                            </div>
                        </div>
                        
                        <div className="text-right">
                            <p className={`text-xl font-black tracking-tight ${prize.rank === 1 ? 'text-yellow-400' : 'text-white'}`}>
                                {formatCurrency(prize.amount, symbol + ' ')}
                            </p>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
