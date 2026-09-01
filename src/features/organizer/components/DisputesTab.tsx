import React, { useState, useMemo } from 'react';
import { 
  ShieldAlert, AlertTriangle, CheckCircle2, XCircle, Search, 
  Clock, Filter, User, Gamepad2, AlertOctagon, ChevronRight, ShieldCheck 
} from 'lucide-react';
import { formatDate } from '../../../shared/utils/utils';

interface DisputesTabProps {
  disputes: any[];
  onResolveDispute: (disputeId: string, action: 'warn' | 'ban' | 'dismiss') => void;
  onOpenDisputeOverlay?: (disputeId: string) => void;
}

export const DisputesTab: React.FC<DisputesTabProps> = ({
  disputes = [],
  onResolveDispute,
  onOpenDisputeOverlay,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'resolved' | 'dismissed'>('all');
  const [selectedDispute, setSelectedDispute] = useState<any | null>(null);

  // Computed metrics
  const metrics = useMemo(() => {
    const total = disputes.length;
    const pending = disputes.filter(d => (d.status || 'pending') === 'pending').length;
    const resolved = disputes.filter(d => d.status === 'resolved').length;
    const dismissed = disputes.filter(d => d.status === 'dismissed').length;
    return { total, pending, resolved, dismissed };
  }, [disputes]);

  // Filtered list
  const filteredDisputes = useMemo(() => {
    return disputes.filter(d => {
      // Status filter
      const status = d.status || 'pending';
      if (statusFilter !== 'all' && status !== statusFilter) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTournament = (d.tournamentName || '').toLowerCase().includes(q);
        const matchesReporter = (d.reportedBy || d.reporterUid || '').toLowerCase().includes(q);
        const matchesAccused = (d.reportedTeamName || d.reportedTeamId || '').toLowerCase().includes(q);
        const matchesReason = (d.reason || '').toLowerCase().includes(q);
        const matchesRoom = (d.matchRoom || '').toLowerCase().includes(q);
        return matchesTournament || matchesReporter || matchesAccused || matchesReason || matchesRoom;
      }
      return true;
    });
  }, [disputes, statusFilter, searchQuery]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-red-950/40 via-surface to-dark border border-red-500/20 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-red-400 mb-1">
              <ShieldAlert className="w-4 h-4" /> Match Integrity &amp; Dispute Management
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
              Player Disputes &amp; Incidents
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 font-medium mt-1">
              Review, investigate, and take official disciplinary actions on participant match reports.
            </p>
          </div>

          {/* Quick Action Badges */}
          <div className="flex items-center gap-3">
            <div className="px-4 py-2.5 bg-surface/80 border border-gray-800 rounded-xl text-center">
              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Filed</div>
              <div className="text-lg font-black text-white">{metrics.total}</div>
            </div>
            <div className="px-4 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-center">
              <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider">Pending Action</div>
              <div className="text-lg font-black text-red-400">{metrics.pending}</div>
            </div>
            <div className="px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center">
              <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Resolved</div>
              <div className="text-lg font-black text-emerald-400">{metrics.resolved}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface/40 p-2 rounded-2xl border border-gray-800">
        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto custom-scrollbar p-1">
          {[
            { id: 'all', label: 'All Disputes', count: metrics.total },
            { id: 'pending', label: 'Pending Review', count: metrics.pending },
            { id: 'resolved', label: 'Resolved', count: metrics.resolved },
            { id: 'dismissed', label: 'Dismissed', count: metrics.dismissed },
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
            placeholder="Search by event, team, player..."
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
            {statusFilter !== 'all' || searchQuery.trim()
              ? 'No disputes match your selected filter or search query.'
              : 'All matches are running smoothly with zero active participant disputes.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredDisputes.map(dispute => {
            const isPending = (dispute.status || 'pending') === 'pending';
            const isResolved = dispute.status === 'resolved';
            const isDismissed = dispute.status === 'dismissed';

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
                      isPending
                        ? 'bg-red-500/10 border-red-500/30 text-red-400'
                        : isResolved
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-gray-800 border-gray-700 text-gray-400'
                    }`}>
                      {isPending ? <AlertOctagon className="w-5 h-5" /> : isResolved ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-white uppercase tracking-tight">
                          {dispute.tournamentName || 'Tournament / Scrim Event'}
                        </span>
                        {dispute.matchRoom && (
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-surface/40 p-3 rounded-xl text-xs">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-400 shrink-0" />
                    <div>
                      <span className="text-gray-400 font-bold uppercase text-[10px]">Reported By: </span>
                      <span className="text-white font-black">{dispute.reportedBy || dispute.reporterUid || 'Participant'}</span>
                    </div>
                  </div>
                  {dispute.reportedTeamName && (
                    <div className="flex items-center gap-2">
                      <Gamepad2 className="w-4 h-4 text-red-400 shrink-0" />
                      <div>
                        <span className="text-gray-400 font-bold uppercase text-[10px]">Accused Team / Player: </span>
                        <span className="text-white font-black">{dispute.reportedTeamName}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Dispute Reason / Description */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Dispute Reason &amp; Evidence
                  </div>
                  <div className="p-3.5 bg-dark border border-gray-800 rounded-xl text-xs text-gray-200 font-medium leading-relaxed whitespace-pre-wrap">
                    {dispute.reason || 'No description provided.'}
                  </div>
                </div>

                {/* Resolution Summary / Action Buttons */}
                {isPending ? (
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-gray-800/80">
                    <div className="text-xs text-gray-400 font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <span>Take official resolution action:</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onResolveDispute(dispute.id, 'dismiss')}
                        className="px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider transition"
                      >
                        Dismiss
                      </button>
                      <button
                        type="button"
                        onClick={() => onResolveDispute(dispute.id, 'warn')}
                        className="px-4 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold uppercase tracking-wider transition"
                      >
                        Issue Warning
                      </button>
                      <button
                        type="button"
                        onClick={() => onResolveDispute(dispute.id, 'ban')}
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-lg shadow-red-600/20"
                      >
                        Disqualify / Ban
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
