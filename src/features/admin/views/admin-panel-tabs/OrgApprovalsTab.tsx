import { sanitizeUrl } from '../../../../shared/utils/utils';
import React, { useState } from 'react';
import { Check, ExternalLink, CheckCircle, Trophy, Zap, Building2, ShieldCheck, MessageSquare } from 'lucide-react';
import { AdminPanelTabProps } from './types';

export const OrgApprovalsTab: React.FC<AdminPanelTabProps> = (props) => {
    const {
        handleApproveOrg,
        handleRejectOrg,
        orgApplications = [],
        handleApprovePowerOrg,
        handleRejectPowerOrg,
        powerOrgApplications = []
    } = props;

    const pendingStandardList = orgApplications;
    const pendingPowerList = (powerOrgApplications || []).filter((a: any) => a.status === 'pending');

    const [subTab, setSubTab] = useState<'standard' | 'power'>(() => {
        return pendingPowerList.length > 0 && pendingStandardList.length === 0 ? 'power' : 'standard';
    });

    return (
        <div className="bg-card p-6 rounded-2xl border border-slate-800 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700 pb-4">
                <div>
                    <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-2">
                        <Check className="text-brand-500" /> Approvals & Verification
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                        Review organizer tier upgrades and new organization onboarding applications.
                    </p>
                </div>

                {/* Sub Tab Switcher */}
                <div className="flex bg-dark/70 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
                    <button
                        type="button"
                        onClick={() => setSubTab('standard')}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                            subTab === 'standard'
                                ? 'bg-slate-700 text-white shadow'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>Org Requests</span>
                        {pendingStandardList.length > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                {pendingStandardList.length}
                            </span>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => setSubTab('power')}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                            subTab === 'power'
                                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-dark shadow font-black'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <Zap className="w-3.5 h-3.5 fill-current" />
                        <span>Power Org Applications</span>
                        {pendingPowerList.length > 0 && (
                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                                subTab === 'power'
                                    ? 'bg-dark/40 text-dark border border-dark/30'
                                    : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                            }`}>
                                {pendingPowerList.length}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Standard Org Applications */}
            {subTab === 'standard' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {pendingStandardList.length > 0 ? (
                        pendingStandardList.map((app: any) => (
                            <div key={app.id} className="bg-dark p-6 rounded-2xl border border-slate-800 space-y-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-lg font-bold text-white">{app.orgName}</h3>
                                        <p className="text-xs text-slate-400">Applied by: {app.username}</p>
                                    </div>
                                    <span className="bg-yellow-600/20 text-yellow-500 text-[10px] font-bold px-2 py-0.5 rounded uppercase border border-yellow-500/30">
                                        Pending
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                    <div className="bg-dark/40 p-3 rounded-xl border border-slate-800">
                                        <div className="text-slate-400 uppercase font-bold text-[10px] mb-1">WhatsApp</div>
                                        <div className="text-white">{app.whatsapp}</div>
                                    </div>
                                    <div className="bg-dark/40 p-3 rounded-xl border border-slate-800">
                                        <div className="text-slate-400 uppercase font-bold text-[10px] mb-1">Email</div>
                                        <div className="text-white truncate">{app.email}</div>
                                    </div>
                                </div>
                                <div className="bg-dark/40 p-3 rounded-xl border border-slate-800">
                                    <div className="text-slate-400 uppercase font-bold text-[10px] mb-1">Proof Link</div>
                                    <a href={sanitizeUrl(app.proofLink)} target="_blank" rel="noreferrer" className="text-brand-400 hover:text-brand-300 flex items-center gap-2 truncate">
                                        <ExternalLink className="w-3 h-3" /> {app.proofLink}
                                    </a>
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => handleRejectOrg?.(app)}
                                        className="flex-1 bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/30 hover:border-red-500 py-2.5 rounded-xl text-xs font-bold uppercase transition-colors"
                                    >
                                        Reject
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleApproveOrg?.(app)}
                                        className="flex-1 bg-green-600 hover:bg-green-500 text-white py-2.5 rounded-xl text-xs font-bold uppercase transition-colors"
                                    >
                                        Approve
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-500">
                            <CheckCircle className="w-12 h-12 mb-3 opacity-20" />
                            <p className="text-sm font-bold uppercase tracking-widest">No pending organization requests</p>
                        </div>
                    )}
                </div>
            )}

            {/* Power Organizer Applications */}
            {subTab === 'power' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {pendingPowerList.length > 0 ? (
                        pendingPowerList.map((app: any) => (
                            <div key={app.id} className="bg-dark p-6 rounded-2xl border border-yellow-500/20 relative overflow-hidden space-y-4 shadow-lg shadow-black/40">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-2xl pointer-events-none" />

                                <div className="flex justify-between items-start gap-2">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-lg font-bold text-white">{app.orgName}</h3>
                                            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                                                <Zap className="w-3 h-3 fill-current" />
                                                Tier Upgrade
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-400 mt-0.5">Applicant: {app.username} ({app.userId})</p>
                                    </div>
                                    <span className="bg-yellow-600/20 text-yellow-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase border border-yellow-500/30 whitespace-nowrap">
                                        Pending Review
                                    </span>
                                </div>

                                {/* Scrim Milestone Verification Badge */}
                                <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-yellow-500/10 via-amber-500/5 to-transparent border border-yellow-500/20">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-lg bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center text-yellow-400">
                                            <Trophy className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                                {app.completedScrimsCount || 0} Authentic Scrims Hosted
                                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 inline" />
                                            </div>
                                            <div className="text-[11px] text-slate-400">
                                                {app.completedScrimsCount >= 20 ? (
                                                    <span className="text-emerald-400 font-semibold">✓ Meets 20+ scrims requirement</span>
                                                ) : (
                                                    <span className="text-yellow-400 font-semibold">Under standard threshold ({app.completedScrimsCount}/20)</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-mono uppercase px-2 py-1 rounded bg-black/40 text-slate-300 border border-slate-800">
                                        Verified
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                    <div className="bg-dark/40 p-3 rounded-xl border border-slate-800">
                                        <div className="text-slate-400 uppercase font-bold text-[10px] mb-1">WhatsApp</div>
                                        <div className="text-white">{app.whatsapp || 'N/A'}</div>
                                    </div>
                                    <div className="bg-dark/40 p-3 rounded-xl border border-slate-800">
                                        <div className="text-slate-400 uppercase font-bold text-[10px] mb-1">Email</div>
                                        <div className="text-white truncate">{app.email || 'N/A'}</div>
                                    </div>
                                </div>

                                {app.proofLink && (
                                    <div className="bg-dark/40 p-3 rounded-xl border border-slate-800 text-xs">
                                        <div className="text-slate-400 uppercase font-bold text-[10px] mb-1">Community / Proof Link</div>
                                        <a
                                            href={sanitizeUrl(app.proofLink)}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-brand-400 hover:text-brand-300 flex items-center gap-2 truncate"
                                        >
                                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                            <span className="truncate">{app.proofLink}</span>
                                        </a>
                                    </div>
                                )}

                                {app.notes && (
                                    <div className="bg-dark/40 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
                                        <div className="text-slate-400 uppercase font-bold text-[10px] flex items-center gap-1.5">
                                            <MessageSquare className="w-3 h-3 text-amber-400" />
                                            Organizer Pitch & Track Record
                                        </div>
                                        <p className="text-slate-300 italic text-[11px] leading-relaxed">
                                            "{app.notes}"
                                        </p>
                                    </div>
                                )}

                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => handleRejectPowerOrg?.(app)}
                                        className="flex-1 bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/30 hover:border-red-500 py-2.5 rounded-xl text-xs font-bold uppercase transition-colors"
                                    >
                                        Reject
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleApprovePowerOrg?.(app)}
                                        className="flex-1 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-dark font-black py-2.5 rounded-xl text-xs uppercase transition-all shadow-md shadow-yellow-500/20 flex items-center justify-center gap-1.5"
                                    >
                                        <Zap className="w-3.5 h-3.5 fill-current" />
                                        Grant Power Status
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-500">
                            <Trophy className="w-12 h-12 mb-3 opacity-20 text-yellow-500" />
                            <p className="text-sm font-bold uppercase tracking-widest">No pending Power Organizer applications</p>
                            <p className="text-xs text-slate-500 mt-1">
                                Organizers submit applications once reaching 20 authentic scrims.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
