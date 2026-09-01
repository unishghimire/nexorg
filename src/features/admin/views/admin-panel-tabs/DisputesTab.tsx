import React, { useState, useMemo } from 'react';
import { 
  ShieldAlert, AlertTriangle, CheckCircle2, XCircle, Search, 
  Clock, Filter, User, Gamepad2, AlertOctagon, RefreshCw, ShieldCheck,
  CreditCard, Trophy, DollarSign, Wallet
} from 'lucide-react';
import { AdminPanelTabProps } from './types';

export const DisputesTab: React.FC<AdminPanelTabProps> = (props) => {
  const disputes: any[] = props.allDisputes || [];
  const onResolveDispute = props.handleResolveDispute;
  const onRefresh = props.fetchDisputes;
  const formatDate = props.formatDate || ((d: any) => new Date(d).toLocaleString());
  const formatCurrency = props.formatCurrency || ((amt: number) => `NPR ${amt?.toLocaleString() || 0}`);

  const [typeFilter, setTypeFilter] = useState<'all' | 'tournaments' | 'payments'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'resolved' | 'dismissed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Computed metrics
  const metrics = useMemo(() => {
    const total = disputes.length;
    const tournamentCount = disputes.filter(d => (d.disputeType || 'tournament') !== 'payment').length;
    const paymentCount = disputes.filter(d => d.disputeType === 'payment').length;
    const pending = disputes.filter(d => (d.status || 'pending') === 'pending').length;
    const resolved = disputes.filter(d => d.status === 'resolved').length;
    const dismissed = disputes.filter(d => d.status === 'dismissed').length;
    return { total, tournamentCount, paymentCount, pending, resolved, dismissed };
  }, [disputes]);

  // Filtered list
  const filteredDisputes = useMemo(() => {
    return disputes.filter(d => {
      const isPayment = d.disputeType === 'payment';
      // Type filter
      if (typeFilter === 'tournaments' && isPayment) return false;
      if (typeFilter === 'payments' && !isPayment) return false;

      // Status filter
      const status = d.status || 'pending';
      if (statusFilter !== 'all' && status !== statusFilter) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTournament = (d.tournamentName || '').toLowerCase().includes(q);
        const matchesReporter = (d.reportedBy || d.username || d.reporterUid || '').toLowerCase().includes(q);
        const matchesAccused = (d.reportedTeamName || d.reportedTeamId || '').toLowerCase().includes(q);
        const matchesReason = (d.reason || '').toLowerCase().includes(q);
        const matchesRoom = (d.matchRoom || '').toLowerCase().includes(q);
        const matchesOrganizer = (d.organizerId || '').toLowerCase().includes(q);
        const matchesRefId = (d.refId || d.transactionId || '').toLowerCase().includes(q);
        return matchesTournament || matchesReporter || matchesAccused || matchesReason || matchesRoom || matchesOrganizer || matchesRefId;
      }
      return true;
    });
  }, [disputes, typeFilter, statusFilter, searchQuery]);

  const handleManualRefresh = async () => {
    if (onRefresh) {
      setIsRefreshing(true);
      await onRefresh();
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-red-950/40 via-surface to-dark border border-red-500/20 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-red-400 mb-1">
              <ShieldAlert className="w-4 h-4" /> Global Platform Match &amp; Wallet Integrity
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
              Disputes &amp; Reports Center
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 font-medium mt-1">
              Platform-wide moderation of participant match issues, cheating reports, and wallet payment disputes.
            </p>
          </div>

          {/* Quick Action Badges & Refresh */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="p-3 bg-surface hover:bg-surface/80 border border-gray-800 text-gray-400 hover:text-white rounded-xl transition flex items-center justify-center cursor-pointer"
              title="Refresh Disputes"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-brand-400' : ''}`} />
            </button>
            <div className="px-4 py-2 bg-surface/80 border border-gray-800 rounded-xl text-center">
              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total</div>
              <div className="text-lg font-black text-white">{metrics.total}</div>
            </div>
            <div className="px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-xl text-center">
              <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider">Pending</div>
              <div className="text-lg font-black text-red-400">{metrics.pending}</div>
            </div>
            <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center">
              <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Resolved</div>
              <div className="text-lg font-black text-emerald-400">{metrics.resolved}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Mode Switcher: Tournaments vs Payments vs All */}
      <div className="flex items-center gap-2 border-b border-gray-800 pb-3">
        <button
          type="button"
          onClick={() => setTypeFilter('all')}
          className={`flex items-center gap-2 px-5 py-3 rounded-full text-xs font-black uppercase tracking-wider transition ${
            typeFilter === 'all'
              ? 'bg-brand-500 text-white shadow-xl shadow-brand-500/20'
              : 'text-gray-400 hover:text-white hover:bg-surface'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>All Disputes ({metrics.total})</span>
        </button>

        <button
          type="button"
          onClick={() => setTypeFilter('tournaments')}
          className={`flex items-center gap-2 px-5 py-3 rounded-full text-xs font-black uppercase tracking-wider transition ${
            typeFilter === 'tournaments'
              ? 'bg-red-600 text-white shadow-xl shadow-red-600/20'
              : 'text-gray-400 hover:text-white hover:bg-surface'
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>Tournament &amp; Scrim Disputes ({metrics.tournamentCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setTypeFilter('payments')}
          className={`flex items-center gap-2 px-5 py-3 rounded-full text-xs font-black uppercase tracking-wider transition ${
            typeFilter === 'payments'
              ? 'bg-purple-600 text-white shadow-xl shadow-purple-600/20'
              : 'text-gray-400 hover:text-white hover:bg-surface'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>Wallet &amp; Payment Disputes ({metrics.paymentCount})</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface/40 p-2 rounded-2xl border border-gray-800">
        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto custom-scrollbar p-1">
          {[
            { id: 'all', label: 'All Statuses', count: filteredDisputes.length },
            { id: 'pending', label: 'Pending Review', count: filteredDisputes.filter(d => (d.status || 'pending') === 'pending').length },
            { id: 'resolved', label: 'Resolved', count: filteredDisputes.filter(d => d.status === 'resolved').length },
            { id: 'dismissed', label: 'Dismissed', count: filteredDisputes.filter(d => d.status === 'dismissed').length },
          ].map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition whitespace-nowrap flex items-center gap-2 ${
                statusFilter === f.id
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                  : 'text-gray-400 hover:text-white hover:bg-surface'
              }`}
            >
              <span>{f.label}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                statusFilter === f.id ? 'bg-white/20 text-white' : 'bg-gray-800 text-gray-400'
              }`}>
                {f.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by event, refId, player..."
            className="w-full bg-dark border border-gray-800 rounded-xl pl-10 pr-4 py-2 text-xs font-semibold text-white placeholder-gray-500 focus:border-red-500 focus-visible:outline-none transition"
          />
        </div>
      </div>

      {/* Disputes List */}
      {filteredDisputes.length === 0 ? (
        <div className="bg-surface/20 border border-dashed border-gray-800 rounded-3xl p-12 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center mx-auto text-gray-500">
            <ShieldCheck className="w-8 h-8 text-emerald-400" />
          </div>
          <h3 className="text-base font-black text-white uppercase tracking-wider">No Disputes Found</h3>
          <p className="text-xs text-gray-400 max-w-md mx-auto">
            {statusFilter !== 'all' || searchQuery.trim() || typeFilter !== 'all'
              ? 'No disputes match your selected filters.'
              : 'Zero active participant disputes on the platform.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredDisputes.map(dispute => {
            const isPending = (dispute.status || 'pending') === 'pending';
            const isResolved = dispute.status === 'resolved';
            const isPayment = dispute.disputeType === 'payment';

            return (
              <div
                key={dispute.id}
                className={`bg-card/70 border rounded-2xl p-5 sm:p-6 transition space-y-4 hover:border-gray-700 ${
                  isPending
                    ? 'border-red-500/30 shadow-lg shadow-red-950/20'
                    : isResolved
                    ? 'border-emerald-500/20'
                    : 'border-gray-800 opacity-80'
                }`}
              >
                {/* Card Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-800">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl border ${
                      isPayment
                        ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                        : isPending
                        ? 'bg-red-500/10 border-red-500/30 text-red-400'
                        : isResolved
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-gray-800 border-gray-700 text-gray-400'
                    }`}>
                      {isPayment ? (
                        <CreditCard className="w-5 h-5" />
                      ) : isPending ? (
                        <AlertOctagon className="w-5 h-5" />
                      ) : isResolved ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <XCircle className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-white uppercase tracking-tight">
                          {isPayment ? `Wallet Payment Dispute` : (dispute.tournamentName || 'Tournament / Scrim Event')}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase ${
                          isPayment ? 'bg-purple-900/40 text-purple-300 border border-purple-500/30' : 'bg-gray-800 text-gray-300'
                        }`}>
                          {isPayment ? (dispute.paymentType || 'WALLET') : (dispute.disputeType || 'TOURNAMENT')}
                        </span>
                        {dispute.matchRoom && !isPayment && (
                          <span className="px-2 py-0.5 bg-gray-800 text-gray-300 rounded-md text-[10px] font-mono font-bold uppercase">
                            Room: {dispute.matchRoom}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-400 font-semibold flex items-center gap-2 mt-0.5">
                        <Clock className="w-3 h-3 text-gray-500" />
                        <span>Filed: {formatDate(dispute.createdAt || dispute.filedAt)}</span>
                        <span>•</span>
                        <span className="font-mono text-gray-500">ID: {dispute.id.slice(0, 8)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Status Chip */}
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                      isPending
                        ? 'bg-red-500/20 text-red-300 border-red-500/40 animate-pulse'
                        : isResolved
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-gray-800 text-gray-400 border-gray-700'
                    }`}>
                      {isPending ? 'PENDING ACTION' : isResolved ? `RESOLVED (${dispute.resolutionAction || 'RESOLVED'})` : 'DISMISSED'}
                    </span>
                  </div>
                </div>

                {/* Parties Involved */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-surface/40 p-3 rounded-xl text-xs">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-400 shrink-0" />
                    <div>
                      <span className="text-gray-400 font-bold uppercase text-[10px]">User: </span>
                      <span className="text-white font-black">{dispute.reportedBy || dispute.username || dispute.reporterUid || 'Participant'}</span>
                    </div>
                  </div>

                  {isPayment ? (
                    <>
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div>
                          <span className="text-gray-400 font-bold uppercase text-[10px]">Amount: </span>
                          <span className="text-emerald-400 font-black">{dispute.amount ? formatCurrency(dispute.amount) : 'N/A'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-purple-400 shrink-0" />
                        <div>
                          <span className="text-gray-400 font-bold uppercase text-[10px]">Ref ID: </span>
                          <span className="text-gray-300 font-mono font-semibold">{dispute.refId || dispute.transactionId || 'N/A'}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {dispute.reportedTeamName && (
                        <div className="flex items-center gap-2">
                          <Gamepad2 className="w-4 h-4 text-red-400 shrink-0" />
                          <div>
                            <span className="text-gray-400 font-bold uppercase text-[10px]">Accused Team: </span>
                            <span className="text-white font-black">{dispute.reportedTeamName}</span>
                          </div>
                        </div>
                      )}
                      {dispute.organizerId && (
                        <div className="flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4 text-purple-400 shrink-0" />
                          <div>
                            <span className="text-gray-400 font-bold uppercase text-[10px]">Host/Org UID: </span>
                            <span className="text-gray-300 font-mono font-semibold">{dispute.organizerId.slice(0, 10)}...</span>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Dispute Reason / Description */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    {isPayment ? 'Payment Issue Description' : 'Match Incident Details & Evidence'}
                  </div>
                  <div className="p-3.5 bg-dark border border-gray-800 rounded-xl text-xs text-gray-200 font-medium leading-relaxed whitespace-pre-wrap">
                    {dispute.reason || 'No description provided.'}
                  </div>
                </div>

                {/* Admin Resolution Summary / Action Buttons */}
                {isPending ? (
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-gray-800/80">
                    <div className="text-xs text-gray-400 font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <span>Admin Resolution Action:</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onResolveDispute?.(dispute.id, 'dismiss')}
                        className="px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider transition"
                      >
                        Dismiss
                      </button>
                      <button
                        type="button"
                        onClick={() => onResolveDispute?.(dispute.id, 'warn')}
                        className="px-4 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold uppercase tracking-wider transition"
                      >
                        {isPayment ? 'Request Info' : 'Issue Warning'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onResolveDispute?.(dispute.id, 'ban')}
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-lg shadow-red-600/20"
                      >
                        {isPayment ? 'Approve & Refund' : 'Disqualify / Ban'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 flex items-center justify-between text-xs text-gray-400 border-t border-gray-800/60 font-semibold">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>
                        Action taken: <strong className="text-white uppercase">{dispute.resolutionAction || dispute.status}</strong>
                      </span>
                    </div>
                    {dispute.resolvedAt && (
                      <span className="text-[11px] text-gray-500 font-mono">
                        Resolved on {formatDate(dispute.resolvedAt)}
                      </span>
                    )}
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

export default DisputesTab;
