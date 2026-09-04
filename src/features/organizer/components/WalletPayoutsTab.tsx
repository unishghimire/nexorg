import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet,
  ArrowUpRight,
  TrendingUp,
  Clock,
  DollarSign,
  ShieldCheck,
  Coins,
  ArrowDownToLine,
  Sparkles,
} from 'lucide-react';
import { formatDate } from '../../../shared/utils/utils';
import { useAuth } from '../../../shared/context/AuthContext';

export interface WalletPayoutsTabProps {
  kpis?: {
    orgWalletBalance: number;
    escrowBalance: number;
    pendingPayouts: number;
  };
  transactions?: any[];
  onRequestWithdraw?: (amount: number, method: string, details: string) => void;
}

// Currency formatter using Intl.NumberFormat for Rs. (no decimals for amounts > 100)
const formatCurrency = (amount: number): string => {
  const num = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  const hasDecimals = num <= 100 && num % 1 !== 0;
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: num > 100 ? 0 : 2,
  }).format(num);
  return `Rs. ${formatted}`;
};

export const WalletPayoutsTab: React.FC<WalletPayoutsTabProps> = ({
  kpis = { orgWalletBalance: 0, escrowBalance: 0, pendingPayouts: 0 },
  transactions = [],
}) => {
  const navigate = useNavigate();
  const { profile } = useAuth();

  // User's registered NexPlay wallet balance is authoritative
  const registeredBalance = typeof profile?.balance === 'number' 
    ? profile.balance 
    : (kpis?.orgWalletBalance ?? 0);

  const escrowBalance = kpis?.escrowBalance ?? 0;
  const pendingPayouts = kpis?.pendingPayouts ?? 0;

  const getTypeBadge = (type: string) => {
    const norm = (type || '').toLowerCase();
    switch (norm) {
      case 'entry_fee':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-surface text-slate-300 border border-slate-700">
            Entry Fee
          </span>
        );
      case 'prize':
      case 'prize_pool_payout':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-indigo-950/80 text-indigo-300 border border-indigo-800/50">
            Prize Payout
          </span>
        );
      case 'earnings_release':
      case 'org_share':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/50">
            Host Profit
          </span>
        );
      case 'withdraw':
      case 'withdrawal':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-amber-950/80 text-amber-300 border border-amber-800/50">
            Withdrawal
          </span>
        );
      case 'deposit':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-green-950/80 text-green-300 border border-green-800/50">
            Deposit
          </span>
        );
      case 'sponsor':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-purple-950/80 text-purple-300 border border-purple-800/50">
            Sponsor
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-surface text-slate-300 border border-slate-700">
            {type ? type.replace(/_/g, ' ') : 'Transaction'}
          </span>
        );
    }
  };

  const getStatusPill = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Completed
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            Pending
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface text-slate-300 border border-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
            {status || 'Unknown'}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 text-gray-100">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black text-white tracking-tight uppercase">Finances & Revenue</h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand-500/10 text-brand-400 border border-brand-500/20">
              Direct Settlement
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Real-time event revenues, prize escrow, and payouts settled directly to your registered NexPlay user account.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/wallet')}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-brand-500/20 active:scale-95 transition-all self-start sm:self-auto"
        >
          <Wallet className="w-4 h-4" />
          <span>Open Main Wallet</span>
          <ArrowUpRight className="w-3.5 h-3.5 opacity-70" />
        </button>
      </div>

      {/* 2. Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Main Registered User Balance */}
        <div className="bg-dark/50 border border-emerald-500/20 rounded-2xl p-5 relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Registered Wallet Balance
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white mt-3 font-mono">
            {formatCurrency(registeredBalance)}
          </div>
          <div className="flex items-center justify-between gap-1 text-xs text-slate-400 mt-3 pt-3 border-t border-slate-800/80">
            <span className="flex items-center gap-1 text-[11px] text-slate-400">
              <TrendingUp className="w-3 h-3 text-emerald-400 shrink-0" />
              Available to withdraw
            </span>
            <button
              type="button"
              onClick={() => navigate('/wallet')}
              className="text-[11px] font-black text-emerald-400 hover:text-emerald-300 underline underline-offset-2 flex items-center gap-1 transition-colors"
            >
              Cash Out <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* In Escrow */}
        <div className="bg-dark/50 border border-indigo-500/20 rounded-2xl p-5 relative overflow-hidden group hover:border-indigo-500/40 transition-colors">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-black uppercase tracking-widest text-indigo-400">
              Active Prize Escrow
            </span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white mt-3 font-mono">
            {formatCurrency(escrowBalance)}
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-400 mt-3 pt-3 border-t border-slate-800/80">
            <DollarSign className="w-3 h-3 text-indigo-400 shrink-0" />
            <span className="text-[11px] text-slate-400">Locked for ongoing tournament & scrim prizes</span>
          </div>
        </div>

        {/* Pending Settlements */}
        <div className="bg-dark/50 border border-amber-500/20 rounded-2xl p-5 relative overflow-hidden group hover:border-amber-500/40 transition-colors">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-black uppercase tracking-widest text-amber-400">
              Pending Settlements
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <ArrowDownToLine className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white mt-3 font-mono">
            {formatCurrency(pendingPayouts)}
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-400 mt-3 pt-3 border-t border-slate-800/80">
            <Clock className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="text-[11px] text-slate-400">Processing event releases and shares</span>
          </div>
        </div>
      </div>

      {/* 3. Direct Wallet Settlement & Cashout Hub */}
      <div className="bg-gradient-to-br from-card/90 via-dark to-dark border border-brand-500/20 rounded-2xl p-6 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 text-brand-400 text-xs font-black uppercase tracking-widest">
              <ShieldCheck className="w-4 h-4 text-brand-400" />
              <span>Direct Wallet Settlement Architecture</span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight">
              All Organizer Earnings Go Directly to Your Registered NexPlay Wallet
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              When your tournaments or scrims finish, your net profits and host earnings are credited directly to your registered user wallet account balance (<code className="text-brand-300 font-mono text-xs">users/{'{uid}'}.balance</code>). You do not need a separate withdrawal request here.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                <Sparkles className="w-3 h-3" /> eSewa
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold">
                <Sparkles className="w-3 h-3" /> Khalti
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">
                <Sparkles className="w-3 h-3" /> Bank Transfer
              </span>
              <span className="text-slate-400">Supported for instant cashouts in the main wallet.</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 w-full lg:w-auto shrink-0">
            <button
              type="button"
              onClick={() => navigate('/wallet')}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-dark font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
            >
              <ArrowDownToLine className="w-4 h-4" />
              <span>Withdraw to Bank / eSewa</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => navigate('/wallet')}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-card hover:bg-card/80 border border-slate-700 text-slate-300 hover:text-white font-bold text-xs uppercase tracking-wider transition-all"
            >
              <Coins className="w-4 h-4 text-brand-400" />
              <span>Deposit / Pre-fund Prizes</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Transaction & Revenue Settlement History */}
      <div className="bg-dark/50 border border-slate-800 rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-black text-white uppercase tracking-tight">Revenue & Transaction History</h3>
            <p className="text-xs text-slate-400">
              Live audit record of entry fees, prize payouts, and account credits.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/wallet')}
            className="text-xs text-brand-400 hover:text-brand-300 font-black uppercase tracking-wider flex items-center gap-1 self-start sm:self-auto transition-colors"
          >
            View Full Statement <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {transactions.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            <Coins className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
            No financial transactions recorded yet.
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs font-black uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Method / Channel</th>
                    <th className="py-3 px-4">Ref ID</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {transactions.map((tx, idx) => (
                    <tr key={tx.id || idx} className="hover:bg-card/40 transition-colors">
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getTypeBadge(tx.type)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono font-bold text-white">
                        {formatCurrency(tx.amount)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-300 text-xs">
                        {tx.method || tx.gateway || 'NexPlay Wallet'}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs text-slate-400">
                        {tx.refId || tx.id || '—'}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getStatusPill(tx.status)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-400">
                        {formatDate(tx.timestamp || tx.date || tx.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Cards Layout */}
            <div className="block sm:hidden space-y-3">
              {transactions.map((tx, idx) => (
                <div
                  key={tx.id || idx}
                  className="bg-card/60 border border-slate-800 rounded-2xl p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div>{getTypeBadge(tx.type)}</div>
                    <div>{getStatusPill(tx.status)}</div>
                  </div>

                  <div className="flex items-baseline justify-between pt-1">
                    <span className="text-xs text-slate-400">Amount</span>
                    <span className="font-mono text-lg font-bold text-white">
                      {formatCurrency(tx.amount)}
                    </span>
                  </div>

                  {tx.desc && (
                    <p className="text-xs text-slate-300 line-clamp-2">{tx.desc}</p>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800/60 text-slate-400">
                    <div>
                      <span className="block text-[10px] uppercase text-slate-400 font-medium">Channel</span>
                      <span className="text-slate-300">{tx.method || tx.gateway || 'NexPlay Wallet'}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase text-slate-400 font-medium">Ref ID</span>
                      <span className="font-mono text-slate-300">{tx.refId || tx.id || '—'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="block text-[10px] uppercase text-slate-400 font-medium">Date</span>
                      <span className="text-slate-300">{formatDate(tx.timestamp || tx.date || tx.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default WalletPayoutsTab;
