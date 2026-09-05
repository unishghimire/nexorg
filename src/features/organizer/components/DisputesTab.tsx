import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  Clock,
  Filter,
  User,
  Gamepad2,
  AlertOctagon,
  ChevronRight,
  ShieldCheck,
  Trophy,
  Flame,
  CreditCard,
  Image as ImageIcon,
  ExternalLink,
  MessageSquare,
  Ban,
  Eye,
  X,
  ZoomIn,
  Info,
  Shield,
  Send,
} from 'lucide-react';
import { formatDate, sanitizeUrl } from '../../../shared/utils/utils';

export interface DisputesTabProps {
  disputes: any[];
  onResolveDispute: (
    disputeId: string,
    action: 'warn' | 'ban' | 'dismiss',
    resolutionNote?: string
  ) => void;
  onOpenDisputeOverlay?: (disputeId: string) => void;
}

const CATEGORIES = [
  { id: 'all', label: 'All Categories' },
  { id: 'match_room', label: '⚔️ Match Room Issues', matchKeywords: ['room', 'match_room', 'lobby', 'slot', 'wrong room'] },
  { id: 'cheating_rules', label: '🛡️ Cheating / Rules', matchKeywords: ['cheat', 'cheating', 'hack', 'rule', 'grief', 'ringer', 'illegal'] },
  { id: 'score_discrepancy', label: '📊 Score / Results', matchKeywords: ['score', 'result', 'kill', 'placement', 'points', 'discrepancy'] },
  { id: 'prize_payout', label: '💰 Prize / Payment', matchKeywords: ['prize', 'payout', 'payment', 'wallet', 'money', 'withdraw', 'transfer'] },
  { id: 'other', label: '❓ Other Reports', matchKeywords: ['other', 'general'] },
];

