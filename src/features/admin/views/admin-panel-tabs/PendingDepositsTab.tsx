import { sanitizeUrl } from '../../../../shared/utils/utils';
import React, { useState } from 'react';
import { ArrowDown, Check, Eye, X } from 'lucide-react';
import { AdminPanelTabProps } from './types';

export const PendingDepositsTab: React.FC<AdminPanelTabProps> = (props) => {
    const { allTransactions, closeConfirmModal, formatCurrency, getRelativeTime, handleApproveTx, handleRejectTx, setConfirmModal, setSelectedTx } = props;
    const [processingId, setProcessingId] = useState<string | null>(null);

    const pendingDeposits = allTransactions.filter(t => t.type === 'deposit' && t.status === 'pending');

    return (
        <div className="bg-card p-6 rounded-2xl border border-slate-800 space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-4 border-b border-slate-700 pb-4">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-2">
                        <ArrowDown className="text-green-500" /> Pending Deposits
                    </h2>
                    <span className="bg-brand-500/20 text-brand-400 text-xs font-bold px-3 py-1 rounded-full border border-brand-500/30">
                        {pendingDeposits.length} Pending
                    </span>
                </div>
                {pendingDeposits.length > 0 && (
                    <div className="flex items-center gap-3">
                        <button type="button" 
                            onClick={() => {
                                setConfirmModal({
                                    isOpen: true,
                                    title: 'Bulk Reject Deposits',
                                    message: 'Are you sure you want to REJECT ALL pending deposits?',
                                    isDestructive: true,
                                    onConfirm: async () => {
                                        for (const t of pendingDeposits) {
                                            setProcessingId(t.id);
                                            try {
                                                if (handleRejectTx) await handleRejectTx(t, 'Bulk rejected by admin');
                                            } finally {
                                                setProcessingId(null);
                                            }
                                        }
                                        closeConfirmModal();
                                    }
                                });
                            }}
                            className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 hover:border-red-500 px-4 py-2 rounded-lg font-bold text-sm transition"
                        >
                            Bulk Reject All
                        </button>
                        <button type="button" 
                            onClick={() => {
                                setConfirmModal({
                                    isOpen: true,
                                    title: 'Bulk Approve Deposits',
                                    message: 'Are you sure you want to approve ALL pending deposits?',
                                    onConfirm: async () => {
                                        for (const t of pendingDeposits) {
                                            setProcessingId(t.id);
                                            try {
                                                await handleApproveTx(t);
                                            } finally {
                                                setProcessingId(null);
                                            }
                                        }
                                        closeConfirmModal();
                                    }
                                });
                            }}
                            className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition shadow-lg shadow-green-600/20"
                        >
                            Bulk Approve All
                        </button>
                    </div>
                )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto custom-scrollbar content-start pr-2">
                {pendingDeposits.length > 0 ? (
                    pendingDeposits.map(t => (
                        <div key={t.id} className="bg-dark/50 hover:bg-dark p-5 rounded-2xl border border-slate-800 hover:border-slate-700 transition-colors shadow-md group">
                            <div className="flex justify-between items-start mb-4 border-b border-slate-800 pb-3">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-black tracking-wider text-green-400 uppercase text-xs">Deposit</span>
                                        <span className="text-[10px] bg-surface px-2 py-0.5 rounded-full text-gray-300 font-bold tracking-wider">{t.method}</span>
                                    </div>
                                    <div className="text-white font-bold text-sm">{t.username || 'Unknown User'}</div>
                                    <div className="text-[10px] text-slate-400 font-mono">{getRelativeTime(t.timestamp)}</div>
                                </div>
                                <div className="text-xl font-black text-white tracking-tight">{formatCurrency(Math.abs(t.amount))}</div>
                            </div>
                            <div className="text-[11px] text-gray-400 mb-3 space-y-2">
                                <div className="bg-dark/40 p-2 rounded-lg border border-slate-800/50 font-mono flex justify-between items-center">
                                    <span className="text-slate-500">REF:</span> 
                                    <span className="text-brand-300 select-all break-all">{t.refId}</span>
                                </div>
                                {t.transactionCode && (
                                    <div className="bg-dark/40 p-2 rounded-lg border border-slate-800/50 font-mono flex justify-between items-center">
                                        <span className="text-slate-500">TX CODE:</span> 
                                        <span className="text-brand-300 select-all break-all">{t.transactionCode}</span>
                                    </div>
                                )}
                                {t.accountDetails && (
                                    <div className="bg-dark/40 p-2 rounded-lg border border-slate-800/50 font-mono flex justify-between items-center">
                                        <span className="text-slate-500">ACC:</span> 
                                        <span className="text-brand-300 select-all break-all">{t.accountDetails}</span>
                                    </div>
                                )}
                            </div>
                            {/* Payment Screenshot Thumbnail */}
                            {t.proofUrl && (
                                <div className="mb-3">
                                    <a href={sanitizeUrl(t.proofUrl)} target="_blank" rel="noreferrer" className="block group/img">
                                        <div className="relative rounded-xl overflow-hidden border border-slate-800 hover:border-brand-500 transition">
                                            <img src={t.proofUrl} alt="Payment proof" className="w-full max-h-48 object-contain bg-black/50 rounded-lg" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = "none"; }} loading="lazy" />
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition flex items-center justify-center">
                                                <span className="text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                                                    <Eye className="w-3 h-3" /> View Full
                                                </span>
                                            </div>
                                        </div>
                                    </a>
                                </div>
                            )}
                            <div className="grid grid-cols-3 gap-2">
                                <button 
                                    type="button" 
                                    onClick={async () => { setProcessingId(t.id); try { await handleApproveTx(t); } finally { setProcessingId(null); } }} 
                                    disabled={processingId === t.id} 
                                    className="bg-green-600/20 hover:bg-green-600 text-green-400 hover:text-white border border-green-500/30 hover:border-green-500 py-2.5 min-h-[44px] rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                                >
                                    <Check className="w-4 h-4 shrink-0" /> Approve
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => handleRejectTx && handleRejectTx(t)} 
                                    disabled={processingId === t.id} 
                                    className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 hover:border-red-500 py-2.5 min-h-[44px] rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                                >
                                    <X className="w-4 h-4 shrink-0" /> Reject
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => setSelectedTx(t)} 
                                    className="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 hover:border-blue-500 py-2.5 min-h-[44px] rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                                >
                                    <Eye className="w-4 h-4 shrink-0" /> Review
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="col-span-full h-full flex flex-col items-center justify-center text-slate-400 py-20">
                        <div className="w-16 h-16 bg-dark rounded-full flex items-center justify-center mb-4 border border-slate-800">
                            <Check className="text-3xl text-green-500/50" />
                        </div>
                        <p className="font-bold uppercase tracking-widest text-sm text-slate-500">All Caught Up!</p>
                        <p className="text-xs text-gray-700 mt-1">No pending deposits to review.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
