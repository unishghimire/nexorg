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
  Edit3,
  RotateCcw,
  Trash2,
  Check,
  AlertCircle,
  Wrench,
  Sparkles,
  FileText,
} from 'lucide-react';
import { formatDate, sanitizeUrl } from '../../../shared/utils/utils';

export interface DisputesTabProps {
  disputes: any[];
  onResolveDispute: (
    disputeId: string,
    action: 'solve' | 'warn' | 'ban' | 'dismiss',
    resolutionNote?: string
  ) => void;
  onUpdateDispute?: (
    disputeId: string,
    updates: {
      status?: 'pending' | 'resolved' | 'dismissed';
      resolutionAction?: 'solve' | 'warn' | 'ban' | 'dismiss' | 'none';
      resolutionNote?: string;
      reason?: string;
      matchRoom?: string;
      reportedTeamName?: string;
      category?: string;
    },
    notifyPlayers?: boolean
  ) => Promise<void> | void;
  onDeleteDispute?: (disputeId: string) => Promise<void> | void;
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

const PRESET_NOTES = [
  { label: '✅ Issue Solved & Settled', text: 'Dispute investigated and successfully solved by tournament organizer. All match adjustments or room issues have been settled.' },
  { label: 'Insufficient Evidence', text: 'Dispute dismissed due to insufficient evidence or lack of valid screenshot/video proof.' },
  { label: 'Room Rule Violation Warning', text: 'Official warning issued for violating match room settings and player conduct regulations.' },
  { label: 'Illegal Ringer Disqualification', text: 'Accused team disqualified for utilizing unregistered players or prohibited third-party ringers.' },
  { label: 'Correction / Reversal', text: 'Correction: Past disciplinary ruling was reviewed and corrected by the tournament organizer.' },
  { label: 'Score Adjusted', text: 'Match scores and placement points have been manually recalculated and corrected on the leaderboard.' },
];

export const DisputesTab: React.FC<DisputesTabProps> = ({
  disputes = [],
  onResolveDispute,
  onUpdateDispute,
  onDeleteDispute,
  onOpenDisputeOverlay,
}) => {
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'resolved' | 'dismissed'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [eventTypeFilter, setEventTypeFilter] = useState<'all' | 'tournaments' | 'scrims' | 'payment'>('all');

  // Interactive Investigation & Resolution Modal State (For Pending Reports)
  const [investigatingDispute, setInvestigatingDispute] = useState<any | null>(null);
  const [resolutionAction, setResolutionAction] = useState<'solve' | 'warn' | 'ban' | 'dismiss'>('solve');
  const [resolutionNote, setResolutionNote] = useState('');
  const [isSubmittingResolution, setIsSubmittingResolution] = useState(false);

  // Full Dispute Editor & Past Error Fixer Modal State
  const [editingDispute, setEditingDispute] = useState<any | null>(null);
  const [editStatus, setEditStatus] = useState<'pending' | 'resolved' | 'dismissed'>('resolved');
  const [editAction, setEditAction] = useState<'solve' | 'warn' | 'ban' | 'dismiss' | 'none'>('solve');
  const [editNote, setEditNote] = useState('');
  const [editMatchRoom, setEditMatchRoom] = useState('');
  const [editAccused, setEditAccused] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editNotifyPlayers, setEditNotifyPlayers] = useState(true);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [quickFixSuccessId, setQuickFixSuccessId] = useState<string | null>(null);

  // Evidence Lightbox State
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

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

  // Helper to check if a dispute record has past errors or missing fields
  const hasPastRecordError = (dispute: any): boolean => {
    const status = dispute.status;
    if (!status) return true;
    if (status === 'resolved' && !dispute.resolutionAction) return true;
    return false;
  };

