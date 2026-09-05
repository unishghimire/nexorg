import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../shared/context/AuthContext';
import { collection, query, where, getDocs, orderBy, limit, addDoc, serverTimestamp, startAfter, QueryDocumentSnapshot } from 'firebase/firestore';
import { db, auth } from '../../../shared/config/firebase';
import { Transaction } from '../../../shared/types/types';
import { formatCurrency, formatDate } from '../../../shared/utils/utils';
import { ArrowUpRight, ArrowDownRight, CheckCircle2, Wallet as WalletIcon, Gift, AlertTriangle, X, ShieldCheck, Download, TrendingUp, ChevronRight, Medal, Trophy } from 'lucide-react';
import WalletModal from '../components/WalletModal';
import { useNotification } from '../../../shared/context/NotificationContext';
import { useInView } from '../../../shared/hooks/useInView';
import { Seo } from '../../../shared/components/Seo';

const Wallet: React.FC = () => {
    const { user, profile } = useAuth();
    const { showToast } = useNotification();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [activeModal, setActiveModal] = useState<'deposit' | 'withdraw' | null>(null);
    
    // Promo Code State
    const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
    const [promoCode, setPromoCode] = useState('');
    const [isRedeeming, setIsRedeeming] = useState(false);

    // Dispute State
    const [disputeModalOpen, setDisputeModalOpen] = useState(false);
    const [selectedTxForDispute, setSelectedTxForDispute] = useState<Transaction | null>(null);
    const [disputeReason, setDisputeReason] = useState('');
    const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);

    // Chart visibility
    const { ref: chartRef, isInView: isChartInView } = useInView({ threshold: 0.1 });

    useEffect(() => {
        if (user) {
            fetchTransactions();
        }
    }, [user]);

    const fetchTransactions = async (isLoadMore = false) => {
        if (!user) return;
        if (isLoadMore) setLoadingMore(true);
        else setLoading(true);
        
        try {
            let q;
            if (isLoadMore && lastDoc) {
                q = query(
                    collection(db, 'transactions'),
                    where('userId', '==', user.uid),
                    orderBy('timestamp', 'desc'),
                    startAfter(lastDoc),
                    limit(10)
                );
            } else {
                q = query(
                    collection(db, 'transactions'),
                    where('userId', '==', user.uid),
                    orderBy('timestamp', 'desc'),
                    limit(5)
                );
            }
            const snap = await getDocs(q);
            const txs = snap.docs.map((d) => { const data = d.data() as Record<string, unknown>; return { id: d.id, ...data } as Transaction; });
            
            if (isLoadMore) {
                setTransactions(prev => [...prev, ...txs]);
            } else {
                setTransactions(txs);
            }
            
            if (snap.docs.length > 0) {
                setLastDoc(snap.docs[snap.docs.length - 1]);
            }
            setHasMore(snap.docs.length === (isLoadMore ? 10 : 5));
        } catch (error: any) {
            console.error("Error fetching transactions:", error);
            setFetchError("Failed to load transactions. Please check your connection.");
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    // Analytics derived from loaded transactions (display-only, not authoritative)
    // ponytail: uses only the paginated subset already fetched — avoids extra reads
    const analytics = useMemo(() => {
        let recentDeposits = 0;
        let recentWithdrawals = 0;
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

        transactions.forEach(tx => {
            if (tx.status === 'success' || tx.status === 'completed') {
                if (tx.type === 'deposit') {
                    recentDeposits += tx.amount;
                } else if (tx.type === 'withdrawal' || tx.type === 'withdraw') {
                    recentWithdrawals += Math.abs(tx.amount);
                }
            }
        });

        const chartData = [...transactions].reverse().map(tx => ({
            name: formatDate(tx.timestamp).split(',')[0],
            amount: tx.amount,
            type: tx.type,
            status: tx.status
        })).filter(tx => tx.status === 'success' || tx.status === 'completed').slice(-15);

        return { recentDeposits, recentWithdrawals, chartData };
    }, [transactions]);

    const handleRedeemPromo = async () => {
        if (!promoCode.trim() || !user) return;
        setIsRedeeming(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error('Authentication required');

            const res = await fetch('/api/wallet/redeem-promo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ code: promoCode.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to redeem promo code');

            showToast(`Successfully redeemed ${formatCurrency(data.amount || 0)}!`, 'success');
            setPromoCode('');
            setIsPromoModalOpen(false);
            
            // Re-fetch transactions
            setLastDoc(null);
            fetchTransactions();
        } catch (error: any) {
            showToast(error.message || 'Failed to redeem promo code', 'error');
        } finally {
            setIsRedeeming(false);
        }
    };

    const handleReportDispute = async () => {
        if (!selectedTxForDispute || !disputeReason.trim() || !user) return;
        setIsSubmittingDispute(true);
        try {
            await addDoc(collection(db, 'disputes'), {
                disputeType: 'payment',
                transactionId: selectedTxForDispute.id,
                refId: selectedTxForDispute.refId || selectedTxForDispute.id,
                userId: user.uid,
                reporterUid: user.uid,
                reportedBy: profile?.username || user.email || 'User',
                username: profile?.username || 'Unknown',
                userEmail: user.email || '',
                amount: selectedTxForDispute.amount,
                paymentType: selectedTxForDispute.type,
                type: selectedTxForDispute.type,
                reason: disputeReason.trim(),
                status: 'pending',
                tournamentId: selectedTxForDispute.tournamentId || null,
                createdAt: serverTimestamp(),
                filedAt: new Date().toISOString()
            });
            showToast('Payment dispute reported successfully. Our support team will review your transaction.', 'success');
            setDisputeModalOpen(false);
            setDisputeReason('');
            setSelectedTxForDispute(null);
        } catch (error: any) {
            showToast(error.message || 'Failed to report payment dispute', 'error');
        } finally {
            setIsSubmittingDispute(false);
        }
    };

    const handleExportStatement = () => {
        if (!transactions || transactions.length === 0) {
            showToast('No transactions to export yet', 'info');
            return;
        }
        try {
            const headers = ["Transaction ID", "Date", "Type", "Method", "Amount (NPR)", "Status", "Reference ID", "Description"];
            const rows = transactions.map(tx => [
                `"${tx.id || ''}"`,
                `"${formatDate(tx.timestamp)}"`,
                `"${tx.type || ''}"`,
                `"${tx.method || 'System'}"`,
                `"${tx.amount || 0}"`,
                `"${tx.status || ''}"`,
                `"${tx.refId || ''}"`,
                `"${(tx.desc || tx.accountDetails || '').replace(/"/g, '""')}"`
            ]);
            const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `NexPlay_Statement_${user.uid.slice(0, 6)}_${new Date().toISOString().slice(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast("Statement downloaded successfully", "success");
        } catch (err) {
            console.error("Statement download error:", err);
            showToast("Failed to generate statement file", "error");
        }
    };

    if (!user || !profile) return null;

    const isOrg = profile.role === 'organizer' || profile.role === 'admin';

    // Premium UI Render
    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-20 px-4 xl:px-0">
            {/* Header Area */}
            <Seo title="Wallet | NexPlay" description="Your wallet and transactions" noindex />
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-12 border-b border-gray-800 pb-8">
                <div>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white uppercase tracking-tighter mb-2">My Wallet</h1>
                    <p className="text-gray-400 font-bold">Manage your funds securely</p>
                </div>
                <div className="flex bg-black border border-gray-800 rounded-full pl-4 pr-5 py-2 items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-xs font-black text-white uppercase tracking-widest">Verified Secure</span>
                </div>
            </header>

            {/* Premium Balance Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="col-span-1 lg:col-span-2 bg-card/50 rounded-3xl p-10 border border-gray-800 shadow-2xl relative overflow-hidden">
                    <div className="relative z-10">
                        <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Total Balance</h2>
                        <p className="text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-tighter mb-8">
                            {formatCurrency((profile.balance || 0) + (profile.orgWalletBalance || 0))}
                        </p>
                        
                        {isOrg && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 pt-6 sm:pt-8 border-t border-gray-800">
                                <div>
                                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Org Available</h3>
                                    <p className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight">{formatCurrency(profile.orgWalletBalance || 0)}</p>
                                </div>
                                <div>
                                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Reserved Escrow</h3>
                                    <p className="text-2xl sm:text-3xl font-black text-amber-400 tracking-tight">{formatCurrency(profile.reservedBalance || 0)}</p>
                                </div>
                                <div>
                                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Pending</h3>
                                    <p className="text-2xl sm:text-3xl font-black text-white tracking-tight">{formatCurrency(profile.orgPendingEarnings || 0)}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Actions Stack */}
                <div className="col-span-1 flex flex-col gap-4">
                    <button type="button" 
                        onClick={() => {
                            setActiveModal('deposit');
                        }}
                        className="flex-1 bg-brand-500 hover:bg-brand-400 text-white p-10 rounded-3xl font-black uppercase tracking-widest text-sm transition-colors shadow-lg shadow-brand-500/20 flex flex-col items-center justify-center gap-4 hover:-translate-y-1"
                    >
                        <ArrowDownRight className="w-10 h-10" />
                        Add Money
                    </button>
                    <div className="flex-1 flex gap-4">
                        <button type="button" 
                            onClick={() => {
                                setActiveModal('withdraw');
                            }}
                            className="flex-1 bg-card hover:bg-surface text-white p-5 sm:p-8 rounded-2xl sm:rounded-3xl font-black uppercase tracking-widest text-xs transition-colors border border-gray-800 flex flex-col items-center justify-center gap-3 hover:-translate-y-1"
                        >
                            <ArrowUpRight className="w-8 h-8 text-red-400" />
                            Withdraw
                        </button>
                        <button type="button" 
                            onClick={() => {
                                setIsPromoModalOpen(true);
                            }}
                            className="flex-1 bg-card hover:bg-surface text-white p-5 sm:p-8 rounded-2xl sm:rounded-3xl font-black uppercase tracking-widest text-xs transition-colors border border-gray-800 flex flex-col items-center justify-center gap-3 hover:-translate-y-1"
                        >
                            <Gift className="w-8 h-8 text-brand-400" />
                            Redeem
                        </button>
                    </div>
                </div>
            </div>

            {/* Financial Insights Row (Derived from local data) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-card/50 border border-gray-800 rounded-3xl p-6 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-black uppercase text-gray-500 tracking-widest mb-2 flex items-center gap-2">Recent Deposits</p>
                        <p className="text-xl sm:text-2xl md:text-3xl font-black text-white truncate">{formatCurrency(analytics.recentDeposits)}</p>
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-500">
                        <ArrowDownRight size={28} />
                    </div>
                </div>
                <div className="bg-card/50 border border-gray-800 rounded-3xl p-6 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-black uppercase text-gray-500 tracking-widest mb-2 flex items-center gap-2">Recent Withdrawals</p>
                        <p className="text-xl sm:text-2xl md:text-3xl font-black text-white truncate">{formatCurrency(analytics.recentWithdrawals)}</p>
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500">
                        <ArrowUpRight size={28} />
                    </div>
                </div>
                <div className="bg-card/50 border border-gray-800 rounded-3xl p-6 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-black uppercase text-gray-500 tracking-widest mb-2 flex items-center gap-2">Total Earnings</p>
                        <p className="text-3xl font-black text-white">{formatCurrency(profile.totalEarnings || 0)}</p>
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-500">
                        <TrendingUp size={28} />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
                {/* Professional Transactions Ledger */}
                <div className="xl:col-span-2 bg-card/50 rounded-3xl border border-gray-800 overflow-hidden">
                    <div className="p-8 border-b border-gray-800 flex justify-between items-center">
                        <h3 className="text-sm font-black text-white uppercase tracking-widest">Transaction Ledger</h3>
                        <button type="button" 
                            onClick={handleExportStatement}
                            className="text-xs font-black uppercase text-gray-400 hover:text-white bg-black hover:bg-card px-5 py-2.5 min-h-[44px] rounded-2xl border border-gray-800 transition flex items-center gap-2"
                        >
                            <Download size={16} /> Statement
                        </button>
                    </div>
                    
                    <div className="p-2 sm:p-6">
                        {fetchError && (
                            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-between gap-4">
                                <p className="text-red-400 text-sm font-bold">{fetchError}</p>
                                <button type="button" onClick={() => window.location.reload()} className="text-xs font-black uppercase tracking-widest text-red-400 hover:text-red-300 border border-red-500/30 rounded-lg px-3 py-2 min-h-[44px]">Retry</button>
                            </div>
                        )}
                        {loading && transactions.length === 0 ? (
                            <div className="flex justify-center py-20">
                                <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : transactions.length > 0 ? (
                            <div className="space-y-3">
                                {transactions.map(tx => (
                                    <div key={tx.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-6 bg-black rounded-2xl hover:bg-card transition-colors border border-gray-800 gap-4 group">
                                        <div className="flex items-center gap-5">
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border border-gray-800 ${
                                                tx.type === 'deposit' ? 'bg-green-500/10 text-green-500' : 
                                                (tx.type === 'withdrawal' || tx.type === 'withdraw') ? 'bg-red-500/10 text-red-500' : 
                                                tx.type === 'entry_fee' ? 'bg-amber-500/10 text-amber-400' :
                                                tx.type === 'refund' ? 'bg-emerald-500/10 text-emerald-400' :
                                                tx.type === 'prize' ? 'bg-yellow-500/10 text-yellow-400' :
                                                tx.type === 'promo' ? 'bg-brand-500/10 text-brand-500' :
                                                'bg-blue-500/10 text-blue-500'
                                            }`}>
                                                {tx.type === 'deposit' ? <ArrowDownRight className="w-6 h-6" /> : 
                                                (tx.type === 'withdrawal' || tx.type === 'withdraw') ? <ArrowUpRight className="w-6 h-6" /> : 
                                                tx.type === 'promo' ? <Gift className="w-6 h-6" /> :
                                                tx.type === 'entry_fee' ? <Medal className="w-6 h-6" /> :
                                                tx.type === 'refund' ? <ArrowDownRight className="w-6 h-6" /> :
                                                tx.type === 'prize' ? <Trophy className="w-6 h-6" /> :
                                                <WalletIcon className="w-6 h-6" />}
                                            </div>
                                            <div>
                                                <h4 className="font-black text-white uppercase tracking-widest text-sm">
                                                    {tx.type === 'deposit' ? 'Added Funds' : 
                                                    (tx.type === 'withdrawal' || tx.type === 'withdraw') ? 'Withdrawal' : 
                                                    tx.type === 'entry_fee' ? 'Tournament Entry' :
                                                    tx.type === 'refund' ? 'Tournament Refund' :
                                                    tx.type === 'prize' ? 'Prize Winnings' :
                                                    tx.type === 'promo' ? 'Promo Code' : 'Transfer'}
                                                </h4>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className="text-xs text-gray-500 font-bold uppercase">{formatDate(tx.timestamp)}</span>
                                                    <span className="w-1 h-1 rounded-full bg-surface"></span>
                                                    <span className="text-xs text-gray-400 font-bold uppercase">{tx.method || 'System'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-auto w-full">
                                            <div className="text-left sm:text-right">
                                                <p className={`font-black text-lg font-mono ${
                                                    tx.type === 'deposit' || tx.type === 'promo' || tx.type === 'refund' || tx.type === 'prize' ? 'text-green-400' : 
                                                    (tx.type === 'withdrawal' || tx.type === 'withdraw' || tx.type === 'entry_fee') ? 'text-rose-400' : 
                                                    'text-white'
                                                }`}>
                                                    {(tx.type === 'deposit' || tx.type === 'promo' || tx.type === 'refund' || tx.type === 'prize') ? '+' : (tx.type === 'entry_fee' || Number(tx.amount) < 0) ? '-' : ''}{formatCurrency(Math.abs(Number(tx.amount || 0)))}
                                                </p>
                                                <div className="flex items-center justify-start sm:justify-end gap-1.5 mt-1">
                                                    <span className={`text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                                                        tx.status === 'completed' || tx.status === 'success' ? 'text-green-500 bg-green-500/10' :
                                                        tx.status === 'rejected' ? 'text-red-500 bg-red-500/10' :
                                                        'text-yellow-500 bg-yellow-500/10'
                                                    }`}>
                                                        {tx.status}
                                                    </span>
                                                </div>
                                            </div>
                                            {(tx.status === 'pending' || tx.status === 'rejected') && (
                                                <button type="button" 
                                                    onClick={() => {
                                                        setSelectedTxForDispute(tx);
                                                        setDisputeModalOpen(true);
                                                    }}
                                                    className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 absolute sm:relative right-4 sm:right-auto text-[10px] font-bold uppercase tracking-widest text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-3 py-2 min-h-[44px] rounded-lg transition border border-red-500/20 flex items-center gap-1"
                                                >
                                                    <AlertTriangle className="w-3 h-3" /> Report
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                
                                {hasMore && (
                                    <div className="pt-4 text-center">
                                        <button type="button" 
                                            onClick={() => fetchTransactions(true)}
                                            disabled={loadingMore}
                                            className="text-xs font-black uppercase text-gray-400 hover:text-white bg-black hover:bg-card py-4 px-8 rounded-2xl transition border border-gray-800 flex items-center gap-2 mx-auto disabled:opacity-50"
                                        >
                                            {loadingMore ? 'Loading...' : 'Load More History'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-20 bg-dark-800/30 rounded-2xl border border-dashed border-gray-800">
                                <WalletIcon className="w-12 h-12 text-gray-700 mx-auto mb-4 opacity-50" />
                                <p className="text-white font-black uppercase tracking-widest text-sm mb-1">No Activity Found</p>
                                <p className="text-gray-500 text-xs font-bold uppercase max-w-xs mx-auto">Your wallet transaction history will appear here once you start using it.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column Stack */}
                <div className="space-y-6">
                    {/* Spending Overview Profile */}
                    <div ref={chartRef} className="bg-card/50 rounded-3xl border border-gray-800 p-8">
                        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-8 flex justify-between items-center">
                            Activity Overview
                            <span className="text-[10px] bg-black px-3 py-1 rounded-full text-gray-500 border border-gray-800">Recent</span>
                        </h3>
                        <div className="h-48 w-full flex flex-col justify-end">
                            {isChartInView && analytics.chartData.length > 0 ? (() => {
                                const maxAmount = Math.max(...analytics.chartData.map(d => d.amount), 1);
                                return (
                                    <div className="w-full h-full flex flex-col justify-end">
                                        <div className="flex-1 flex items-end justify-between gap-1 sm:gap-2 px-1">
                                            {analytics.chartData.map((item, index) => {
                                                const heightPct = Math.max(8, Math.round((item.amount / maxAmount) * 100));
                                                const isIncoming = item.type === 'deposit' || item.type === 'promo';
                                                return (
                                                    <div key={index} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                                                        {/* Tooltip */}
                                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none absolute -top-10 z-20 bg-slate-900 border border-slate-800 text-white text-[10px] font-bold py-1 px-2 rounded-xl whitespace-nowrap shadow-xl flex flex-col items-center">
                                                            <span>{formatCurrency(item.amount)}</span>
                                                            <span className="text-[10px] text-gray-400 font-normal">{isIncoming ? 'Incoming' : 'Outgoing'}</span>
                                                        </div>
                                                        {/* Bar */}
                                                        <div
                                                            style={{ height: `${heightPct}%` }}
                                                            className={`w-full max-w-[18px] rounded-t-sm transition-colors duration-300 ${
                                                                isIncoming ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-blue-500 hover:bg-blue-400'
                                                            }`}
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="flex justify-between items-center w-full pt-2 border-t border-gray-800/60 mt-2 gap-1 px-1">
                                            {analytics.chartData.map((item, index) => (
                                                <span key={index} className="flex-1 text-[10px] text-slate-500 font-medium truncate text-center">
                                                    {item.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })() : (
                                <div className="h-full w-full flex items-center justify-center">
                                    <p className="text-gray-600 text-xs font-bold uppercase tracking-widest">Not enough data</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Security Module */}
                    <div className="bg-black rounded-2xl sm:rounded-3xl border border-gray-800 p-5 sm:p-8 overflow-hidden relative">
                        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-green-500/10 rounded-full blur-2xl"></div>
                        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-6 flex items-center gap-3">
                            <ShieldCheck className="w-5 h-5 text-green-500" /> Wallet Security
                        </h3>
                        <ul className="space-y-5 relative z-10">
                            <li className="flex items-center justify-between text-sm">
                                <span className="text-gray-400 font-bold">Encrypted Connection</span>
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                            </li>
                            <li className="flex items-center justify-between text-sm">
                                <span className="text-gray-400 font-bold">2FA Authentication</span>
                                <span className="text-[10px] bg-black text-gray-500 font-black px-3 py-1.5 rounded-full border border-gray-800 uppercase">Coming Soon</span>
                            </li>
                            <li className="pt-2">
                                <p className="text-xs text-gray-500 font-bold leading-relaxed">
                                    Your funds are protected by bank-level security. All transactions are logged and encrypted.
                                </p>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Modals remain structurally identical to logic but restyled via their internal components */}
            <WalletModal 
                isOpen={activeModal !== null} 
                onClose={() => {
                    setActiveModal(null);
                }} 
                initialTab={activeModal === 'withdraw' ? 'withdraw' : 'deposit'} 
            />

            {/* Promo Code Modal */}
            {isPromoModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-md animate-fade-in" onClick={() => setIsPromoModalOpen(false)}></div>
                    <div className="relative w-full max-w-md bg-dark-900 rounded-[2rem] border border-gray-800 shadow-2xl overflow-hidden animate-scale-in p-8">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                                    <Gift className="w-6 h-6 text-brand-500" /> Promo Code
                                </h3>
                                <p className="text-xs font-bold text-gray-500 mt-1 uppercase tracking-widest">Unlock premium rewards</p>
                            </div>
                            <button type="button" onClick={() => setIsPromoModalOpen(false)} aria-label="Close" className="text-gray-500 hover:text-white transition bg-dark-800 p-2 rounded-full border border-gray-700 hover:border-gray-600 touch-target flex items-center justify-center">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-6">
                            <div>
                                <label className="text-xs text-gray-400 uppercase font-bold mb-3 block">Enter your code</label>
                                <input 
                                    type="text" 
                                    value={promoCode}
                                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                                    className="w-full bg-dark border-2 border-gray-800 rounded-2xl p-5 text-white font-mono text-center text-2xl focus:border-brand-500 focus-visible:outline-none transition uppercase tracking-widest placeholder-gray-700"
                                    placeholder="NEXPLAY-V1"
                                />
                            </div>
                            <button type="button" 
                                onClick={handleRedeemPromo}
                                disabled={isRedeeming || !promoCode.trim()}
                                className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-5 rounded-2xl font-black uppercase tracking-widest text-sm transition-colors shadow-xl shadow-brand-500/25 flex items-center justify-center gap-2"
                            >
                                {isRedeeming ? 'Validating...' : 'Claim Reward'} <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Dispute Modal */}
            {disputeModalOpen && selectedTxForDispute && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-md animate-fade-in" onClick={() => setDisputeModalOpen(false)}></div>
                    <div className="relative w-full max-w-lg bg-dark-900 rounded-[2rem] border border-gray-800 shadow-2xl overflow-hidden animate-scale-in p-8">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                                    <AlertTriangle className="w-6 h-6 text-red-500" /> Report Issue
                                </h3>
                                <p className="text-xs font-bold text-gray-500 mt-1 uppercase tracking-widest">Secure Dispute Resolution</p>
                            </div>
                            <button type="button" onClick={() => setDisputeModalOpen(false)} aria-label="Close" className="text-gray-500 hover:text-white transition bg-dark-800 p-2 rounded-full border border-gray-700 hover:border-gray-600 touch-target flex items-center justify-center">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-6">
                            <div className="bg-dark p-5 rounded-2xl border border-gray-800 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">Transaction Ref</p>
                                    <p className="font-mono text-sm text-brand-400 font-bold">{selectedTxForDispute.refId || selectedTxForDispute.id}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">{selectedTxForDispute.type === 'deposit' ? 'Deposit' : 'Withdrawal'}</p>
                                    <p className="text-lg font-black text-white">{formatCurrency(selectedTxForDispute.amount)}</p>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 uppercase font-bold mb-3 block">Describe the issue clearly</label>
                                <textarea 
                                    value={disputeReason}
                                    onChange={(e) => setDisputeReason(e.target.value)}
                                    className="w-full bg-dark border-2 border-gray-800 rounded-2xl p-5 text-white focus:border-red-500/50 focus-visible:outline-none transition resize-none h-40 font-medium"
                                    placeholder="I initiated this withdrawal 3 days ago but haven't received it in my account yet..."
                                />
                            </div>
                            <button type="button" 
                                onClick={handleReportDispute}
                                disabled={isSubmittingDispute || !disputeReason.trim()}
                                className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-5 rounded-2xl font-black uppercase tracking-widest text-sm transition-colors shadow-xl shadow-red-500/25 flex items-center justify-center gap-2"
                            >
                                {isSubmittingDispute ? 'Opening Ticket...' : 'Submit Dispute'} <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Wallet;