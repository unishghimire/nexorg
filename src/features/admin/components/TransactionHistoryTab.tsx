import React from 'react';
import { CreditCard, Search, Eye } from 'lucide-react';
import { Transaction, Tournament } from '../../../shared/types/types';

interface TransactionHistoryTabProps {
    allTransactions: Transaction[];
    allTournaments: Tournament[];
    setSelectedTx: (tx: Transaction) => void;
    formatDate: (timestamp: any) => string;
    getRelativeTime: (timestamp: any) => string;
    formatCurrency: (amount: number) => string;
    txFilterType: string;
    setTxFilterType: (val: any) => void;
    txFilterStatus: string;
    setTxFilterStatus: (val: any) => void;
    txFilterTournament: string;
    setTxFilterTournament: (val: string) => void;
    txSearchUser: string;
    setTxSearchUser: (val: string) => void;
}

const TransactionHistoryTab: React.FC<TransactionHistoryTabProps> = ({
    allTransactions,
    allTournaments,
    setSelectedTx,
    formatDate,
    getRelativeTime,
    formatCurrency,
    txFilterType,
    setTxFilterType,
    txFilterStatus,
    setTxFilterStatus,
    txFilterTournament,
    setTxFilterTournament,
    txSearchUser,
    setTxSearchUser
}) => {
    return (
        <div className="bg-card p-6 rounded-2xl border border-slate-800 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-700 pb-4">
                <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-2">
                    <CreditCard className="text-brand-500" /> Transaction History
                </h2>
                <div className="flex flex-wrap gap-2">
                    <select 
                        value={txFilterType} 
                        onChange={e => setTxFilterType(e.target.value as any)}
                        className="bg-dark border border-slate-700 rounded-lg p-2 text-white text-xs focus:border-brand-500 focus-visible:outline-none"
                    >
                        <option value="all">All Types</option>
                        <option value="deposit">Deposit</option>
                        <option value="withdrawal">Withdrawal</option>
                        <option value="prize">Prize</option>
                        <option value="refund">Refund</option>
                        <option value="entry_fee">Entry Fee</option>
                    </select>
                    <select 
                        value={txFilterStatus} 
                        onChange={e => setTxFilterStatus(e.target.value as any)}
                        className="bg-dark border border-slate-700 rounded-lg p-2 text-white text-xs focus:border-brand-500 focus-visible:outline-none"
                    >
                        <option value="all">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="success">Success</option>
                        <option value="rejected">Rejected</option>
                        <option value="refunded">Refunded</option>
                    </select>
                    <select 
                        value={txFilterTournament} 
                        onChange={e => setTxFilterTournament(e.target.value)}
                        className="bg-dark border border-slate-700 rounded-lg p-2 text-white text-xs focus:border-brand-500 focus-visible:outline-none w-40"
                    >
                        <option value="all">All Tournaments</option>
                        {allTournaments.map(t => (
                            <option key={t.id} value={t.id}>{t.title}</option>
                        ))}
                    </select>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Search User..." 
                            value={txSearchUser}
                            onChange={e => setTxSearchUser(e.target.value)}
                            className="bg-dark border border-slate-700 rounded-lg p-2 pl-8 text-white text-xs focus:border-brand-500 focus-visible:outline-none w-40"
                        />
                    </div>
                </div>
            </div>
            <div className="overflow-x-auto custom-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="text-[10px] text-slate-400 uppercase tracking-widest border-b border-slate-800">
                            <th className="py-3 px-4">Date</th>
                            <th className="py-3 px-4">User</th>
                            <th className="py-3 px-4">Type</th>
                            <th className="py-3 px-4">Method</th>
                            <th className="py-3 px-4">Amount</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4">Ref ID</th>
                            <th className="py-3 px-4 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="text-xs">
                        {allTransactions
                            .filter(t => {
                                const matchesType = txFilterType === 'all' || t.type === txFilterType;
                                const matchesStatus = txFilterStatus === 'all' || t.status === txFilterStatus;
                                const matchesTournament = txFilterTournament === 'all' || t.tournamentId === txFilterTournament;
                                const matchesUser = !txSearchUser || 
                                    t.username?.toLowerCase().includes(txSearchUser.toLowerCase()) ||
                                    t.userEmail?.toLowerCase().includes(txSearchUser.toLowerCase());
                                return matchesType && matchesStatus && matchesUser && matchesTournament;
                            })
                            .map(t => (
                            <tr 
                                key={t.id} 
                                onClick={() => setSelectedTx(t)}
                                className="border-b border-slate-800/50 hover:bg-surface/30 transition cursor-pointer group"
                            >
                                <td className="py-3 px-4 text-gray-400">
                                    <div>{formatDate(t.timestamp)}</div>
                                    <div className="text-[10px] text-slate-400 font-mono">{getRelativeTime(t.timestamp)}</div>
                                </td>
                                <td className="py-3 px-4">
                                    <div className="text-white font-bold">{t.username || t.userId.slice(0, 8)}</div>
                                    <div className="text-[10px] text-slate-400 truncate max-w-[100px]">{t.userEmail}</div>
                                    {t.confirmedByUsername && <div className="text-[10px] text-brand-400 uppercase font-black">By: {t.confirmedByUsername}</div>}
                                </td>
                                <td className="py-3 px-4">
                                    <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                                        t.type === 'deposit' ? 'bg-green-900/30 text-green-400 border border-green-500/30' :
                                        t.type === 'withdrawal' ? 'bg-red-900/30 text-red-400 border border-red-500/30' :
                                        t.type === 'refund' ? 'bg-orange-900/30 text-orange-400 border border-orange-500/30' :
                                        'bg-blue-900/30 text-blue-400 border border-blue-500/30'
                                    }`}>
                                        {t.type}
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-gray-400">{t.method}</td>
                                <td className={`py-3 px-4 font-bold ${t.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {formatCurrency(t.amount)}
                                </td>
                                <td className="py-3 px-4">
                                    <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                                        t.status === 'success' ? 'bg-green-600 text-white' :
                                        t.status === 'pending' ? 'bg-yellow-600 text-white' :
                                        t.status === 'refunded' ? 'bg-orange-600 text-white' :
                                        'bg-red-600 text-white'
                                    }`}>
                                        {t.status}
                                    </span>
                                </td>
                                <td className="py-3 px-4 text-slate-400 font-mono">
                                    {t.refId || 'N/A'}
                                </td>
                                <td className="py-3 px-4 text-right">
                                    <button type="button" 
                                        onClick={(e) => { e.stopPropagation(); setSelectedTx(t); }}
                                        className="bg-brand-500/10 hover:bg-brand-500 text-brand-400 hover:text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors border border-brand-500/20 flex items-center gap-1 ml-auto"
                                    >
                                        <Eye className="w-3 h-3" /> View
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TransactionHistoryTab;
