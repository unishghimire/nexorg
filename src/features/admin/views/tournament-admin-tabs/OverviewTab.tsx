import React, { useState } from 'react';
import { motion } from 'motion/react';
import { RotateCcw, DollarSign, TrendingUp, TrendingDown, Play, Pause, Send } from 'lucide-react';
import { formatCurrency } from '../../../../shared/utils/utils';
import { TournamentAdminTabProps } from './types';
import { TournamentRoadmap } from '../../../tournaments/components/TournamentRoadmap';
import { QualificationPanel } from '../../../tournaments/components/QualificationPanel';
import { isRoundComplete } from '../../../../shared/services/tournamentEngine';

export const OverviewTab: React.FC<TournamentAdminTabProps> = (props) => {
    const {
        tournament, tournamentEarning, gameStartGroupId, discordSending,
        setGameStartGroupId, handleUpdateStatus, handleUpdateStage, handleAdvanceRound,
        handleDiscord,
        handleGenerateGroupMatches, showToast,
    } = props;

    const [showQualification, setShowQualification] = useState(false);

    // Check if current round is complete enough to show qualification preview
    const roundStatus = tournament?.groups?.length
        ? isRoundComplete({ groups: tournament.groups, tournament })
        : { complete: false, totalMatches: 0, completedMatches: 0 };

    return (
                        <motion.div 
                            key="overview"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-4 sm:space-y-6"
                        >
                             {/* Dynamic roadmap — derived from actual tournament state */}
                             <div className="rounded-xl bg-card border border-gray-800 p-4">
                                 <TournamentRoadmap tournament={tournament} />
                             </div>

                             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                 <h2 className="text-xl font-black uppercase tracking-tighter text-white">Tournament Controls</h2>
                                 <button type="button" 
                                     onClick={() => window.location.reload()}
                                     className="px-5 py-2 bg-card border border-gray-800 text-gray-500 rounded-full hover:text-white hover:border-gray-700 transition-colors flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
                                 >
                                     <RotateCcw className="w-3 h-3" /> Refresh
                                 </button>
                             </div>
                             
                             {tournamentEarning && (
                                 <div className="bg-card/50 border border-brand-500/10 rounded-2xl sm:rounded-[2rem] p-4 sm:p-8 mb-6 sm:mb-8">
                                     <h3 className="text-xs font-black text-brand-400 uppercase tracking-widest mb-6 flex items-center gap-3">
                                         <DollarSign className="w-4 h-4" /> Tournament Financials
                                     </h3>
                                     <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8">
                                         <div>
                                             <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Total Entry Fees</p>
                                             <p className="text-lg sm:text-2xl font-black text-white font-mono truncate">{formatCurrency(tournamentEarning.entryFeeTotal)}</p>
                                         </div>
                                         <div>
                                             <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Total Prize Pool</p>
                                             <p className="text-lg sm:text-2xl font-black text-white font-mono truncate">{formatCurrency(tournamentEarning.prizePoolTotal)}</p>
                                         </div>
                                         <div>
                                             <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Net Profit</p>
                                             <p className={`text-lg sm:text-2xl font-black ${tournamentEarning.profit > 0 ? 'text-green-500' : 'text-red-500'} flex items-center gap-2 font-mono truncate`}>
                                                 {tournamentEarning.profit > 0 ? <TrendingUp className="w-4 h-4 shrink-0" /> : <TrendingDown className="w-4 h-4 shrink-0" />}
                                                 <span className="truncate">{formatCurrency(tournamentEarning.profit)}</span>
                                             </p>
                                         </div>
                                         <div>
                                             <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Your Share (85%)</p>
                                             <p className="text-lg sm:text-2xl font-black text-brand-400 font-mono truncate">{formatCurrency(tournamentEarning.orgShare)}</p>
                                             <span className={`inline-block mt-2 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                                                 tournamentEarning.status === 'released' ? 'bg-green-500/10 text-green-500' :
                                                 tournamentEarning.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                                                 'bg-surface text-gray-500'
                                             }`}>
                                                 {tournamentEarning.status}
                                             </span>
                                         </div>
                                     </div>
                                 </div>
                             )}

                             {/* Qualification panel — show when round is complete */}
                             {showQualification && tournament && (
                                 <QualificationPanel
                                     tournament={tournament}
                                     onPublish={(preview) => {
                                         setShowQualification(false);
                                         handleAdvanceRound();
                                     }}
                                     onClose={() => setShowQualification(false)}
                                 />
                             )}

                             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                                 <div className="bg-card/50 p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] border border-gray-800">
                                     <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-6">Status Control</h3>
                                     <div className="flex gap-3">
                                         <button type="button" 
                                             onClick={() => handleUpdateStatus('live')}
                                             disabled={tournament.status === 'live'}
                                             className="flex-1 bg-green-500/10 hover:bg-green-500/20 text-green-500 border border-green-500/20 disabled:opacity-30 disabled:cursor-not-allowed py-4 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors"
                                         >
                                             <Play className="w-3 h-3" /> Start
                                         </button>
                                         <button type="button" 
                                             onClick={() => handleUpdateStatus('paused')}
                                             disabled={tournament.status === 'paused'}
                                             className="flex-1 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/20 disabled:opacity-30 disabled:cursor-not-allowed py-4 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors"
                                         >
                                             <Pause className="w-3 h-3" /> Pause
                                         </button>
                                     </div>
                                 </div>
                                 <div className="bg-card/50 p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] border border-gray-800">
                                     <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-6">Stage Progression</h3>
                                     <select 
                                         value={tournament.stage || 'registration'}
                                         onChange={(e) => handleUpdateStage(e.target.value)}
                                         className="w-full bg-dark border border-gray-800 rounded-full p-4 text-[10px] text-white font-black uppercase tracking-widest focus:border-brand-500 focus-visible:outline-none cursor-pointer transition-colors"
                                     >
                                         <option value="registration">Registration</option>
                                         <option value="group_stage">Group Stage</option>
                                         <option value="knockout">Knockout Stage</option>
                                         <option value="completed">Completed</option>
                                     </select>
                                 </div>
                                 <div className="bg-card/50 p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] border border-gray-800 sm:col-span-2 lg:col-span-1">
                                     <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-6">Quick Actions</h3>
                                     <div className="flex flex-col sm:flex-row lg:flex-col gap-3">
                                         <button type="button" 
                                             onClick={() => {
                                                 if (tournament.groups && tournament.groups.length > 0) {
                                                     tournament.groups.forEach(g => handleGenerateGroupMatches(g.id));
                                                 } else {
                                                     showToast('No groups to generate matches for', 'info');
                                                 }
                                             }}
                                             className="flex-1 bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/20 py-4 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors"
                                         >
                                             Generate All Matches
                                         </button>
                                         {roundStatus.complete && roundStatus.totalMatches > 0 ? (
                                             <button type="button" 
                                                 onClick={() => setShowQualification(true)}
                                                 className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 py-4 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors"
                                             >
                                                 Review Qualification
                                             </button>
                                         ) : (
                                             <button type="button" 
                                                 onClick={handleAdvanceRound}
                                                 className="flex-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 py-4 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors"
                                             >
                                                 Advance Stage
                                             </button>
                                         )}
                                     </div>
                                     {roundStatus.totalMatches > 0 && !roundStatus.complete && (
                                         <p className="text-[10px] text-gray-500 mt-2 text-center">
                                             {roundStatus.completedMatches}/{roundStatus.totalMatches} matches completed
                                         </p>
                                     )}
                                 </div>
                             </div>

                             {/* ── Discord Announcements ── */}
                             <div className="bg-card/50 p-4 sm:p-8 rounded-2xl sm:rounded-[2rem] border border-[#5865F2]/20">
                                 <div className="flex items-center gap-3 mb-6">
                                     <div className="p-2 bg-[#5865F2]/10 rounded-xl border border-[#5865F2]/20">
                                         <Send className="w-4 h-4 text-[#5865F2]" />
                                     </div>
                                     <div>
                                         <h3 className="text-sm font-black text-white uppercase tracking-widest">Discord Announcements</h3>
                                         <p className="text-[10px] text-gray-500 font-bold mt-0.5">
                                             Posts to #{tournament.matchType === 'scrims' ? 'scrims' : 'tournaments'} channel
                                         </p>
                                     </div>
                                 </div>

                                 {/* Group selector for match-specific announces */}
                                 {(tournament.groups?.length ?? 0) > 0 && (
                                     <div className="mb-6">
                                         <label htmlFor="target-group" className="text-[10px] text-gray-500 font-black uppercase tracking-widest block mb-2">
                                             Target Group (for Game Start / Reminder)
                                         </label>
                                         <select
                                             id="target-group"
                                             value={gameStartGroupId}
                                             onChange={e => setGameStartGroupId(e.target.value)}
                                             aria-label="Select group for Discord announcement"
                                             className="bg-dark border border-gray-800 rounded-full px-5 py-3 text-white text-xs font-black uppercase tracking-widest focus:border-[#5865F2] focus-visible:outline-none transition w-full sm:w-auto"
                                         >
                                             <option value="">All Groups</option>
                                             {tournament.groups?.map(g => (
                                                 <option key={g.id} value={g.id}>{g.name}</option>
                                             ))}
                                         </select>
                                     </div>
                                 )}

                                 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                                     {[
                                         { action: 'publish',    label: 'Publish',      color: 'text-[#5865F2] border-[#5865F2]/20 bg-[#5865F2]/10 hover:bg-[#5865F2]/20' },
                                         { action: 'live',       label: '🔴 Go Live',   color: 'text-red-400 border-red-500/20 bg-red-500/10 hover:bg-red-500/20' },
                                         { action: 'group_draw', label: 'Group Draw',   color: 'text-yellow-400 border-yellow-500/20 bg-yellow-500/10 hover:bg-yellow-500/20' },
                                         { action: 'game_start', label: 'Match Start',  color: 'text-pink-400 border-pink-500/20 bg-pink-500/10 hover:bg-pink-500/20' },
                                         { action: 'game_time',  label: 'Time Remind',  color: 'text-purple-400 border-purple-500/20 bg-purple-500/10 hover:bg-purple-500/20' },
                                         { action: 'completed',  label: 'Completed',    color: 'text-green-400 border-green-500/20 bg-green-500/10 hover:bg-green-500/20' },
                                     ].map(btn => (
                                         <button
                                             key={btn.action}
                                             onClick={() => handleDiscord(btn.action)}
                                             disabled={discordSending !== null}
                                             className={`flex flex-col items-center justify-center gap-2 py-4 px-3 rounded-2xl border font-black text-[10px] uppercase tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${btn.color}`}
                                         >
                                             {discordSending === btn.action ? (
                                                 <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                             ) : (
                                                 <Send className="w-4 h-4" />
                                             )}
                                             {btn.label}
                                         </button>
                                     ))}
                                 </div>
                             </div>
                        </motion.div>
    );
};
