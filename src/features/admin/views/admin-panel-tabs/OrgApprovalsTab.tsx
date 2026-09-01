import { sanitizeUrl } from '../../../../shared/utils/utils';
import React from 'react';
import {Check, ExternalLink, CheckCircle} from 'lucide-react';

import { AdminPanelTabProps } from './types';

export const OrgApprovalsTab: React.FC<AdminPanelTabProps> = (props) => {
    const { handleApproveOrg, handleRejectOrg, orgApplications } = props;
    return (
                <div className="bg-card p-6 rounded-2xl border border-slate-800">
                    <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-widest border-b border-slate-700 pb-2 flex items-center gap-2">
                        <Check className="text-brand-500" /> Organization Approvals
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {orgApplications.length > 0 ? (
                            orgApplications.map(app => (
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
                                        <button type="button" onClick={() => handleRejectOrg(app)} className="flex-1 bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/30 hover:border-red-500 py-2.5 rounded-xl text-xs font-bold uppercase transition-colors">
                                            Reject
                                        </button>
                                        <button type="button" onClick={() => handleApproveOrg(app)} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-2.5 rounded-xl text-xs font-bold uppercase transition-colors">
                                            Approve
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-500">
                                <CheckCircle className="w-12 h-12 mb-3 opacity-20" />
                                <p className="text-sm font-bold uppercase tracking-widest">No pending applications</p>
                            </div>
                        )}
                    </div>
                </div>
    );
};
