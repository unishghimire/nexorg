import React, { useState } from 'react';
import {Users, X, Trash, Edit, CheckCircle} from 'lucide-react';

import { AdminPanelTabProps } from './types';

export const OrganizersTab: React.FC<AdminPanelTabProps> = (props) => {
    const { formatCurrency, handleSaveOrgDetails, handleSuspendOrg, isOrgEditModalOpen, orgDiscord, orgEmail, orgNameEdit, orgWhatsapp, orgYoutube, organizers, setIsOrgEditModalOpen, setOrgDiscord, setOrgEmail, setOrgNameEdit, setOrgWhatsapp, setOrgYoutube, togglePowerOrganizer, setEditingOrg } = props;
    const [processingId, setProcessingId] = useState<string | null>(null);
    return (
                <div className="bg-card p-6 rounded-xl border border-slate-800 space-y-6">
                    <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                        <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-2">
                            <Users className="text-brand-500" /> Manage Organizers
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {organizers.map(org => (
                            <div key={org.uid} className="bg-dark p-5 rounded-2xl border border-slate-800 space-y-4 relative overflow-hidden group">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-brand-600/20 rounded-full flex items-center justify-center border border-brand-500/30">
                                            <Users className="text-brand-500 w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white">{org.username}</h3>
                                            <div className="flex items-center gap-2">
                                                <p className="text-[10px] text-slate-400 uppercase font-bold">{org.orgName || 'No Org Name'}</p>
                                                <span className="text-[10px] bg-brand-600/10 text-brand-400 px-1.5 py-0.5 rounded border border-brand-500/20 uppercase font-black">{org.role}</span>
                                            </div>
                                            <button type="button"
                                                onClick={() => togglePowerOrganizer(org)}
                                                className={`mt-1 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded ${org.isPowerOrganizer ? 'bg-green-600/20 text-green-500' : 'bg-surface/20 text-slate-400'}`}
                                            >
                                                {org.isPowerOrganizer ? <CheckCircle className="w-3 h-3" /> : <X className="w-3 h-3" />}
                                                {org.isPowerOrganizer ? 'Power' : 'Standard'}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button type="button" 
                                            onClick={() => {
                                                setEditingOrg(org);
                                                setOrgEmail(org.email || '');
                                                setOrgDiscord(org.discord || '');
                                                setOrgYoutube(org.youtube || '');
                                                setOrgWhatsapp(org.whatsapp || '');
                                                setOrgNameEdit(org.orgName || '');
                                                setIsOrgEditModalOpen(true);
                                            }}
                                            className="p-2 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded-xl transition-colors border border-blue-500/30"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button type="button" 
                                            onClick={() => handleSuspendOrg(org.uid, !org.isBanned)}
                                            className={`p-2 rounded-xl transition-colors border ${
                                                org.isBanned 
                                                    ? 'bg-green-600/20 hover:bg-green-600 text-green-400 hover:text-white border-green-500/30' 
                                                    : 'bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border-red-500/30'
                                            }`}
                                        >
                                            {org.isBanned ? <CheckCircle className="w-4 h-4" /> : <Trash className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                                    <div className="bg-dark/40 p-2 rounded-lg border border-slate-800">
                                        <div className="text-slate-500 uppercase font-bold mb-0.5">Email</div>
                                        <div className="text-slate-300 truncate">{org.email}</div>
                                    </div>
                                    <div className="bg-dark/40 p-2 rounded-lg border border-slate-800">
                                        <div className="text-slate-500 uppercase font-bold mb-0.5">Status</div>
                                        <div className={`font-bold ${org.isBanned ? 'text-red-500' : 'text-green-500'}`}>
                                            {org.isBanned ? 'SUSPENDED' : 'ACTIVE'}
                                        </div>
                                    </div>
                                    <div className="bg-dark/40 p-2 rounded-lg border border-slate-800">
                                        <div className="text-slate-500 uppercase font-bold mb-0.5">Org Wallet</div>
                                        <div className="text-brand-400 font-bold">{formatCurrency(org.orgWalletBalance || 0)}</div>
                                    </div>
                                    <div className="bg-dark/40 p-2 rounded-lg border border-slate-800">
                                        <div className="text-slate-500 uppercase font-bold mb-0.5">Pending</div>
                                        <div className="text-yellow-500 font-bold">{formatCurrency(org.orgPendingEarnings || 0)}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {isOrgEditModalOpen && (
                        <div className="fixed inset-0 modal-backdrop backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                            <div className="bg-card w-full max-w-md rounded-2xl border border-slate-800 p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar">
                                <h3 className="text-xl font-bold text-white uppercase tracking-widest border-b border-slate-800 pb-4">
                                    Edit Organizer Details
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <label htmlFor="org-name" className="text-xs text-slate-400 uppercase font-bold mb-1 block">Organization Name</label>
                                        <input type="text" value={orgNameEdit} onChange={e => setOrgNameEdit(e.target.value)} className="w-full bg-dark border border-slate-700 rounded-lg p-3 text-white focus:border-brand-500 focus-visible:outline-none" />
                                    </div>
                                    <div>
                                        <label htmlFor="org-email" className="text-xs text-slate-400 uppercase font-bold mb-1 block">Email</label>
                                        <input type="email" value={orgEmail} onChange={e => setOrgEmail(e.target.value)} className="w-full bg-dark border border-slate-700 rounded-lg p-3 text-white focus:border-brand-500 focus-visible:outline-none" />
                                    </div>
                                    <div>
                                        <label htmlFor="org-whatsapp" className="text-xs text-slate-400 uppercase font-bold mb-1 block">WhatsApp</label>
                                        <input type="text" value={orgWhatsapp} onChange={e => setOrgWhatsapp(e.target.value)} className="w-full bg-dark border border-slate-700 rounded-lg p-3 text-white focus:border-brand-500 focus-visible:outline-none" />
                                    </div>
                                    <div>
                                        <label htmlFor="org-discord" className="text-xs text-slate-400 uppercase font-bold mb-1 block">Discord</label>
                                        <input type="text" value={orgDiscord} onChange={e => setOrgDiscord(e.target.value)} className="w-full bg-dark border border-slate-700 rounded-lg p-3 text-white focus:border-brand-500 focus-visible:outline-none" />
                                    </div>
                                    <div>
                                        <label htmlFor="org-youtube" className="text-xs text-slate-400 uppercase font-bold mb-1 block">YouTube</label>
                                        <input type="text" value={orgYoutube} onChange={e => setOrgYoutube(e.target.value)} className="w-full bg-dark border border-slate-700 rounded-lg p-3 text-white focus:border-brand-500 focus-visible:outline-none" />
                                    </div>
                                </div>
                                <div className="flex gap-4 pt-4">
                                    <button type="button" onClick={() => setIsOrgEditModalOpen(false)} className="flex-1 bg-surface hover:bg-surface text-white py-3 rounded-xl font-bold transition">Cancel</button>
                                    <button type="button" onClick={handleSaveOrgDetails} className="flex-1 bg-brand-600 hover:bg-brand-500 text-white py-3 rounded-xl font-bold transition">Save Changes</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
    );
};