  // Computed KPI Metrics
  const metrics = useMemo(() => {
    const total = disputes.length;
    const pending = disputes.filter(d => (d.status || 'pending') === 'pending').length;
    const resolved = disputes.filter(d => d.status === 'resolved').length;
    const dismissed = disputes.filter(d => d.status === 'dismissed').length;
    const solved = disputes.filter(d => d.resolutionAction === 'solve' || (d.status === 'resolved' && d.resolutionAction !== 'warn' && d.resolutionAction !== 'ban')).length;
    const warnings = disputes.filter(d => d.resolutionAction === 'warn').length;
    const bans = disputes.filter(d => d.resolutionAction === 'ban').length;
    const pastErrors = disputes.filter(hasPastRecordError).length;

    return { total, pending, resolved, dismissed, solved, warnings, bans, pastErrors };
  }, [disputes]);

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

  // Open investigation modal (for fresh pending reports)
  const handleOpenInvestigate = (dispute: any) => {
    setInvestigatingDispute(dispute);
    setResolutionAction('solve');
    setResolutionNote(dispute.resolutionNote || 'Issue investigated, solved, and settled by tournament organizer.');
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

  // Open Full Editor & Past Error Fixer
  const handleOpenEdit = (dispute: any) => {
    setEditingDispute(dispute);
    setEditStatus(dispute.status || 'resolved');
    setEditAction(dispute.resolutionAction || (dispute.status === 'dismissed' ? 'dismiss' : 'solve'));
    setEditNote(dispute.resolutionNote || '');
    setEditMatchRoom(dispute.matchRoom || '');
    setEditAccused(dispute.reportedTeamName || dispute.reportedTeamId || '');
    setEditCategory(detectCategory(dispute));
    setEditReason(dispute.reason || '');
    setEditNotifyPlayers(true);
    setShowDeleteConfirm(false);
  };

  // Submit Edit / Past Error Correction
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDispute) return;

