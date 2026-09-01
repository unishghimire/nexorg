import React from 'react';
import { motion } from 'motion/react';
import {
    Plus, Trash2, Save, XCircle,
    } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../../shared/config/firebase';
import { TournamentAdminTabProps } from './types';

export const SettingsTab: React.FC<TournamentAdminTabProps> = (props) => {
    const {
        tournament, setTournament, showToast,
    } = props;
    return (
                        <motion.div 
                            key="settings"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="bg-surface p-4 sm:p-8 rounded-2xl sm:rounded-3xl border border-gray-800 space-y-6 sm:space-y-8"
                        >
                            <div>
                                <h2 className="text-xl font-black uppercase tracking-tighter text-white mb-2">Automated Point System</h2>
                                <p className="text-gray-500 text-sm font-medium">Configure how points are calculated for uploaded match results.</p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
                                <div className="space-y-6">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-brand-500 border-b border-gray-800 pb-2">Scoring Rules</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label htmlFor="points-per-kill" className="block text-[10px] font-black text-gray-500 uppercase mb-2 tracking-widest">Points Per Kill</label>
                                            <input 
                                                id="points-per-kill"
                                                type="number"
                                                value={tournament.pointSystem?.pointsPerKill ?? 1}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value) || 0;
                                                    setTournament({...tournament, pointSystem: { ...tournament.pointSystem!, pointsPerKill: val }});
                                                }}
                                                className="w-full bg-dark border border-gray-800 text-white rounded-xl p-3 focus:border-brand-500 focus-visible:outline-none transition font-black"
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="placement-scale" className="block text-[10px] font-black text-gray-500 uppercase mb-2 tracking-widest">Placement Scale</label>
                                            <div className="text-[10px] text-gray-400 mb-2 font-bold italic">Configured in placement points list</div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label htmlFor="placement-points" className="block text-[10px] font-black text-gray-500 uppercase mb-2 tracking-widest flex justify-between">
                                            Placement Points
                                            <button type="button" 
                                                onClick={() => {
                                                    const current = tournament!.pointSystem?.placementPoints || [];
                                                    const nextRank = current.length + 1;
                                                    const newList = [...current, { rank: nextRank, points: 0 }];
                                                    setTournament({...tournament!, pointSystem: { ...tournament!.pointSystem!, placementPoints: newList }});
                                                }}
                                                className="text-brand-500 hover:text-brand-400 normal-case"
                                            >
                                                + Add Rank
                                            </button>
                                        </label>
                                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-2 pr-2">
                                            {tournament.pointSystem?.placementPoints?.map((p, idx) => (
                                                <div key={idx} className="flex items-center gap-3 bg-dark p-2 rounded-xl border border-gray-800 group">
                                                    <span className="w-8 text-center text-xs font-black text-gray-600">#{p.rank}</span>
                                                    <input 
                                                        type="number"
                                                        value={p.points}
                                                        onChange={(e) => {
                                                            const val = parseInt(e.target.value) || 0;
                                                            const newList = [...(tournament!.pointSystem?.placementPoints || [])];
                                                            newList[idx].points = val;
                                                            setTournament({...tournament!, pointSystem: { ...tournament!.pointSystem!, placementPoints: newList }});
                                                        }}
                                                        className="flex-1 bg-surface border border-gray-800 text-white rounded-lg p-2 text-sm focus:border-brand-500 focus-visible:outline-none font-bold"
                                                    />
                                                    <button type="button" 
                                                        onClick={() => {
                                                            const newList = tournament!.pointSystem?.placementPoints?.filter((_, i) => i !== idx);
                                                            setTournament({...tournament!, pointSystem: { ...tournament!.pointSystem!, placementPoints: newList }});
                                                        }}
                                                        className="p-2 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-brand-500 border-b border-gray-800 pb-2">Additional Bonuses</h3>
                                    <div className="bg-dark p-4 rounded-2xl border border-gray-800 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-black text-white">Winner Bonus</p>
                                                <p className="text-xs text-gray-500">Extra points for #1 placement</p>
                                            </div>
                                            <input 
                                                type="number"
                                                value={tournament.pointSystem?.winnerBonus || 0}
                                                onChange={(e) => setTournament({
                                                    ...tournament,
                                                    pointSystem: { ...tournament.pointSystem, winnerBonus: parseInt(e.target.value) || 0 }
                                                })}
                                                placeholder="0"
                                                className="w-16 bg-surface border border-gray-800 text-white rounded-lg p-2 text-center text-sm font-bold"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-black text-white">Consistency Bonus</p>
                                                <p className="text-xs text-gray-500">Points for 3+ consecutive kills</p>
                                            </div>
                                            <input 
                                                type="number"
                                                value={tournament.pointSystem?.consistencyBonus || 0}
                                                onChange={(e) => setTournament({
                                                    ...tournament,
                                                    pointSystem: { ...tournament.pointSystem, consistencyBonus: parseInt(e.target.value) || 0 }
                                                })}
                                                placeholder="0"
                                                className="w-16 bg-surface border border-gray-800 text-white rounded-lg p-2 text-center text-sm font-bold"
                                            />
                                        </div>
                                    </div>

                                    <button type="button" 
                                        onClick={async () => {
                                            if (!tournament) return;
                                            try {
                                                const tRef = doc(db, 'tournaments', tournament.id);
                                                await updateDoc(tRef, { pointSystem: tournament.pointSystem });
                                                showToast('Point System saved!', 'success');
                                            } catch (error) {
                                                showToast('Failed to save point system', 'error');
                                            }
                                        }}
                                        className="w-full bg-brand-600 hover:bg-brand-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-brand-600/20 transition-colors active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <Save className="w-5 h-5" /> Save Configuration
                                    </button>
                                </div>
                            </div>

                            <div className="border-t border-gray-800 pt-8 space-y-6">
                                <div>
                                    <h3 className="text-lg font-black uppercase tracking-tighter text-white mb-2">Tournament Roadmap</h3>
                                    <p className="text-gray-500 text-sm font-medium">Define the timeline and stages of the tournament for the public roadmap view.</p>
                                </div>
                                
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                                    {(tournament.roadmap || []).map((step, idx) => (
                                        <div key={idx} className="bg-dark p-4 sm:p-6 rounded-2xl border border-gray-800 space-y-3 sm:space-y-4 group relative shadow-2xl hover:border-brand-500/30 transition-colors">
                                            <button type="button" 
                                                onClick={() => {
                                                    const newList = (tournament.roadmap || []).filter((_, i) => i !== idx);
                                                    setTournament({...tournament, roadmap: newList});
                                                }}
                                                className="absolute -top-2 -right-2 bg-red-600 p-1.5 rounded-full text-white opacity-0 group-hover:opacity-100 transition-colors shadow-lg"
                                            >
                                                <XCircle className="w-3 h-3" />
                                            </button>
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] text-brand-500 font-black uppercase tracking-widest">Stage {idx + 1}</span>
                                                <select 
                                                    value={(step as any).status || 'upcoming'}
                                                    onChange={(e) => {
                                                        const newList = [...(tournament.roadmap || [])];
                                                        (newList[idx] as any).status = e.target.value;
                                                        setTournament({...tournament, roadmap: newList});
                                                    }}
                                                    className="bg-black/50 border border-white/10 rounded text-[10px] font-black uppercase text-gray-400 px-1"
                                                >
                                                    <option value="upcoming">Upcoming</option>
                                                    <option value="current">Current</option>
                                                    <option value="completed">Completed</option>
                                                </select>
                                            </div>
                                            <input 
                                                type="text" 
                                                value={(step as any).stageName || `Round ${step.roundNumber}`}
                                                onChange={(e) => {
                                                    const newList = [...(tournament.roadmap || [])];
                                                    (newList[idx] as any).stageName = e.target.value;
                                                    setTournament({...tournament, roadmap: newList});
                                                }}
                                                placeholder="Stage Name"
                                                className="w-full bg-surface border border-gray-800 text-white rounded-lg p-2 text-sm font-black focus-visible:outline-none focus:border-brand-500"
                                            />
                                            <div className="flex gap-2">
                                                <div className="flex-1">
                                                    <label aria-label={`Qualifiers for round ${idx + 1}`} className="block text-[10px] text-gray-600 font-black uppercase mb-1">Qualifiers</label>
                                                    <input 
                                                        type="number"
                                                        value={step.qualificationRule}
                                                        onChange={(e) => {
                                                            const newList = [...(tournament.roadmap || [])];
                                                            newList[idx].qualificationRule = parseInt(e.target.value) || 0;
                                                            setTournament({...tournament, roadmap: newList});
                                                        }}
                                                        className="w-full bg-surface border border-gray-800 text-white rounded-lg p-2 text-xs font-mono"
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <label aria-label={`Groups for round ${idx + 1}`} className="block text-[10px] text-gray-600 font-black uppercase mb-1">Groups</label>
                                                    <input 
                                                        type="number"
                                                        value={step.numGroups}
                                                        onChange={(e) => {
                                                            const newList = [...(tournament.roadmap || [])];
                                                            newList[idx].numGroups = parseInt(e.target.value) || 1;
                                                            setTournament({...tournament, roadmap: newList});
                                                        }}
                                                        className="w-full bg-surface border border-gray-800 text-white rounded-lg p-2 text-xs font-mono"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <button type="button" 
                                        onClick={() => {
                                            const current = tournament.roadmap || [];
                                            const nextRound = current.length + 1;
                                            const newList = [...current, { roundNumber: nextRound, numGroups: 1, qualificationRule: 1, maps: [], status: 'upcoming', stageName: '' } as any];
                                            setTournament({...tournament, roadmap: newList});
                                        }}
                                        className="h-full min-h-[160px] border-2 border-dashed border-gray-800 hover:border-brand-500/50 rounded-2xl flex flex-col items-center justify-center gap-2 text-gray-600 hover:text-brand-500 transition-colors group"
                                    >
                                        <Plus className="w-8 h-8 group-hover:scale-110 transition-transform" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Add Roadmap Stage</span>
                                    </button>
                                </div>

                                <div className="flex justify-end pt-4">
                                    <button type="button" 
                                        onClick={async () => {
                                            try {
                                                const tRef = doc(db, 'tournaments', tournament.id);
                                                await updateDoc(tRef, { roadmap: tournament.roadmap });
                                                showToast('Roadmap saved successfully!', 'success');
                                            } catch (error) {
                                                showToast('Failed to save roadmap', 'error');
                                            }
                                        }}
                                        className="bg-brand-600 hover:bg-brand-500 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-brand-600/20 transition-colors active:scale-95 flex items-center gap-2"
                                    >
                                        <Save className="w-5 h-5" /> Save Roadmap
                                    </button>
                                </div>
                            </div>
                        </motion.div>
    );
};