export const DisputesTab: React.FC<DisputesTabProps> = ({
  disputes = [],
  onResolveDispute,
  onOpenDisputeOverlay,
}) => {
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'resolved' | 'dismissed'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [eventTypeFilter, setEventTypeFilter] = useState<'all' | 'tournaments' | 'scrims' | 'payment'>('all');

  // Interactive Investigation & Resolution Modal State
  const [investigatingDispute, setInvestigatingDispute] = useState<any | null>(null);
  const [resolutionAction, setResolutionAction] = useState<'warn' | 'ban' | 'dismiss'>('warn');
  const [resolutionNote, setResolutionNote] = useState('');
  const [isSubmittingResolution, setIsSubmittingResolution] = useState(false);

  // Evidence Lightbox State
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Computed KPI Metrics
  const metrics = useMemo(() => {
    const total = disputes.length;
    const pending = disputes.filter(d => (d.status || 'pending') === 'pending').length;
    const resolved = disputes.filter(d => d.status === 'resolved').length;
    const dismissed = disputes.filter(d => d.status === 'dismissed').length;
    const warnings = disputes.filter(d => d.resolutionAction === 'warn').length;
    const bans = disputes.filter(d => d.resolutionAction === 'ban').length;

    return { total, pending, resolved, dismissed, warnings, bans };
  }, [disputes]);

  // Helper to detect category from dispute data
  const detectCategory = (dispute: any): string => {
    if (dispute.category) return dispute.category;
    if (dispute.disputeType === 'payment') return 'prize_payout';

    const text = `${dispute.reason || ''} ${dispute.disputeType || ''}`.toLowerCase();
    for (const cat of CATEGORIES) {
      if (cat.matchKeywords && cat.matchKeywords.some(kw => text.includes(kw))) {
        return cat.id;
      }
    }
    return 'other';
  };

  // Filtered disputes list
  const filteredDisputes = useMemo(() => {
    return disputes.filter(dispute => {
      const status = dispute.status || 'pending';
      const isScrim = dispute.disputeType === 'scrim' || dispute.isScrim === true || (dispute.tournamentName && dispute.tournamentName.toLowerCase().includes('scrim'));
      const isPayment = dispute.disputeType === 'payment';
      const category = detectCategory(dispute);

      // Status filter
      if (statusFilter !== 'all' && status !== statusFilter) return false;

      // Event type filter
      if (eventTypeFilter === 'tournaments' && (isScrim || isPayment)) return false;
      if (eventTypeFilter === 'scrims' && (!isScrim || isPayment)) return false;
      if (eventTypeFilter === 'payment' && !isPayment) return false;

      // Category filter
      if (categoryFilter !== 'all' && category !== categoryFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesEvent = (dispute.tournamentName || '').toLowerCase().includes(q);
        const matchesReporter = (dispute.reportedBy || dispute.reporterUid || dispute.username || '').toLowerCase().includes(q);
        const matchesAccused = (dispute.reportedTeamName || dispute.reportedTeamId || '').toLowerCase().includes(q);
        const matchesReason = (dispute.reason || '').toLowerCase().includes(q);
        const matchesRoom = (String(dispute.matchRoom || '')).toLowerCase().includes(q);
        const matchesId = (dispute.id || '').toLowerCase().includes(q);
        return matchesEvent || matchesReporter || matchesAccused || matchesReason || matchesRoom || matchesId;
      }

      return true;
    });
  }, [disputes, statusFilter, categoryFilter, eventTypeFilter, searchQuery]);

  // Open investigation modal
  const handleOpenInvestigate = (dispute: any) => {
    setInvestigatingDispute(dispute);
    setResolutionAction('warn');
    setResolutionNote(dispute.resolutionNote || '');
  };

  // Submit dispute resolution
  const handleConfirmResolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!investigatingDispute) return;

    setIsSubmittingResolution(true);
    try {
      await onResolveDispute(investigatingDispute.id, resolutionAction, resolutionNote.trim() || undefined);
      setInvestigatingDispute(null);
    } finally {
      setIsSubmittingResolution(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* 1. Header Banner & KPIs */}
      <div className="bg-gradient-to-r from-red-950/40 via-surface to-dark border border-red-500/20 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-red-400 mb-1">
              <ShieldAlert className="w-4 h-4 animate-pulse" /> Match Integrity &amp; Dispute Command Center
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
              Player Disputes &amp; Incidents
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 font-medium mt-1">
              Investigate match room incidents, examine screenshot evidence, and take disciplinary action across Tournaments and Scrims.
            </p>
          </div>

          {/* KPI Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="px-4 py-2.5 bg-surface/80 border border-gray-800 rounded-xl text-center">
              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Filed</div>
              <div className="text-lg font-black text-white">{metrics.total}</div>
            </div>
            <div className="px-4 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-center">
              <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider flex items-center justify-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" /> Pending
              </div>
              <div className="text-lg font-black text-red-400">{metrics.pending}</div>
            </div>
            <div className="px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-center">
              <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Warnings</div>
              <div className="text-lg font-black text-amber-400">{metrics.warnings}</div>
            </div>
            <div className="px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center">
              <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Resolved</div>
              <div className="text-lg font-black text-emerald-400">{metrics.resolved}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Controls Toolbar: Status, Category, Event Type & Search */}
      <div className="space-y-3 bg-surface/40 p-3 rounded-2xl border border-gray-800">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Status Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 md:pb-0">
            {[
              { id: 'all', label: 'All Disputes', count: metrics.total },
              { id: 'pending', label: '🚨 Pending Action', count: metrics.pending },
              { id: 'resolved', label: '✅ Resolved', count: metrics.resolved },
              { id: 'dismissed', label: '📁 Dismissed', count: metrics.dismissed },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as any)}
                className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition whitespace-nowrap flex items-center gap-2 ${
                  statusFilter === tab.id
                    ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                    : 'text-gray-400 hover:text-white hover:bg-surface'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  statusFilter === tab.id ? 'bg-white/20 text-white' : 'bg-gray-800 text-gray-400'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by event, team, player, room #..."
              className="w-full bg-dark border border-gray-800 rounded-xl pl-10 pr-8 py-2 text-xs font-semibold text-white placeholder-gray-500 focus:border-red-500 focus-visible:outline-none transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Secondary Filter Bar: Event Type & Categories */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-800/60">
          {/* Event Type Filter */}
          <div className="flex items-center gap-1 bg-dark/60 p-1 rounded-xl border border-gray-800">
            <button
              type="button"
              onClick={() => setEventTypeFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                eventTypeFilter === 'all' ? 'bg-surface text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              All Events
            </button>
            <button
              type="button"
              onClick={() => setEventTypeFilter('tournaments')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                eventTypeFilter === 'tournaments' ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Trophy className="w-3 h-3 text-amber-400" /> Tournaments
            </button>
            <button
              type="button"
              onClick={() => setEventTypeFilter('scrims')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                eventTypeFilter === 'scrims' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Flame className="w-3 h-3 text-orange-400" /> Scrims
            </button>
          </div>

          {/* Category Dropdown Pills */}
          <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id)}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  categoryFilter === cat.id
                    ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-surface/50'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Disputes List */}
      {filteredDisputes.length === 0 ? (
        <div className="bg-surface/20 border border-dashed border-gray-800 rounded-3xl p-12 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center mx-auto text-gray-500">
            <ShieldCheck className="w-8 h-8 text-emerald-400" />
          </div>
          <h3 className="text-base font-black text-white uppercase tracking-wider">No Disputes Found</h3>
          <p className="text-xs text-gray-400 max-w-md mx-auto">
            {statusFilter !== 'all' || categoryFilter !== 'all' || eventTypeFilter !== 'all' || searchQuery.trim()
              ? 'No disputes match your current filter or search criteria.'
              : 'All tournament and scrim matches are operating smoothly with zero active disputes.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          {filteredDisputes.map(dispute => {
            const status = dispute.status || 'pending';
            const isPending = status === 'pending';
            const isResolved = status === 'resolved';
            const isDismissed = status === 'dismissed';

            const isScrim = dispute.disputeType === 'scrim' || dispute.isScrim === true || (dispute.tournamentName && dispute.tournamentName.toLowerCase().includes('scrim'));
            const isPayment = dispute.disputeType === 'payment';
            const detectedCat = detectCategory(dispute);
            const catMeta = CATEGORIES.find(c => c.id === detectedCat);

            const evidenceImage = dispute.evidenceUrl || dispute.screenshotUrl || dispute.imageUrl || dispute.proofUrl || dispute.attachmentUrl;

            return (
              <div
                key={dispute.id}
                className={`bg-card/90 border rounded-2xl p-5 sm:p-6 transition-all space-y-4 hover:border-gray-700 ${
                  isPending
                    ? 'border-red-500/40 shadow-xl shadow-red-950/20'
                    : isResolved
                    ? 'border-emerald-500/20'
                    : 'border-gray-800 opacity-80'
                }`}
              >
                {/* Card Header: Event info, Category & Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-800">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl border shrink-0 ${
                      isPending
                        ? 'bg-red-500/10 border-red-500/30 text-red-400'
                        : isResolved
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-gray-800 border-gray-700 text-gray-400'
                    }`}>
                      {isPending ? (
                        <AlertOctagon className="w-5 h-5 animate-pulse" />
                      ) : isResolved ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <XCircle className="w-5 h-5" />
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isScrim ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center gap-1">
                            <Flame className="w-3 h-3" /> Scrim
                          </span>
                        ) : isPayment ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                            <CreditCard className="w-3 h-3" /> Wallet
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-brand-500/20 text-brand-300 border border-brand-500/30 flex items-center gap-1">
                            <Trophy className="w-3 h-3 text-amber-400" /> Tournament
                          </span>
                        )}

                        <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-tight">
                          {dispute.tournamentName || (isPayment ? `Wallet Ref #${dispute.refId || dispute.transactionId || 'Tx'}` : 'Match Event')}
                        </h3>

                        {dispute.matchRoom && (
                          <span className="px-2 py-0.5 bg-gray-800 text-gray-300 rounded-md text-[10px] font-mono font-bold uppercase">
                            Room #{dispute.matchRoom}
                          </span>
                        )}

                        <span className="text-[10px] font-bold text-gray-400 bg-surface px-2 py-0.5 rounded border border-gray-800">
                          {catMeta?.label || '⚔️ Incident'}
                        </span>
                      </div>

                      <div className="text-[11px] text-gray-400 font-semibold flex items-center gap-2">
                        <Clock className="w-3 h-3 text-gray-500" />
                        <span>Filed: {formatDate(dispute.createdAt || dispute.filedAt)}</span>
                        <span>•</span>
                        <span className="font-mono text-gray-500">Case #{dispute.id.slice(0, 8)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Status Chip */}
                  <div className="shrink-0">
                    <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                      isPending
                        ? 'bg-red-500/20 text-red-300 border-red-500/40 animate-pulse'
                        : isResolved
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-gray-800 text-gray-400 border-gray-700'
                    }`}>
                      {isPending
                        ? 'PENDING REVIEW'
                        : isResolved
                        ? `RESOLVED: ${dispute.resolutionAction === 'ban' ? 'DISQUALIFIED' : dispute.resolutionAction === 'warn' ? 'WARNING' : 'RESOLVED'}`
                        : 'DISMISSED'}
                    </span>
                  </div>
                </div>

                {/* Parties Involved */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-surface/40 p-3 rounded-xl text-xs border border-gray-800/60">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-400 shrink-0" />
                    <div>
                      <span className="text-gray-400 font-bold uppercase text-[10px]">Reported By: </span>
                      <span className="text-white font-black">{dispute.reportedBy || dispute.reporterUid || dispute.username || 'Participant'}</span>
                    </div>
                  </div>

                  {(dispute.reportedTeamName || dispute.reportedTeamId) && (
                    <div className="flex items-center gap-2">
                      <Gamepad2 className="w-4 h-4 text-red-400 shrink-0" />
                      <div>
                        <span className="text-gray-400 font-bold uppercase text-[10px]">Accused Team / Player: </span>
                        <span className="text-red-300 font-black">{dispute.reportedTeamName || dispute.reportedTeamId}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Dispute Reason & Description */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                    <MessageSquare className="w-3 h-3 text-gray-500" /> Dispute Reason &amp; Player Statement
                  </div>
                  <div className="p-3.5 bg-dark border border-gray-800 rounded-xl text-xs text-gray-200 font-medium leading-relaxed whitespace-pre-wrap">
                    {dispute.reason || 'No description provided by participant.'}
                  </div>
                </div>

                {/* Evidence Image Attachment (if present) */}
                {evidenceImage ? (
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                      <ImageIcon className="w-3 h-3 text-emerald-400" /> Evidence Attachment / Screenshot
                    </div>
                    <div className="relative inline-block group">
                      <img
                        src={evidenceImage}
                        alt="Dispute Screenshot Evidence"
                        className="max-h-48 max-w-full rounded-xl border border-gray-800 object-cover cursor-pointer hover:border-emerald-500 transition"
                        onClick={() => setLightboxImage(evidenceImage)}
                      />
                      <button
                        type="button"
                        onClick={() => setLightboxImage(evidenceImage)}
                        className="absolute bottom-2 right-2 px-2.5 py-1 bg-black/80 hover:bg-black text-white text-[10px] font-bold rounded-lg flex items-center gap-1 border border-gray-700 backdrop-blur-sm transition"
                      >
                        <ZoomIn className="w-3 h-3 text-emerald-400" /> Inspect Full Image
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-gray-500 italic flex items-center gap-1.5">
                    <Info className="w-3 h-3 text-gray-600" /> No screenshot evidence attached to this report.
                  </div>
                )}

                {/* Resolution Summary / Action Buttons */}
                {isPending ? (
                  <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-gray-800">
                    <div className="text-xs text-gray-400 font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <span>Take official resolution action:</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenInvestigate(dispute)}
                        className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-md shadow-brand-950/30 flex items-center gap-1.5"
                      >
                        <Shield className="w-3.5 h-3.5" /> Investigate &amp; Resolve
                      </button>
                      <button
                        type="button"
                        onClick={() => onResolveDispute(dispute.id, 'dismiss')}
                        className="px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider transition"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-3 border-t border-gray-800 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400 font-semibold">
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

                    {dispute.resolutionNote && (
                      <div className="p-3 bg-surface/50 border border-gray-800/80 rounded-xl text-xs text-gray-300">
                        <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                          Organizer Decision Note:
                        </span>
                        {dispute.resolutionNote}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Interactive Investigation & Resolution Modal */}
      {investigatingDispute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-gray-800 rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-tight">
                    Dispute Investigation &amp; Resolution
                  </h3>
                  <p className="text-xs text-gray-400 truncate max-w-xs">
                    {investigatingDispute.tournamentName || 'Match Event'} • Case #{investigatingDispute.id.slice(0, 8)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInvestigatingDispute(null)}
                className="text-gray-500 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmResolution} className="space-y-4">
              {/* Summary of Parties */}
              <div className="bg-dark/80 border border-gray-800 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Reporter:</span>
                  <span className="font-bold text-white">{investigatingDispute.reportedBy || investigatingDispute.reporterUid || 'Participant'}</span>
                </div>
                {investigatingDispute.reportedTeamName && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Accused Party:</span>
                    <span className="font-bold text-red-400">{investigatingDispute.reportedTeamName}</span>
                  </div>
                )}
                {investigatingDispute.matchRoom && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Match Room #:</span>
                    <span className="font-mono font-bold text-white">{investigatingDispute.matchRoom}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-gray-800/80">
                  <span className="text-gray-400 block mb-1">Reason:</span>
                  <p className="text-gray-200 bg-surface/40 p-2 rounded-lg font-medium">
                    {investigatingDispute.reason}
                  </p>
                </div>
              </div>

              {/* Resolution Action Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-300">
                  Resolution Decision <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setResolutionAction('dismiss')}
                    className={`p-3 rounded-xl border text-xs font-bold uppercase tracking-wider text-center transition ${
                      resolutionAction === 'dismiss'
                        ? 'bg-gray-800 border-gray-600 text-white shadow-md'
                        : 'bg-card border-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    Dismiss Report
                  </button>
                  <button
                    type="button"
                    onClick={() => setResolutionAction('warn')}
                    className={`p-3 rounded-xl border text-xs font-bold uppercase tracking-wider text-center transition ${
                      resolutionAction === 'warn'
                        ? 'bg-amber-600/30 border-amber-500 text-amber-300 shadow-md'
                        : 'bg-card border-gray-800 text-gray-400 hover:text-amber-300'
                    }`}
                  >
                    Issue Warning
                  </button>
                  <button
                    type="button"
                    onClick={() => setResolutionAction('ban')}
                    className={`p-3 rounded-xl border text-xs font-black uppercase tracking-wider text-center transition ${
                      resolutionAction === 'ban'
                        ? 'bg-red-600 border-red-500 text-white shadow-md shadow-red-950/40'
                        : 'bg-card border-gray-800 text-gray-400 hover:text-red-400'
                    }`}
                  >
                    Disqualify / Ban
                  </button>
                </div>
              </div>

              {/* Resolution Explanation / Note */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-300">
                  Organizer Explanation &amp; Message to Players
                </label>
                <textarea
                  value={resolutionNote}
                  onChange={e => setResolutionNote(e.target.value)}
                  rows={3}
                  placeholder="Explain your ruling. This will be visible on the dispute and dispatched via in-app notification to the reporter and accused players."
                  className="w-full bg-dark border border-gray-800 rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:border-red-500 focus-visible:outline-none transition leading-relaxed"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setInvestigatingDispute(null)}
                  className="flex-1 bg-surface hover:bg-surface text-gray-300 hover:text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wider border border-gray-700 transition"
                  disabled={isSubmittingResolution}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingResolution}
                  className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-lg ${
                    resolutionAction === 'ban'
                      ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-950/40'
                      : resolutionAction === 'warn'
                      ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-950/40'
                      : 'bg-surface hover:bg-surface text-white border border-gray-600'
                  }`}
                >
                  {isSubmittingResolution ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>{isSubmittingResolution ? 'Saving...' : 'Apply Ruling'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Fullscreen Evidence Lightbox */}
      {lightboxImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-fade-in">
          <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute -top-10 right-0 text-gray-400 hover:text-white p-1 rounded-lg transition"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={lightboxImage}
              alt="Full Evidence Screenshot"
              className="max-h-[85vh] max-w-full object-contain rounded-2xl border border-gray-800 shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default DisputesTab;