    setIsSavingEdit(true);
    try {
      const updates = {
        status: editStatus,
        resolutionAction: editAction === 'none' ? undefined : editAction,
        resolutionNote: editNote.trim(),
        matchRoom: editMatchRoom.trim() || undefined,
        reportedTeamName: editAccused.trim() || undefined,
        category: editCategory !== 'all' ? editCategory : undefined,
        reason: editReason.trim() || editingDispute.reason,
      };

      if (onUpdateDispute) {
        await onUpdateDispute(editingDispute.id, updates, editNotifyPlayers);
      } else {
        // Fallback to onResolveDispute if available
        const fallbackAction = editAction === 'none' ? 'dismiss' : (editAction as any);
        await onResolveDispute(editingDispute.id, fallbackAction, editNote.trim());
      }
      setEditingDispute(null);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Quick 1-Click Fix for Past Broken Records
  const handleQuickFixRecord = async (dispute: any) => {
    if (!onUpdateDispute) return;
    try {
      const defaultStatus = dispute.status || 'pending';
      const defaultAction = dispute.resolutionAction || (defaultStatus === 'dismissed' ? 'dismiss' : defaultStatus === 'resolved' ? 'solve' : 'none');
      await onUpdateDispute(
        dispute.id,
        {
          status: defaultStatus,
          resolutionAction: defaultAction === 'none' ? undefined : (defaultAction as any),
          resolutionNote: dispute.resolutionNote || 'Record normalized and solved by organizer.',
        },
        false
      );
      setQuickFixSuccessId(dispute.id);
      setTimeout(() => setQuickFixSuccessId(null), 2500);
    } catch (err) {
      console.warn('Quick fix dispute failed:', err);
    }
  };

  // 1-Click Re-open Dispute
  const handleReopenDispute = async (dispute: any) => {
    if (!onUpdateDispute) {
      onResolveDispute(dispute.id, 'warn', 'Reopened by organizer for reinvestigation.');
      return;
    }
    await onUpdateDispute(
      dispute.id,
      {
        status: 'pending',
        resolutionAction: 'none',
        resolutionNote: 'Case reopened by organizer for fresh review and evidence verification.',
      },
      true
    );
  };

  // Delete Dispute
  const handleDeleteConfirm = async () => {
    if (!editingDispute || !onDeleteDispute) return;
    setIsSavingEdit(true);
    try {
      await onDeleteDispute(editingDispute.id);
      setEditingDispute(null);
    } finally {
      setIsSavingEdit(false);
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
              Investigate match reports, mark issues as solved, edit and correct past rulings, and manage tournament/scrim dispute records.
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
            <div className="px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center">
              <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Solved
              </div>
              <div className="text-lg font-black text-emerald-400">{metrics.solved}</div>
            </div>
            <div className="px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-center">
              <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Warnings &amp; Bans</div>
              <div className="text-lg font-black text-amber-400">{metrics.warnings + metrics.bans}</div>
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
              { id: 'resolved', label: '✅ Resolved & Solved', count: metrics.resolved },
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

            const isPastError = hasPastRecordError(dispute);
            const evidenceImage = dispute.evidenceUrl || dispute.screenshotUrl || dispute.imageUrl || dispute.proofUrl || dispute.attachmentUrl;

            return (
              <div
                key={dispute.id}
                className={`bg-card/90 border rounded-2xl p-5 sm:p-6 transition-all space-y-4 hover:border-gray-700 ${
                  isPending
                    ? 'border-red-500/40 shadow-xl shadow-red-950/20'
                    : isPastError
                    ? 'border-amber-500/40'
                    : isResolved
                    ? 'border-emerald-500/20'
                    : 'border-gray-800 opacity-90'
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

                        {isPastError && (
                          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded text-[10px] font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Inconsistent Record
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-gray-400 font-semibold flex items-center gap-2">
                        <Clock className="w-3 h-3 text-gray-500" />
                        <span>Filed: {formatDate(dispute.createdAt || dispute.filedAt)}</span>
                        <span>•</span>
                        <span className="font-mono text-gray-500">Case #{dispute.id.slice(0, 8)}</span>
                        {dispute.lastEditedAt && (
                          <span className="text-[10px] text-gray-500 italic">
                            (Edited: {formatDate(dispute.lastEditedAt)})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Chip & Quick Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                      isPending
                        ? 'bg-red-500/20 text-red-300 border-red-500/40 animate-pulse'
                        : isResolved
                        ? dispute.resolutionAction === 'solve'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : dispute.resolutionAction === 'ban'
                          ? 'bg-red-500/20 text-red-300 border-red-500/40'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-gray-800 text-gray-400 border-gray-700'
                    }`}>
                      {isPending
                        ? 'PENDING REVIEW'
                        : isResolved
                        ? dispute.resolutionAction === 'ban'
                          ? 'RESOLVED: DISQUALIFIED'
                          : dispute.resolutionAction === 'warn'
                          ? 'RESOLVED: WARNING'
                          : 'RESOLVED: SOLVED'
                        : 'DISMISSED'}
                    </span>

                    {/* Edit Dispute / Ruling Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(dispute)}
                      className="p-1.5 text-gray-400 hover:text-white bg-surface hover:bg-surface border border-gray-800 rounded-xl transition"
                      title="Edit Ruling / Fix Past Record Error"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Past Record Error Alert & 1-Click Fix Button */}
                {isPastError && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs flex items-center justify-between gap-3 animate-fade-in">
                    <div className="flex items-center gap-2 text-amber-300">
                      <Wrench className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        This dispute record has missing resolution metadata from a previous version.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleQuickFixRecord(dispute)}
                      className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-[10px] tracking-wider rounded-lg transition shrink-0 flex items-center gap-1"
                    >
                      {quickFixSuccessId === dispute.id ? (
                        <span className="flex items-center gap-1 text-black font-bold">
                          <Check className="w-3 h-3" /> Fixed!
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> 1-Click Fix
                        </span>
                      )}
                    </button>
                  </div>
                )}

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

                {/* Ruling Details & Action Buttons */}
                {isPending ? (
                  <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-gray-800">
                    <div className="text-xs text-gray-400 font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <span>Take official resolution action:</span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Mark as Solved Button (Direct 1-click solve) */}
                      <button
                        type="button"
                        onClick={() => onResolveDispute(dispute.id, 'solve', 'Dispute investigated, solved, and settled by tournament organizer.')}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-md shadow-emerald-950/30 flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Mark as Solved
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenInvestigate(dispute)}
                        className="px-3.5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition shadow-md shadow-brand-950/30 flex items-center gap-1.5"
                      >
                        <Shield className="w-3.5 h-3.5" /> Investigate &amp; Note
                      </button>

                      <button
                        type="button"
                        onClick={() => onResolveDispute(dispute.id, 'dismiss')}
                        className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider transition"
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
                          Action applied: <strong className="text-white uppercase">{dispute.resolutionAction === 'solve' ? 'SOLVED & SETTLED' : (dispute.resolutionAction || dispute.status)}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {dispute.resolvedAt && (
                          <span className="text-[11px] text-gray-500 font-mono">
                            Resolved on {formatDate(dispute.resolvedAt)}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleReopenDispute(dispute)}
                          className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-300 hover:text-white bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 rounded-lg transition flex items-center gap-1"
                          title="Reopen dispute to pending review"
                        >
                          <RotateCcw className="w-3 h-3" /> Re-Open
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(dispute)}
                          className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-300 hover:text-white bg-surface hover:bg-surface border border-gray-700 rounded-lg transition flex items-center gap-1"
                          title="Edit Ruling or Fix Errors"
                        >
                          <Edit3 className="w-3 h-3" /> Edit Ruling
                        </button>
                      </div>
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

      {/* 4. Full Dispute Editor & Past Error Fixer Modal */}
      {editingDispute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-gray-800 rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-5 shadow-2xl relative max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-brand-500/10 border border-brand-500/20 rounded-xl text-brand-400">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-tight">
                    Edit Dispute &amp; Correct Ruling
                  </h3>
                  <p className="text-xs text-gray-400 truncate max-w-xs">
                    {editingDispute.tournamentName || 'Match Event'} • Case #{editingDispute.id.slice(0, 8)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingDispute(null)}
                className="text-gray-500 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Status Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-300">
                  Case Status
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'pending', label: '🚨 Pending Review' },
                    { id: 'resolved', label: '✅ Resolved' },
                    { id: 'dismissed', label: '📁 Dismissed' },
                  ].map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setEditStatus(s.id as any)}
                      className={`p-2.5 rounded-xl border text-xs font-bold uppercase tracking-wider text-center transition ${
                        editStatus === s.id
                          ? 'bg-brand-600 border-brand-500 text-white shadow-md'
                          : 'bg-dark border-gray-800 text-gray-400 hover:text-white'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Decision Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-300">
                  Disciplinary / Resolution Action
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { id: 'solve', label: '✅ Solved' },
                    { id: 'warn', label: '⚠️ Warning' },
                    { id: 'ban', label: '🚫 Disqualify' },
                    { id: 'dismiss', label: '📁 Dismiss' },
                    { id: 'none', label: 'Under Review' },
                  ].map(a => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setEditAction(a.id as any)}
                      className={`p-2.5 rounded-xl border text-xs font-bold uppercase tracking-wider text-center transition ${
                        editAction === a.id
                          ? a.id === 'solve'
                            ? 'bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-950/40'
                            : a.id === 'ban'
                            ? 'bg-red-600 border-red-500 text-white shadow-md shadow-red-950/40'
                            : a.id === 'warn'
                            ? 'bg-amber-600 border-amber-500 text-white shadow-md shadow-amber-950/40'
                            : 'bg-gray-800 border-gray-600 text-white'
                          : 'bg-dark border-gray-800 text-gray-400 hover:text-white'
                      }`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resolution Ruling Note */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-300">
                    Organizer Ruling Explanation / Message
                  </label>
                  <span className="text-[10px] text-gray-500">Visible to participants</span>
                </div>
                <textarea
                  value={editNote}
                  onChange={e => setEditNote(e.target.value)}
                  rows={3}
                  placeholder="Explain the revised ruling or clarify the correction..."
                  className="w-full bg-dark border border-gray-800 rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:border-brand-500 focus-visible:outline-none transition leading-relaxed"
                />

                {/* Preset Quick Notes */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Quick Presets:</span>
                  <div className="flex flex-wrap gap-1">
                    {PRESET_NOTES.map(preset => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setEditNote(preset.text)}
                        className="px-2 py-0.5 bg-surface hover:bg-surface text-[10px] text-gray-400 hover:text-white rounded-md border border-gray-800 transition"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Case Details Correction Fields */}
              <div className="space-y-2 pt-2 border-t border-gray-800/80">
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">
                  Correct Case Details (Optional)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Match Room # */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 mb-1">Room #</label>
                    <input
                      type="text"
                      value={editMatchRoom}
                      onChange={e => setEditMatchRoom(e.target.value)}
                      placeholder="e.g. 1"
                      className="w-full bg-dark border border-gray-800 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-gray-500 focus:border-brand-500"
                    />
                  </div>

                  {/* Accused Party */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 mb-1">Accused Team / Player</label>
                    <input
                      type="text"
                      value={editAccused}
                      onChange={e => setEditAccused(e.target.value)}
                      placeholder="e.g. Team Alpha"
                      className="w-full bg-dark border border-gray-800 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-brand-500"
                    />
                  </div>
                </div>

                {/* Reason / Statement */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 mb-1">Dispute Statement / Details</label>
                  <textarea
                    value={editReason}
                    onChange={e => setEditReason(e.target.value)}
                    rows={2}
                    className="w-full bg-dark border border-gray-800 rounded-xl p-2.5 text-xs text-white placeholder-gray-500 focus:border-brand-500"
                  />
                </div>
              </div>

              {/* Notify Players Checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="notifyPlayersCheckbox"
                  checked={editNotifyPlayers}
                  onChange={e => setEditNotifyPlayers(e.target.checked)}
                  className="rounded border-gray-700 bg-dark text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="notifyPlayersCheckbox" className="text-xs text-gray-300 font-semibold cursor-pointer">
                  Send updated ruling notification to reporter and accused party
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 pt-3 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
                  className="px-3 py-2 text-xs font-bold text-red-400 hover:text-red-300 rounded-xl border border-red-500/20 hover:bg-red-500/10 transition flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>

                <div className="flex-1 flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setEditingDispute(null)}
                    className="px-4 py-2.5 bg-surface hover:bg-surface text-gray-300 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider border border-gray-700 transition"
                    disabled={isSavingEdit}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className="px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-2 shadow-lg shadow-brand-950/40"
                  >
                    {isSavingEdit ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    <span>Save Ruling Changes</span>
                  </button>
                </div>
              </div>

              {/* Delete Confirmation Warning */}
              {showDeleteConfirm && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-xs space-y-3 animate-fade-in">
                  <div className="flex items-center gap-2 text-red-300 font-bold">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>Are you sure you want to permanently delete this dispute?</span>
                  </div>
                  <p className="text-gray-400 text-[11px]">
                    This will remove the case record from the platform. This action cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleDeleteConfirm}
                      disabled={isSavingEdit}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition"
                    >
                      Yes, Delete Record
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-3 py-1.5 bg-surface text-gray-300 text-xs font-semibold rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* 5. Investigation Modal (For Fresh Pending Reports) */}
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setResolutionAction('solve');
                      if (!resolutionNote || resolutionNote.startsWith('Action:') || resolutionNote === 'Dispute dismissed after review.') {
                        setResolutionNote('Issue investigated, solved, and settled by tournament organizer.');
                      }
                    }}
                    className={`p-3 rounded-xl border text-xs font-black uppercase tracking-wider text-center transition flex items-center justify-center gap-1.5 ${
                      resolutionAction === 'solve'
                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-950/40'
                        : 'bg-card border-gray-800 text-gray-400 hover:text-emerald-400'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Solve Issue
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setResolutionAction('warn');
                      if (!resolutionNote || resolutionNote === 'Issue investigated, solved, and settled by tournament organizer.') {
                        setResolutionNote('Official warning issued for violating tournament match conduct regulations.');
                      }
                    }}
                    className={`p-3 rounded-xl border text-xs font-bold uppercase tracking-wider text-center transition ${
                      resolutionAction === 'warn'
                        ? 'bg-amber-600/30 border-amber-500 text-amber-300 shadow-md'
                        : 'bg-card border-gray-800 text-gray-400 hover:text-amber-300'
                    }`}
                  >
                    ⚠️ Warning
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setResolutionAction('ban');
                      if (!resolutionNote || resolutionNote === 'Issue investigated, solved, and settled by tournament organizer.') {
                        setResolutionNote('Accused team disqualified from tournament due to severe infractions.');
                      }
                    }}
                    className={`p-3 rounded-xl border text-xs font-black uppercase tracking-wider text-center transition ${
                      resolutionAction === 'ban'
                        ? 'bg-red-600 border-red-500 text-white shadow-md shadow-red-950/40'
                        : 'bg-card border-gray-800 text-gray-400 hover:text-red-400'
                    }`}
                  >
                    🚫 Disqualify
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setResolutionAction('dismiss');
                      if (!resolutionNote || resolutionNote === 'Issue investigated, solved, and settled by tournament organizer.') {
                        setResolutionNote('Dispute dismissed due to insufficient evidence.');
                      }
                    }}
                    className={`p-3 rounded-xl border text-xs font-bold uppercase tracking-wider text-center transition ${
                      resolutionAction === 'dismiss'
                        ? 'bg-gray-800 border-gray-600 text-white shadow-md'
                        : 'bg-card border-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    📁 Dismiss
                  </button>
                </div>
              </div>

              {/* Resolution Explanation / Note */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-300">
                    Organizer Explanation &amp; Message to Players
                  </label>
                  <span className="text-[10px] text-gray-500">Sent directly to players</span>
                </div>
                <textarea
                  value={resolutionNote}
                  onChange={e => setResolutionNote(e.target.value)}
                  rows={3}
                  placeholder="Explain your ruling. This will be visible on the dispute and dispatched via in-app notification to the reporter and accused players."
                  className="w-full bg-dark border border-gray-800 rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:border-red-500 focus-visible:outline-none transition leading-relaxed"
                />

                {/* Preset Quick Notes */}
                <div className="flex flex-wrap gap-1 pt-1">
                  {PRESET_NOTES.map(preset => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setResolutionNote(preset.text)}
                      className="px-2 py-0.5 bg-surface hover:bg-surface text-[10px] text-gray-400 hover:text-white rounded-md border border-gray-800 transition"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
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
                    resolutionAction === 'solve'
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40'
                      : resolutionAction === 'ban'
                      ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-950/40'
                      : resolutionAction === 'warn'
                      ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-950/40'
                      : 'bg-surface hover:bg-surface text-white border border-gray-600'
                  }`}
                >
                  {isSubmittingResolution ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>
                    {isSubmittingResolution
                      ? 'Saving...'
                      : resolutionAction === 'solve'
                      ? 'Mark as Solved'
                      : resolutionAction === 'dismiss'
                      ? 'Dismiss Report'
                      : 'Apply Ruling'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Fullscreen Evidence Lightbox */}
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
