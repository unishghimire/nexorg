import React from 'react';
import { Link } from 'react-router-dom';
import { Tournament } from '../../../shared/types/types';
import { DEFAULT_BANNER } from '../../../shared/constants/constants';
import { formatCurrency, formatDate, formatGameName } from '../../../shared/utils/utils';
import { Clock, Users, Trophy, ChevronRight, Gamepad2, MapPin, Target } from 'lucide-react';
import { motion } from 'motion/react';
import { ScoringInfoCard } from './ScoringInfoCard';
import { getSlotCount, getFilledSlotCount } from '../../../shared/utils/scrimSlots';

interface TournamentCardProps {
    tournament: Tournament;
}

const TournamentCard: React.FC<TournamentCardProps> = ({ tournament }) => {
    const bannerUrl = tournament.bannerUrl || DEFAULT_BANNER;

    return (
        <Link to={`/tournaments/${tournament.id}`} className="block h-full">
        <motion.div 
            whileHover={{ y: -8, scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="group relative bg-surface rounded-2xl sm:rounded-[2rem] overflow-hidden border border-gray-800/50 hover:border-brand-500/50 transition-colors duration-500 cursor-pointer flex flex-col h-full shadow-2xl hover:shadow-brand-500/20 w-full min-w-0"
        >
            {/* Banner Section */}
            <div className="h-36 sm:h-48 relative overflow-hidden w-full shrink-0">
                <motion.img 
                    src={bannerUrl || undefined} 
                    alt={tournament.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/40 to-transparent z-10"></div>
                
                {/* Status & Game Badges */}
                <div className="absolute top-2 sm:top-4 left-2 sm:left-4 z-20 flex flex-wrap gap-1.5 sm:gap-2 max-w-[calc(100%-4rem)]">
                    <div className="bg-brand-600/90 backdrop-blur-md px-2.5 sm:px-3 py-1 text-[9px] sm:text-xs uppercase font-black rounded-full text-white border border-brand-500/30 tracking-widest shadow-xl flex items-center gap-1 sm:gap-1.5 shrink-0 min-h-[24px]">
                        <Gamepad2 className="w-3 h-3 shrink-0" />
                        <span className="truncate max-w-[100px] sm:max-w-none">{formatGameName(tournament.game)}</span>
                    </div>
                    <div className={`backdrop-blur-md px-2.5 sm:px-3 py-1 text-[9px] sm:text-xs uppercase font-black rounded-full text-white border tracking-widest shadow-xl flex items-center gap-1 sm:gap-1.5 shrink-0 min-h-[24px] ${
                        tournament.status === 'live' ? 'bg-red-600/90 border-red-500/30 animate-pulse' : 
                        tournament.status === 'completed' ? 'bg-blue-600/90 border-blue-500/30' : 
                        'bg-green-600/90 border-green-500/30'
                    }`}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tournament.status === 'live' ? 'bg-white' : 'bg-current'}`}></span>
                        <span>{tournament.status}</span>
                    </div>
                </div>

                {/* Badges - Floating Right */}
                <div className="absolute top-2 sm:top-4 right-2 sm:right-4 z-20 flex flex-col gap-1 items-end">
                    <div className="bg-white/10 backdrop-blur-md px-2.5 sm:px-3 py-1 rounded-full border border-white/10 text-[9px] sm:text-xs font-black text-white uppercase tracking-widest min-h-[24px] flex items-center justify-center">
                        {tournament.teamType}
                    </div>
                    {(tournament as any).tournamentMode === 'PER_KILL_REWARD' && (
                        <div className="bg-brand-500/20 backdrop-blur-md px-2.5 sm:px-3 py-1 rounded-full border border-brand-500/30 text-[9px] sm:text-xs font-black text-brand-400 uppercase tracking-widest min-h-[24px] flex items-center gap-1">
                            <Target className="w-2.5 h-2.5" /> Per-Kill
                        </div>
                    )}
                </div>

                {/* Prize Pool - Large Overlay */}
                <div className="absolute bottom-2 sm:bottom-4 left-2 sm:left-4 right-2 sm:right-4 z-20">
                    <div className="flex flex-col min-w-0">
                        <span className="text-[9px] sm:text-xs text-gray-400 font-black uppercase tracking-widest mb-0.5">Prize Pool</span>
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                            <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500 shrink-0 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
                            <span className="text-lg sm:text-2xl font-black text-white tracking-tighter drop-shadow-lg truncate">
                                {formatCurrency(tournament.prizePool)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Section */}
            <div className="p-4 sm:p-6 flex-grow flex flex-col bg-gradient-to-b from-surface to-dark/50 min-w-0">
                <h3 className="text-base sm:text-xl font-black text-white mb-3 sm:mb-4 group-hover:text-brand-400 transition-colors line-clamp-1 uppercase tracking-tight leading-tight min-w-0 break-words">
                    {tournament.title}
                </h3>

                <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-4 sm:mb-6">
                    <div className="bg-dark/40 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-gray-800/50 group-hover:border-brand-500/20 transition-colors min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                            <Users className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                            <span className="text-[8px] sm:text-[9px] text-gray-500 uppercase font-black tracking-widest truncate">Format</span>
                        </div>
                        <div className="text-[11px] sm:text-xs text-gray-200 font-black truncate uppercase tracking-tight">
                            {tournament.teamType} • {tournament.type}
                        </div>
                    </div>
                    <div className="bg-dark/40 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-gray-800/50 group-hover:border-brand-500/20 transition-colors min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                            <MapPin className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                            <span className="text-[8px] sm:text-[9px] text-gray-500 uppercase font-black tracking-widest truncate">Map</span>
                        </div>
                        <div className="text-[11px] sm:text-xs text-gray-200 font-black truncate uppercase tracking-tight">
                            {tournament.map || 'TBD'}
                        </div>
                    </div>
                </div>

                <ScoringInfoCard tournament={tournament} compact />

                <div className="space-y-3 sm:space-y-4 mt-auto">
                    {/* Progress Section */}
                    <div className="bg-dark/20 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-gray-800/30">
                        <div className="flex justify-between items-end mb-2 gap-2">
                            <div className="flex flex-col min-w-0">
                                <span className="text-[8px] sm:text-[9px] text-gray-500 font-black uppercase tracking-widest truncate">Entry Fee</span>
                                <span className={`text-xs sm:text-sm font-black truncate ${tournament.entryFee === 0 ? 'text-green-400' : 'text-white'}`}>
                                    {tournament.entryFee === 0 ? 'FREE' : formatCurrency(tournament.entryFee)}
                                </span>
                            </div>
                            <div className="text-right shrink-0">
                                <span className="text-[8px] sm:text-[9px] text-gray-500 font-black uppercase tracking-widest block mb-0.5">Slots</span>
                                <span className="text-xs sm:text-sm font-black text-brand-400">{getFilledSlotCount(tournament)} / {getSlotCount(tournament)}</span>
                            </div>
                        </div>
                        <div className="w-full bg-card rounded-full h-2 overflow-hidden border border-gray-800/50">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, Math.max(0, (getFilledSlotCount(tournament) / (getSlotCount(tournament) || 1)) * 100))}%` }}
                                transition={{ duration: 1, ease: 'easeOut' }}
                                className="bg-brand-600 h-full rounded-full relative"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
                            </motion.div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                        <div className="flex items-center gap-1.5 sm:gap-2 text-gray-500 min-w-0">
                            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                            <span className="text-[9px] sm:text-xs font-black uppercase tracking-widest truncate">
                                {formatDate(tournament.startTime).split(',')[0]}
                            </span>
                        </div>
                        <div className="inline-flex items-center justify-center min-h-[44px] gap-1.5 bg-brand-600/10 text-brand-500 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest group-hover:bg-brand-600 group-hover:text-white transition-colors duration-300 shrink-0">
                            <span>View Details</span> <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform shrink-0" />
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
        </Link>
    );
};

export default TournamentCard;
