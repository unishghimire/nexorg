import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
  Search,
  Filter,
  Trophy,
  Gamepad2,
  Calendar,
  AlertCircle,
  FileCheck2,
  ArrowUpRight,
  Info,
} from 'lucide-react';
import { Tournament } from '../../../shared/types/types';
import { formatDate } from '../../../shared/utils/utils';
import { useAuth } from '../../../shared/context/AuthContext';
import { useNotification } from '../../../shared/context/NotificationContext';
import {
  DEFAULT_FREE_LOCK_AMOUNT,
  publishResultsAndSettle,
} from '../../../shared/services/eventSettlementService';

export interface SettlementsTabProps {
  hostedTournaments?: any[];
  hostedScrims?: any[];
  transactions?: any[];
  onNavigateTab?: (tabId: string) => void;
  onRefreshData?: () => void;
}

const formatCurrency = (amount: number = 0): string => {
  return `Rs. ${new Intl.NumberFormat('en-IN').format(Math.max(0, amount))}`;
};

export const SettlementsTab: React.FC<SettlementsTabProps> = ({
  hostedTournaments = [],
  hostedScrims = [],
  transactions = [],
  onNavigateTab,
  onRefreshData,
}) => {
  const { user, profile } = useAuth();
  const { showToast } = useNotification();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'TOURNAMENT' | 'SCRIM'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [settlingId, setSettlingId] = useState<string | null>(null);

  // Collect all completed or finalized events
  const completedEvents = useMemo(() => {
    const combined = [
      ...hostedTournaments.map((t) => ({ ...t, _eventType: 'tournament' as const })),
      ...hostedScrims.map((s) => ({ ...s, _eventType: 'scrim' as const })),
    ];

    return combined
      .filter((e) => {
        const s = String(e.status || '').toLowerCase();
        return s === 'completed' || s === 'finalized';
      })
      .map((event) => {
        const eventId = event.id;
        const title = event.title || 'Untitled Event';
        const eventType = event._eventType;
        const isPaid = Number(event.entryFee || event.requirements?.entryFee || 0) > 0;
        const prizePool = Math.max(0, Number(event.prizePool || 0));
        const entryFee = Math.max(0, Number(event.entryFee || 0));
        const filledSlots = Number(event.filledSlots || event.currentPlayers || 0);

        const totalRevenue = isPaid ? filledSlots * entryFee : 0;
        const rawProfit = isPaid ? Math.max(0, totalRevenue - prizePool) : 0;
        const orgCommission = isPaid ? Math.round(rawProfit * 0.85) : 0; // 85% host share

        const lockAmount = Math.max(0, Number(event.lockAmount || DEFAULT_FREE_LOCK_AMOUNT));
        const isPenaltyApplied = event.penaltyApplied === true;
        const fineAmount = isPenaltyApplied
          ? Math.round((isPaid ? (totalRevenue || prizePool) : lockAmount) * 0.1)
          : 0;

        // Settlement Status derivation
        let settlementStatus:
          | 'PENDING'
          | 'ELIGIBLE'
          | 'PROCESSING'
          | 'SETTLED'
          | 'FAILED'
          | 'REVERSED' = 'PENDING';

        if (event.settlementStatus === 'settled' || event.payoutCompleted) {
          settlementStatus = 'SETTLED';
        } else if (event.settlementStatus === 'failed') {
          settlementStatus = 'FAILED';
        } else if (event.settlementStatus === 'processing') {
          settlementStatus = 'PROCESSING';
        } else if (event.resultStatus === 'published' || event.resultStatus === 'verified') {
          settlementStatus = 'ELIGIBLE';
        } else {
          settlementStatus = 'PENDING';
        }

        const settlementDate = event.settledAt || event.completedAt || event.updatedAt;
        const mainWalletTxId =
          event.settlementTxId ||
          transactions.find((tx) => tx.eventId === eventId && String(tx.type || '').includes('commission'))?.id ||
          'N/A';

        return {
          eventId,
          title,
          eventType,
          isPaid,
          prizePool,
          entryFee,
          filledSlots,
          totalRevenue,
          lockAmount,
          finalFinancialResult: totalRevenue,
          orgCommission,
          fineAmount,
          isPenaltyApplied,
          settlementStatus,
          settlementDate,
          mainWalletTxId,
          resultStatus: event.resultStatus || 'pending',
          eventRaw: event,
        };
      });
  }, [hostedTournaments, hostedScrims, transactions]);

  // Aggregate metrics
  const summary = useMemo(() => {
    let totalSettled = 0;
    let pendingCommission = 0;
    let totalFines = 0;
    let settledCount = 0;
    let pendingCount = 0;

    for (const e of completedEvents) {
      if (e.settlementStatus === 'SETTLED') {
        totalSettled += e.orgCommission;
        settledCount++;
      } else {
        pendingCommission += e.orgCommission;
        pendingCount++;
      }
      if (e.fineAmount > 0) {
        totalFines += e.fineAmount;
      }
    }

    return {
      totalSettled,
      pendingCommission,
      totalFines,
      settledCount,
      pendingCount,
    };
  }, [completedEvents]);

  // Filtered
  const filteredEvents = useMemo(() => {
    return completedEvents.filter((item) => {
      if (typeFilter === 'TOURNAMENT' && item.eventType !== 'tournament') return false;
      if (typeFilter === 'SCRIM' && item.eventType !== 'scrim') return false;
      if (statusFilter !== 'ALL' && item.settlementStatus !== statusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return item.title.toLowerCase().includes(q) || item.eventId.toLowerCase().includes(q);
      }
      return true;
    });
  }, [completedEvents, typeFilter, statusFilter, searchQuery]);

  // Handle Trigger Settlement / Publish & Settle
  const handlePublishAndSettle = async (item: any) => {
    try {
      setSettlingId(item.eventId);
      const res = await publishResultsAndSettle({
        eventId: item.eventId,
        eventType: item.eventType,
        actorUid: user?.uid || 'organizer',
        actorName: profile?.username || user?.displayName || 'Host',
        actorRole: profile?.role || 'organizer',
      });
      showToast(res.message, 'success');
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      showToast(err.message || 'Failed to settle event', 'error');
    } finally {
      setSettlingId(null);
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'SETTLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" /> Settled to Main Wallet
          </span>
        );
      case 'ELIGIBLE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/30">
            <FileCheck2 className="w-3 h-3" /> Eligible for Release
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse">
            <Clock className="w-3 h-3" /> Processing Payout
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/30">
            <AlertCircle className="w-3 h-3" /> Settlement Failed
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-surface text-gray-400 border border-gray-700">
            <Clock className="w-3 h-3 text-amber-400" /> Pending Results
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── 1. Header ─── */}
      <div className="bg-card/70 border border-gray-800/80 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-emerald-400 mb-0.5">
            <DollarSign className="w-3.5 h-3.5" /> Direct Financial Settlement
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase">
            Organizer Settlements &amp; Commission
          </h2>
          <p className="text-xs text-gray-400 font-medium mt-0.5">
            Complete financial records, profit releases, fine deductions, and Main NexPlay Wallet settlement IDs.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <a
            href="https://www.nexplayorg.app/wallet"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-dark border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Open Main Wallet</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-70" />
          </a>
          {onRefreshData && (
            <button
              type="button"
              onClick={onRefreshData}
              className="px-3.5 py-2 bg-surface hover:bg-gray-800 text-gray-300 rounded-xl text-xs font-bold uppercase tracking-wider border border-gray-700 flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Refresh
            </button>
          )}
        </div>
      </div>

      {/* ─── 2. Metric Overview Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-dark/60 border border-emerald-500/20 rounded-2xl p-4 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block mb-1">
            Total Settled Commission
          </span>
          <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
            {formatCurrency(summary.totalSettled)}
          </div>
          <span className="text-[10px] text-gray-400 mt-1 block">
            {summary.settledCount} completed events settled
          </span>
        </div>

        <div className="bg-dark/60 border border-amber-500/20 rounded-2xl p-4 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block mb-1">
            Pending Commission
          </span>
          <div className="text-xl sm:text-2xl font-black font-mono text-amber-400">
            {formatCurrency(summary.pendingCommission)}
          </div>
          <span className="text-[10px] text-gray-400 mt-1 block">
            {summary.pendingCount} events awaiting results &amp; verification
          </span>
        </div>

        <div className="bg-dark/60 border border-red-500/20 rounded-2xl p-4 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-widest text-red-400 block mb-1">
            48h Deadline Fines
          </span>
          <div className="text-xl sm:text-2xl font-black font-mono text-red-400">
            {formatCurrency(summary.totalFines)}
          </div>
          <span className="text-[10px] text-gray-400 mt-1 block">
            Deducted for overdue results
          </span>
        </div>

        <div className="bg-dark/60 border border-blue-500/20 rounded-2xl p-4 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 block mb-1">
            Settlement Method
          </span>
          <div className="text-base sm:text-lg font-black text-white mt-1">
            Main Wallet
          </div>
          <span className="text-[10px] text-gray-400 block">
            Credited to <code className="text-brand-300 font-mono">users/{'{uid}'}.balance</code>
          </span>
        </div>
      </div>

      {/* ─── 3. Search & Filter Bar ─── */}
      <div className="bg-card/50 border border-gray-800 rounded-xl p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 custom-scrollbar">
          {(
            [
              { id: 'ALL', label: 'All Settled Events' },
              { id: 'TOURNAMENT', label: 'Tournaments' },
              { id: 'SCRIM', label: 'Scrims' },
            ] as const
          ).map((chip) => (
            <button
              type="button"
              key={chip.id}
              onClick={() => setTypeFilter(chip.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-colors whitespace-nowrap ${
                typeFilter === chip.id
                  ? 'bg-brand-500 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-dark border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500 font-bold uppercase tracking-wider cursor-pointer"
          >
            <option value="ALL">All Settlement Statuses</option>
            <option value="SETTLED">Settled</option>
            <option value="ELIGIBLE">Eligible (Results Published)</option>
            <option value="PENDING">Pending (Results Required)</option>
            <option value="FAILED">Failed</option>
          </select>

          <div className="relative min-w-[200px] flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search event name or ID..."
              className="w-full bg-dark border border-gray-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>
      </div>

      {/* ─── 4. Settlement List ─── */}
      {filteredEvents.length === 0 ? (
        <div className="text-center py-16 bg-card/20 rounded-2xl border border-gray-800">
          <FileCheck2 className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <h4 className="text-sm font-black uppercase text-white tracking-wider">No Settlements Found</h4>
          <p className="text-xs text-gray-400 mt-1">
            {searchQuery || statusFilter !== 'ALL' || typeFilter !== 'ALL'
              ? 'No completed events match your current filter criteria.'
              : 'Complete tournaments or scrims to generate settlement records and commission payouts.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEvents.map((item) => (
            <div
              key={item.eventId}
              className="bg-card/40 border border-gray-800 rounded-2xl p-4 sm:p-5 shadow-md hover:border-gray-700/80 transition-all"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-800/80 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="p-1.5 rounded-lg bg-dark border border-gray-800 text-brand-400">
                      {item.eventType === 'tournament' ? <Trophy className="w-4 h-4" /> : <Gamepad2 className="w-4 h-4" />}
                    </span>
                    <h4 className="text-base font-black text-white uppercase tracking-tight">
                      {item.title}
                    </h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-dark text-gray-400 border border-gray-800">
                      ID: {item.eventId.slice(0, 10)}
                    </span>
                    {renderStatusBadge(item.settlementStatus)}
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-surface text-gray-300 border border-gray-800">
                      {item.isPaid ? 'Paid' : 'Free (Rs. 0 Profit)'}
                    </span>
                  </div>

                  <div className="text-xs text-gray-400 flex items-center gap-3 flex-wrap">
                    <span>Slots: <strong className="text-white">{item.filledSlots}</strong></span>
                    <span>•</span>
                    <span>Total Revenue: <strong className="text-white">{formatCurrency(item.totalRevenue)}</strong></span>
                    <span>•</span>
                    <span>Prize Pool: <strong className="text-white">{formatCurrency(item.prizePool)}</strong></span>
                    {item.settlementDate && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-gray-500" /> {formatDate(item.settlementDate)}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {item.settlementStatus === 'ELIGIBLE' && (
                    <button
                      type="button"
                      disabled={settlingId === item.eventId}
                      onClick={() => handlePublishAndSettle(item)}
                      className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>{settlingId === item.eventId ? 'Settling...' : 'Release Commission'}</span>
                    </button>
                  )}

                  <a
                    href={item.eventType === 'tournament' ? `/tournaments/${item.eventId}` : `/scrims/${item.eventId}`}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-dark border border-gray-800 hover:border-brand-500 text-gray-300 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    <span>View Event</span>
                    <ArrowUpRight className="w-3 h-3 opacity-60" />
                  </a>
                </div>
              </div>

              {/* Financial Breakdown Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                <div className="bg-dark/40 rounded-xl p-3 border border-gray-800/80">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">
                    Event Lock Amount
                  </span>
                  <span className="text-base font-black font-mono text-white">
                    {formatCurrency(item.lockAmount)}
                  </span>
                </div>

                <div className="bg-dark/40 rounded-xl p-3 border border-gray-800/80">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block mb-1">
                    Organizer Share (85%)
                  </span>
                  <span className="text-base font-black font-mono text-emerald-400">
                    {formatCurrency(item.orgCommission)}
                  </span>
                </div>

                <div className="bg-dark/40 rounded-xl p-3 border border-gray-800/80">
                  <span className="text-[10px] font-black uppercase tracking-widest text-red-400 block mb-1">
                    Penalty / Fines
                  </span>
                  <span className={`text-base font-black font-mono ${item.fineAmount > 0 ? 'text-red-400' : 'text-gray-400'}`}>
                    {item.fineAmount > 0 ? `-${formatCurrency(item.fineAmount)}` : 'Rs. 0'}
                  </span>
                </div>

                <div className="bg-dark/40 rounded-xl p-3 border border-gray-800/80">
                  <span className="text-[10px] font-black uppercase tracking-widest text-brand-400 block mb-1">
                    Main Wallet Tx ID
                  </span>
                  <span className="text-xs font-mono font-bold text-gray-300 truncate block">
                    {item.mainWalletTxId}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SettlementsTab;
