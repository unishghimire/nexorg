import React from 'react';
import {Users, X, Edit, Megaphone, Trophy} from 'lucide-react';

import { AdminPanelTabProps } from './types';

export const OrgTournamentsTab: React.FC<AdminPanelTabProps> = (props) => {
    const { fetchOrgTournaments, formatGameName, handleCancelTournament, handleEditTournament, handleToggleFeatured, handleViewParticipants, orgTournaments, organizers, selectedOrgId } = props;
    return (
                <div className="bg-card p-6 rounded-2xl border border-slate-800 space-y-6">
                    <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                        <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-2">
                            <Trophy className="text-brand-500" /> Organization Tournaments
                        </h2>
                        <select 
                            value={selectedOrgId}
                            onChange={(e) => fetchOrgTournaments(e.target.value)}
                            className="bg-dark border border-slate-700 rounded-lg p-2 text-white text-sm focus:border-brand-500 focus-visible:outline-none"
                        >
                            <option value="">Select Organization</option>
                            {organizers.map(org => (
                                <option key={org.uid} value={org.uid}>{org.username}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {orgTournaments.length > 0 ? (
                            orgTournaments.map(t => (
                                <div key={t.id} className="bg-dark p-4 rounded-xl border border-slate-800 space-y-3">
                                    <img src={t.bannerUrl || undefined} className="w-full aspect-video object-cover rounded-lg" alt={t.title} loading="lazy" />
                                    <div>
                                        <h3 className="font-bold text-white truncate">{t.title}</h3>
                                        <div className="flex justify-between items-center mt-2">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold">{formatGameName(t.game)}</span>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                                    t.status === 'upcoming' ? 'bg-blue-600/20 text-blue-400' :
                                                    t.status === 'live' ? 'bg-green-600/20 text-green-400' :
                                                    t.status === 'cancelled' ? 'bg-red-600/20 text-red-400' :
                                                    'bg-surface/20 text-gray-400'
                                                }`}>
                                                    {t.status}
                                                </span>
                                                <div className="flex gap-1">
                                                    <button type="button" 
                                                        onClick={() => handleViewParticipants(t)}
                                                        className="p-1.5 bg-brand-600/20 hover:bg-brand-600 text-brand-500 hover:text-white rounded-lg transition-colors border border-brand-500/30"
                                                        title="View Participants"
                                                    >
                                                        <Users className="w-3 h-3" />
                                                    </button>
                                                    <button type="button" 
                                                        onClick={() => handleEditTournament(t)}
                                                        className="p-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg transition-colors border border-blue-500/30"
                                                        title="Edit Tournament"
                                                    >
                                                        <Edit className="w-3 h-3" />
                                                    </button>
                                                    <button type="button" 
                                                        onClick={() => handleToggleFeatured(t)}
                                                        className={`p-1.5 rounded-lg transition-colors border ${
                                                            t.isFeatured 
                                                                ? 'bg-yellow-600/20 text-yellow-500 border-yellow-500/30 hover:bg-yellow-600 hover:text-white' 
                                                                : 'bg-surface/20 text-gray-400 border-gray-500/30 hover:bg-surface hover:text-white'
                                                        }`}
                                                        title={t.isFeatured ? "Unfeature" : "Feature"}
                                                    >
                                                        <Megaphone className="w-3 h-3" />
                                                    </button>
                                                    {t.status !== 'cancelled' && t.status !== 'completed' && (
                                                        <button type="button" 
                                                            onClick={() => handleCancelTournament(t)}
                                                            className="p-1.5 bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white rounded-lg transition-colors border border-red-500/30"
                                                            title="Cancel Tournament"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : selectedOrgId ? (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-500">
                                <Trophy className="w-12 h-12 mb-3 opacity-20" />
                                <p className="text-sm font-bold uppercase tracking-widest">No tournaments found for this organization</p>
                            </div>
                        ) : (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-500">
                                <Users className="w-12 h-12 mb-3 opacity-20" />
                                <p className="text-sm font-bold uppercase tracking-widest">Select an organization to view their tournaments</p>
                            </div>
                        )}
                    </div>
                </div>
    );
};
