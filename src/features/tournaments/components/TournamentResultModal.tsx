import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {Trophy, X, Calendar, Users, Target, Award, Star, Medal, ArrowUpRight, Share2, Download, CheckCircle2} from 'lucide-react';
import { Tournament } from '../../../shared/types/types';
import { formatCurrency, formatDate } from '../../../shared/utils/utils';
import PrizeBoard from './PrizeBoard';
import ResultBoard from '../../results/components/ResultBoard';
import PerKillResultView from './PerKillResultView';
import { useNotification } from '../../../shared/context/NotificationContext';

interface TournamentResultModalProps {
    isOpen: boolean;
    onClose: () => void;
    tournament: Tournament;
}

const TournamentResultModal: React.FC<TournamentResultModalProps> = ({ isOpen, onClose, tournament }) => {
    const { showToast } = useNotification();

    // Prevent background scrolling when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    // Derived Insights from manualResults
    let mvp = null;
    let totalKills = 0;
    
    if (tournament.manualResults && tournament.manualResults.length > 0) {
        let maxKills = -1;
        tournament.manualResults.forEach(r => {
            const kills = Number(r.kills) || 0;
            totalKills += kills;
            if (kills > maxKills) {
                maxKills = kills;
                mvp = { ...r, kills };
            }
        });
    }

    const firstPlace = tournament.winners?.find(w => w.rank === 1) || (tournament.manualResults && tournament.manualResults.find(m => parseInt(String(m.rank)) === 1));

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6 lg:p-12 font-sans">
                {/* Backdrop */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-[#0b1120]/95 backdrop-blur-md"
                ></motion.div>

                {/* Modal Container */}
                <motion.div 
                    initial={{ opacity: 0, y: 100, scale: 1 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 100, scale: 0.95 }}
                    transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                    className="relative w-full max-w-5xl max-h-[100dvh] sm:max-h-[90vh] bg-[#0f172a] rounded-t-[2rem] sm:rounded-[2rem] border border-gray-800 shadow-2xl overflow-hidden flex flex-col"
                >
                    {/* Mobile Handle */}
                    <div className="w-full flex justify-center pt-3 pb-1 sm:hidden absolute top-0 left-0 z-30 pointer-events-none">
                        <div className="w-12 h-1.5 bg-surface rounded-full"></div>
                    </div>

                    {/* Header */}
                    <div className="relative sticky top-0 z-20 bg-[#0f172a]/90 backdrop-blur-xl border-b border-gray-800 px-6 py-5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400">
                                <Trophy className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-white uppercase tracking-tight">{tournament.title}</h2>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                        <Calendar className="w-3 h-3" /> {formatDate(tournament.startTime || tournament.createdAt)}
                                    </span>
                                    <span className="w-1 h-1 rounded-full bg-surface"></span>
                                    <span className="flex items-center gap-1 text-[10px] font-bold text-green-400 uppercase tracking-widest bg-green-500/10 px-2 py-0.5 rounded-sm">
                                        <CheckCircle2 className="w-3 h-3" /> Finalized
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button type="button" className="hidden sm:flex items-center gap-2 bg-surface hover:bg-surface text-white px-4 py-2 rounded-xl text-xs font-bold uppercase transition">
                                <Share2 className="w-4 h-4" /> Share
                            </button>
                            <button type="button" onClick={onClose} className="p-3 bg-surface hover:bg-surface text-gray-400 hover:text-white rounded-xl transition">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Scrollable Content */}
                    <div className="overflow-y-auto custom-scrollbar flex-1 p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
                        
                        {/* Winner Spotlight Hero */}
                        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-indigo-900/40 via-[#0f172a] to-[#0f172a] border border-indigo-500/20 p-5 sm:p-8 lg:p-12 text-center group">
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-64 bg-indigo-500/20 blur-[100px] pointer-events-none"></div>
                            
                            <Trophy className="w-20 h-20 text-yellow-500 mx-auto mb-6 filter drop-shadow-[0_0_15px_rgba(234,179,8,0.5)] transform group-hover:scale-110 transition-transform duration-500" />
                            
                            <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-2">Tournament Champions</h3>
                            
                            {firstPlace ? (
                                <div className="space-y-4">
                                    <h4 className="text-4xl sm:text-5xl font-black text-white tracking-tighter uppercase">
                                        {(firstPlace as any).username || (firstPlace as any).teamName || (firstPlace as any).playerId}
                                    </h4>
                                    <div className="flex flex-wrap items-center justify-center gap-3">
                                        <span className="flex items-center gap-1 text-sm font-bold text-yellow-500 bg-yellow-500/10 px-4 py-1.5 rounded-full border border-yellow-500/20">
                                            <Award className="w-4 h-4" /> 1st Place
                                        </span>
                                        {((firstPlace as any).amount || (firstPlace as any).prize) && (
                                            <span className="flex items-center gap-1 text-sm font-bold text-green-400 bg-green-500/10 px-4 py-1.5 rounded-full border border-green-500/20">
                                                <Trophy className="w-4 h-4" /> 
                                                {formatCurrency(((firstPlace as any).amount || (firstPlace as any).prize), (tournament.currency === 'USD' ? '$ ' : tournament.currency === 'EUR' ? '€ ' : tournament.currency === 'INR' ? '₹ ' : 'Rs. '))}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-2xl font-black text-white tracking-tighter uppercase">Winners Announced</div>
                            )}
                        </div>

                        {/* Match Summary Stats */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                            <div className="bg-[#1e293b]/50 border border-gray-800 rounded-2xl p-5 text-center">
                                <Users className="w-6 h-6 text-indigo-400 mx-auto mb-2 opacity-50" />
                                <div className="text-2xl font-black text-white">{tournament.currentPlayers || 0}</div>
                                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Participants</div>
                            </div>
                            <div className="bg-[#1e293b]/50 border border-gray-800 rounded-2xl p-5 text-center">
                                <Target className="w-6 h-6 text-rose-400 mx-auto mb-2 opacity-50" />
                                <div className="text-2xl font-black text-white">{totalKills > 0 ? totalKills : '-'}</div>
                                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Total Kills</div>
                            </div>
                            <div className="bg-[#1e293b]/50 border border-gray-800 rounded-2xl p-5 text-center">
                                <Medal className="w-6 h-6 text-amber-400 mx-auto mb-2 opacity-50" />
                                <div className="text-2xl font-black text-white">
                                    {tournament.prizePool > 0 ? formatCurrency(tournament.prizePool) : '-'}
                                </div>
                                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Total Prize</div>
                            </div>
                            <div className="bg-[#1e293b]/50 border border-gray-800 rounded-2xl p-5 text-center">
                                <Star className="w-6 h-6 text-purple-400 mx-auto mb-2 opacity-50" />
                                <div className="text-xl font-black text-white truncate max-w-full px-2" title={mvp?.teamName || mvp?.playerId || '-'}>
                                    {mvp ? (mvp.teamName || mvp.playerId) : '-'}
                                </div>
                                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Match MVP {mvp ? `(${mvp.kills})` : ''}</div>
                            </div>
                        </div>

                        {/* Per-Kill Reward Results */}
                        {(tournament as any).tournamentMode === 'PER_KILL_REWARD' && (
                            <div className="space-y-4">
                                <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                                    <Target className="w-5 h-5 text-brand-500" /> Per-Kill Reward Results
                                </h4>
                                <div className="bg-[#1e293b]/30 rounded-3xl border border-gray-800 overflow-hidden shadow-xl p-4 sm:p-6">
                                    <PerKillResultView tournament={tournament} />
                                </div>
                            </div>
                        )}

                        {/* Professional Scoreboard */}
                        {tournament.manualResults && tournament.manualResults.length > 0 && tournament.resultTemplate && (
                            <div className="space-y-4">
                                <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                                    <Target className="w-5 h-5 text-indigo-500" /> Professional Scoreboard
                                </h4>
                                <div className="bg-[#1e293b]/30 rounded-3xl border border-gray-800 overflow-hidden shadow-xl">
                                    <ResultBoard results={tournament.manualResults} config={tournament.resultTemplate} />
                                </div>
                            </div>
                        )}

                        {/* Prize Distribution Panel */}
                        {tournament.prizeDistribution && tournament.prizeDistribution.length > 0 && (
                            <div className="space-y-4">
                                <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                                    <Award className="w-5 h-5 text-amber-500" /> Prize Distribution
                                </h4>
                                <div className="bg-[#1e293b]/30 rounded-2xl sm:rounded-3xl border border-gray-800 overflow-hidden shadow-xl p-4 sm:p-6">
                                    <PrizeBoard prizes={tournament.prizeDistribution} currency={tournament.currency} totalPrizePool={tournament.prizePool} />
                                </div>
                            </div>
                        )}

                        {/* Official Results Screenshot */}
                        {tournament.resultUrl && (
                            <div className="space-y-4">
                                <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                                    <Star className="w-5 h-5 text-cyan-500" /> Official Post-Match Snapshot
                                </h4>
                                <div className="rounded-3xl overflow-hidden border border-gray-800 shadow-2xl relative group cursor-pointer">
                                    <img src={tournament.resultUrl} alt="Match Results" className="w-full h-auto object-cover transform transition duration-500 group-hover:scale-105" loading="lazy" />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                                        <button type="button" className="bg-white/10 hover:bg-white/20 text-white backdrop-blur-md px-6 py-3 rounded-full font-bold flex items-center gap-2 uppercase tracking-widest text-xs border border-white/20 transition-colors">
                                            <Share2 className="w-4 h-4" /> Share Screenshot
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                    </div>

                    {/* Action Footer */}
                    <div className="bg-[#0b1120] border-t border-gray-800 p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
                        <button type="button" 
                            onClick={onClose}
                            className="w-full sm:w-auto px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-xs text-gray-400 bg-card border border-gray-800 hover:bg-surface hover:text-white transition-colors"
                        >
                            Close Panel
                        </button>
                        
                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                            <button type="button" 
                                onClick={() => window.print()}
                                className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-xs text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 transition-colors flex items-center justify-center gap-2">
                                <Download className="w-4 h-4" /> Download PDF
                            </button>
                            <button type="button" 
                                onClick={async () => {
                                    try {
                                        await navigator.clipboard.writeText(window.location.href);
                                        showToast('Result link copied to clipboard', 'success');
                                    } catch (error) {
                                        showToast('Could not copy the result link', 'error');
                                    }
                                }}
                                className="w-full sm:w-auto px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-xl shadow-indigo-500/20 transition-colors flex items-center justify-center gap-2 group">
                                Share Result <ArrowUpRight className="w-4 h-4 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default TournamentResultModal;
