import React, { useState, useMemo } from 'react';
import {
  Lock,
  Unlock,
  AlertCircle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  DollarSign,
  TrendingUp,
  RotateCcw,
  ExternalLink,
  ShieldCheck,
  Trophy,
  Gamepad2,
  Calendar,
  AlertTriangle,
  Play,
  ArrowUpRight,
  Info,
} from 'lucide-react';
import {
  getEventLockDetails,
  EventLockDetails,
  EventLockStatus,
  validateAndStartEventServer,
} from '../../../shared/services/organizerFinancialsService';
import { useAuth } from '../../../shared/context/AuthContext';
import { useNotification } from '../../../shared/context/NotificationContext';
import { formatDate } from '../../../shared/utils/utils';

export interface LockAmountsTabProps {
  hostedTournaments?: any[];
  hostedScrims?: any[];
  onNavigateTab?: (tabId: string) => void;
  onRefreshData?: () => void;
}

const formatCurrency = (amount: number = 0): string => {
  return `Rs. ${new Intl.NumberFormat('en-IN').format(Math.max(0, amount))}`;
};

export const LockAmountsTab: React.FC<LockAmountsTabProps> = ({
  hostedTournaments = [],
  hostedScrims = [],
  onNavigateTab,
  onRefreshData,
}) => {
  const { user, profile } = useAuth();
  const { showToast } = useNotification();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'TOURNAMENT' | 'SCRIM'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [startingEventId, setStartingEventId] = useState<string | null>(null);

  // Compute live lock details for every tournament and scrim
  const allLockDetails: EventLockDetails[] = useMemo(() => {
    const combined = [
      ...hostedTournaments.map((t) => ({ ...t, _tType: 'tournament' })),
      ...hostedScrims.map((s) => ({ ...s, _tType: 'scrim' })),
    ];
    return combined.map(getEventLockDetails);
  }, [hostedTournaments, hostedScrims]);

  // Aggregated Summary KPI counters
  const summary = useMemo(() => {
    let totalRequired = 0;
    let totalCollected = 0;
    let fullyCollectedCount = 0;
    let pendingCount = 0;
    let lockedCount = 0;
    let releasedCount = 0;

    for (const item of allLockDetails) {
      totalRequired += item.requiredLockAmount;
      totalCollected += item.collectedAmount;
      if (item.status === 'FULLY_COLLECTED') fullyCollectedCount++;
      else if (item.status === 'LOCK_PENDING' || item.status === 'PARTIALLY_COLLECTED') pendingCount++;
      else if (item.status === 'LOCKED') lockedCount++;
      else if (item.status === 'RELEASED') releasedCount++;
    }

    const overallPercentage =
      totalRequired > 0 ? Math.min(100, Math.round((totalCollected / totalRequired) * 100)) : 100;

    return {
      totalRequired,
      totalCollected,
      remaining: Math.max(0, totalRequired - totalCollected),
      overallPercentage,
      fullyCollectedCount,
      pendingCount,
      lockedCount,
      releasedCount,
    };
  }, [allLockDetails]);

  // Filtered list
  const filteredLocks = useMemo(() => {
    return allLockDetails.filter((item) => {
      // Type filter
      if (typeFilter === 'TOURNAMENT' && item.eventType !== 'tournament') return false;
      if (typeFilter === 'SCRIM' && item.eventType !== 'scrim') return false;

      // Status filter
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.eventName.toLowerCase().includes(q);
        const matchesId = item.eventId.toLowerCase().includes(q);
        return matchesName || matchesId;
      }

      return true;
    });
  }, [allLockDetails, typeFilter, statusFilter, searchQuery]);

  // Handle Event Start with authoritative server lock verification
  const handleStartEvent = async (item: EventLockDetails) => {
    if (!item.canStart) {
      showToast(item.cannotStartReason || 'Cannot start event: Lock requirement incomplete.', 'warning');
      return;
    }

    try {
      setStartingEventId(item.eventId);
      const res = await validateAndStartEventServer({
        eventId: item.eventId,
        eventType: item.eventType,
        actorUid: user?.uid || 'organizer',
        actorName: profile?.username || user?.displayName || 'Host',
        actorRole: profile?.role || 'organizer',
      });
      showToast(res.message, 'success');
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      showToast(err.message || 'Failed to start event', 'error');
    } finally {
      setStartingEventId(null);
    }
  };

  const renderStatusBadge = (status: EventLockStatus) => {
    switch (status) {
      case 'FULLY_COLLECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" /> Fully Collected
          </span>
        );
      case 'PARTIALLY_COLLECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Clock className="w-3 h-3" /> Partially Collected
          </span>
        );
      case 'LOCK_PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/30">
            <AlertCircle className="w-3 h-3" /> Lock Pending
          </span>
        );
      case 'LOCKED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/30">
            <Lock className="w-3 h-3" /> Locked in Escrow
          </span>
        );
      case 'RELEASED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/10 text-purple-300 border border-purple-500/30">
            <ShieldCheck className="w-3 h-3" /> Released
          </span>
        );
      case 'REFUNDED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gray-500/10 text-gray-400 border border-gray-500/30">
            <RotateCcw className="w-3 h-3" /> Refunded
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-surface text-gray-400 border border-gray-800">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── 1. Header ─── */}
      <div className="bg-card/70 border border-gray-800/80 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-brand-400 mb-0.5">
            <Lock className="w-3.5 h-3.5" /> Escrow Security Engine
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase">
            Event Lock Amount Management
          </h2>
          <p className="text-xs text-gray-400 font-medium mt-0.5">
            Real-time lock monitoring across all your tournaments and scrims. An event cannot start until its full lock is collected.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <a
            href="https://www.nexplayorg.app/wallet"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-dark border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Main Wallet</span>
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

      {/* ─── 2. Financial Overview Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-dark/60 border border-gray-800 rounded-2xl p-4 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">
            Total Required Lock
          </span>
          <div className="text-xl sm:text-2xl font-black font-mono text-white">
            {formatCurrency(summary.totalRequired)}
          </div>
          <span className="text-[10px] text-gray-500 mt-1 block">
            Across {allLockDetails.length} hosted events
          </span>
        </div>

        <div className="bg-dark/60 border border-emerald-500/20 rounded-2xl p-4 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block mb-1">
            Total Collected Lock
          </span>
          <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
            {formatCurrency(summary.totalCollected)}
          </div>
          <span className="text-[10px] text-emerald-400/80 mt-1 block">
            {summary.overallPercentage}% overall coverage
          </span>
        </div>

        <div className="bg-dark/60 border border-amber-500/20 rounded-2xl p-4 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block mb-1">
            Remaining Shortfall
          </span>
          <div className="text-xl sm:text-2xl font-black font-mono text-amber-400">
            {formatCurrency(summary.remaining)}
          </div>
          <span className="text-[10px] text-amber-400/80 mt-1 block">
            {summary.pendingCount} events pending full funding
          </span>
        </div>

        <div className="bg-dark/60 border border-blue-500/20 rounded-2xl p-4 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 block mb-1">
            Active / Escrow Held
          </span>
          <div className="text-xl sm:text-2xl font-black font-mono text-blue-400">
            {summary.lockedCount} Active
          </div>
          <span className="text-[10px] text-blue-400/80 mt-1 block">
            {summary.fullyCollectedCount} ready to start
          </span>
        </div>
      </div>

      {/* ─── 3. Search & Filter Bar ─── */}
      <div className="bg-card/50 border border-gray-800 rounded-xl p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Type Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 custom-scrollbar">
          {(
            [
              { id: 'ALL', label: 'All Events' },
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

        {/* Status Select & Search Input */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-dark border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500 font-bold uppercase tracking-wider cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="FULLY_COLLECTED">Fully Collected (Ready)</option>
            <option value="PARTIALLY_COLLECTED">Partially Collected</option>
            <option value="LOCK_PENDING">Lock Pending (Blocked)</option>
            <option value="LOCKED">Locked in Escrow</option>
            <option value="RELEASED">Released</option>
            <option value="REFUNDED">Refunded</option>
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

      {/* ─── 4. Event Lock Table / Cards ─── */}
      {filteredLocks.length === 0 ? (
        <div className="text-center py-16 bg-card/20 rounded-2xl border border-gray-800">
          <Lock className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <h4 className="text-sm font-black uppercase text-white tracking-wider">No Event Locks Found</h4>
          <p className="text-xs text-gray-400 mt-1">
            {searchQuery || statusFilter !== 'ALL' || typeFilter !== 'ALL'
              ? 'No events match your current filter criteria.'
              : 'Create a tournament or scrim to track lock amounts and escrow balances.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredLocks.map((item) => {
            const isBlocked = !item.canStart && item.eventStatus !== 'live' && item.eventStatus !== 'completed';

            return (
              <div
                key={item.eventId}
                className="bg-card/40 border border-gray-800 rounded-2xl p-4 sm:p-5 shadow-md transition-all hover:border-gray-700/80"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-800/80 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="p-1.5 rounded-lg bg-dark border border-gray-800 text-brand-400">
                        {item.eventType === 'tournament' ? <Trophy className="w-4 h-4" /> : <Gamepad2 className="w-4 h-4" />}
                      </span>
                      <h4 className="text-base font-black text-white uppercase tracking-tight">
                        {item.eventName}
                      </h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-dark text-gray-400 border border-gray-800">
                        ID: {item.eventId.slice(0, 10)}
                      </span>
                      {renderStatusBadge(item.status)}
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-surface text-gray-300 border border-gray-800">
                        {item.isPaid ? 'Paid Event' : 'Free Event'}
                      </span>
                    </div>

                    <div className="text-xs text-gray-400 flex items-center gap-3 flex-wrap">
                      <span>Total Slots: <strong className="text-white">{item.totalSlots}</strong></span>
                      <span>•</span>
                      <span>Filled Slots: <strong className="text-brand-400">{item.filledSlots}</strong></span>
                      {item.startDate && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-gray-500" /> {formatDate(item.startDate)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Start Status & Actions */}
                  <div className="flex items-center gap-3">
                    {item.eventStatus === 'live' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-black uppercase tracking-wider">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Live Now
                      </span>
                    ) : item.eventStatus === 'completed' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/30 text-xs font-black uppercase tracking-wider">
                        <ShieldCheck className="w-3.5 h-3.5" /> Event Completed
                      </span>
                    ) : item.canStart ? (
                      <button
                        type="button"
                        disabled={startingEventId === item.eventId}
                        onClick={() => handleStartEvent(item)}
                        className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer transition-all active:scale-95"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>{startingEventId === item.eventId ? 'Starting...' : 'Start Event (Ready)'}</span>
                      </button>
                    ) : (
                      <div className="flex flex-col items-end">
                        <button
                          type="button"
                          disabled
                          className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30 cursor-not-allowed flex items-center gap-1.5"
                          title={item.cannotStartReason}
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Start Blocked</span>
                        </button>
                      </div>
                    )}

                    <a
                      href={item.eventType === 'tournament' ? `/tournaments/${item.eventId}` : `/scrims/${item.eventId}`}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-dark border border-gray-800 hover:border-brand-500 text-gray-300 hover:text-white flex items-center gap-1 transition-colors"
                    >
                      <span>Manage</span>
                      <ArrowUpRight className="w-3 h-3 opacity-60" />
                    </a>
                  </div>
                </div>

                {/* Progress bar and metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                  <div className="bg-dark/40 rounded-xl p-3 border border-gray-800/80">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">
                      Required Lock
                    </span>
                    <span className="text-base font-black font-mono text-white">
                      {formatCurrency(item.requiredLockAmount)}
                    </span>
                  </div>

                  <div className="bg-dark/40 rounded-xl p-3 border border-gray-800/80">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block mb-1">
                      Collected Amount
                    </span>
                    <span className="text-base font-black font-mono text-emerald-400">
                      {formatCurrency(item.collectedAmount)}
                    </span>
                  </div>

                  <div className="bg-dark/40 rounded-xl p-3 border border-gray-800/80">
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block mb-1">
                      Remaining Needed
                    </span>
                    <span className={`text-base font-black font-mono ${item.remainingAmount > 0 ? 'text-amber-400' : 'text-gray-400'}`}>
                      {formatCurrency(item.remainingAmount)}
                    </span>
                  </div>

                  <div className="bg-dark/40 rounded-xl p-3 border border-gray-800/80">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">
                      Coverage
                    </span>
                    <span className="text-base font-black font-mono text-white">
                      {item.collectionPercentage}%
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-3">
                  <div className="w-full bg-dark rounded-full h-2 border border-gray-800 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        item.canStart ? 'bg-emerald-500' : 'bg-gradient-to-r from-brand-600 to-amber-500'
                      }`}
                      style={{ width: `${item.collectionPercentage}%` }}
                    />
                  </div>
                </div>

                {/* Blocked Reason Explanation */}
                {isBlocked && item.cannotStartReason && (
                  <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                    <div>
                      <strong className="font-bold">Cannot Start Yet: </strong>
                      {item.cannotStartReason}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LockAmountsTab;
