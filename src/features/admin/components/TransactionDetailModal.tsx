import React, { useState } from 'react';
import { X, CreditCard, Layout, Info, Eye, Image as ImageIcon } from 'lucide-react';
import { Transaction } from '../../../shared/types/types';
import { formatCurrency, sanitizeUrl } from '../../../shared/utils/utils';

interface TransactionDetailModalProps {
    selectedTx: Transaction;
    onClose: () => void;
    onDashboard: () => void;
    onApprove: (tx: Transaction) => void;
    onReject: (tx: Transaction) => void;
    onRefund: (tx: Transaction) => void;
    rejectionReason: string;
    setRejectionReason: (val: string) => void;
    getRelativeTime: (timestamp: any) => string;
}

const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
    selectedTx,
    onClose,
    onDashboard,
    onApprove,
    onReject,
    onRefund,
    rejectionReason,
    setRejectionReason,
    getRelativeTime
}) => {
    const [processing, setProcessing] = useState(false);

    const handleAction = async (action: 'approve' | 'reject' | 'refund') => {
        if (processing) return;
        setProcessing(true);
        try {
            if (action === 'approve') await onApprove(selectedTx);
            else if (action === 'reject') await onReject(selectedTx);
            else if (action === 'refund') await onRefund(selectedTx);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 modal-backdrop backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-card w-full max-w-2xl rounded-3xl border border-slate-800 p-4 sm:p-8 space-y-6 sm:space-y-8 shadow-2xl overflow-y-auto max-h-[90vh]">
                <div className="flex justify-between items-center border-b border-slate-800 pb-5">
                    <div className="flex items-center gap-4">
                        <h3 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                            <CreditCard className="text-brand-500" /> Review Transaction
                        </h3>
                        <button type="button" 
                            onClick={onDashboard}
                            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20 hover:bg-brand-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest"
                        >
                            <Layout className="w-3 h-3" /> Dashboard
                        </button>
                    </div>
                    <button type="button" aria-label="Close modal" onClick={onClose} className="text-slate-400 hover:text-white bg-dark min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full transition"><X className="w-5 h-5" /></button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <div className="bg-dark p-5 rounded-2xl border border-slate-800 shadow-inner">
                            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-3">Transaction Details</div>
                            <div className="flex items-end gap-3 mb-4">
                                <div className="text-3xl font-black text-white tracking-tight">{formatCurrency(Math.abs(selectedTx.amount))}</div>
                                <div className={`text-sm font-bold uppercase mb-1 ${selectedTx.type === 'deposit' ? 'text-green-400' : 'text-red-400'}`}>{selectedTx.type}</div>
                            </div>
                            <div className="space-y-2 text-sm font-mono">
                                <div className="flex justify-between border-b border-slate-800/50 pb-2">
                                    <span className="text-slate-400">Method</span>
                                    <span className="text-white">{selectedTx.method}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-800/50 pb-2">
                                    <span className="text-slate-400">User</span>
                                    <span className="text-white">{selectedTx.username || 'Unknown'}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-800/50 pb-2">
                                    <span className="text-slate-400">Email</span>
                                    <span className="text-white text-xs">{selectedTx.userEmail || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-800/50 pb-2">
                                    <span className="text-slate-400">User ID</span>
                                    <span className="text-slate-400 text-[10px] truncate select-all max-w-[160px] sm:max-w-[220px]">{selectedTx.userId}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-800/50 pb-2">
                                    <span className="text-slate-400">Ref ID</span>
                                    <span className="text-brand-300 text-xs truncate select-all max-w-[160px] sm:max-w-[220px]">{selectedTx.refId}</span>
                                </div>
                                {selectedTx.confirmedByUsername && (
                                    <div className="flex justify-between border-b border-slate-800/50 pb-2">
                                        <span className="text-brand-400">Confirmed By</span>
                                        <span className="text-brand-300">{selectedTx.confirmedByUsername}</span>
                                    </div>
                                )}
                            </div>
                            
                            {selectedTx.accountDetails && (
                                <div className="mt-5 p-4 bg-blue-900/10 border border-blue-500/20 rounded-xl">
                                    <div className="text-[10px] text-blue-400 uppercase font-bold tracking-widest mb-2 flex items-center gap-2">
                                        <Info className="w-3 h-3" /> Account / Transfer Info
                                    </div>
                                    <div className="text-xs text-blue-100 whitespace-pre-wrap font-mono leading-relaxed">{selectedTx.accountDetails}</div>
                                </div>
                            )}
                        </div>

                        <div>
                            <label htmlFor="rejection-reason" className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-2 block">Rejection Reason (Optional)</label>
                            <textarea 
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                className="w-full bg-dark border border-slate-800 rounded-xl p-4 text-white focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 focus-visible:outline-none h-28 text-sm transition-colors"
                                placeholder="Explain why this is being rejected..."
                            />
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-2">Proof of Payment</div>
                        {selectedTx.proofUrl ? (
                            <div className="relative group rounded-2xl overflow-hidden border border-slate-800 bg-black">
                                <img src={selectedTx.proofUrl || undefined} onError={(e) => { e.currentTarget.style.display = "none"; }} className="w-full aspect-square object-contain" alt="Payment proof screenshot" referrerPolicy="no-referrer" loading="lazy" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                                    <a href={sanitizeUrl(selectedTx.proofUrl)} target="_blank" rel="noreferrer" className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors border border-white/10">
                                        <Eye className="w-5 h-5" /> View Full Image
                                    </a>
                                </div>
                            </div>
                        ) : (
                            <div className="w-full aspect-square bg-dark/50 rounded-2xl border-2 border-dashed border-slate-800 flex flex-col items-center justify-center text-slate-500">
                                <ImageIcon className="w-12 h-12 mb-3 opacity-20" />
                                <span className="text-xs font-bold uppercase tracking-widest">No Proof Uploaded</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex gap-4 pt-6 border-t border-slate-800">
                    {selectedTx.status === 'pending' ? (
                        <>
                            <button type="button" onClick={() => handleAction('reject')} disabled={processing} className="flex-1 bg-red-900/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/30 hover:border-red-500 py-4 rounded-xl font-black transition-colors uppercase tracking-widest text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                                {processing ? "Processing..." : "Reject"}
                            </button>
                            <button type="button" onClick={() => handleAction('approve')} disabled={processing} className="flex-[2] bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-600/20 py-4 rounded-xl font-black transition-colors uppercase tracking-widest text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                                {processing ? "Processing..." : "Approve"}
                            </button>
                        </>
                    ) : selectedTx.status === 'success' && (selectedTx.type === 'withdrawal' || selectedTx.type === 'entry_fee') ? (
                        <button type="button" 
                            onClick={() => handleAction('refund')} 
                            disabled={processing}
                            className="w-full bg-orange-600 hover:bg-orange-500 text-white py-4 rounded-xl font-black transition-colors uppercase tracking-widest text-sm shadow-lg shadow-orange-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {processing ? "Processing..." : "Manual Refund"}
                        </button>
                    ) : (
                        <div className="flex gap-4 w-full">
                            <button type="button" 
                                onClick={onDashboard} 
                                className="flex-1 bg-brand-600/20 hover:bg-brand-600 text-brand-400 hover:text-white border border-brand-500/30 hover:border-brand-500 py-4 rounded-xl font-black transition-colors uppercase tracking-widest text-sm"
                            >
                                Dashboard
                            </button>
                            <button type="button" onClick={onClose} className="flex-1 bg-surface hover:bg-surface text-white py-4 rounded-xl font-black transition-colors uppercase tracking-widest text-sm">
                                Close
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TransactionDetailModal;
