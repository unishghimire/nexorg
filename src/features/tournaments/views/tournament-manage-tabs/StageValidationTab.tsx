import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Lock,
  Unlock,
  ArrowRight,
  Search,
  Filter,
  ShieldCheck,
  Trophy,
  Users,
  RefreshCw,
  Edit3,
  AlertCircle,
  Eye,
  Check,
  Layers,
  ChevronRight,
  Flame,
  FileCheck,
  HelpCircle,
} from 'lucide-react';
import { TournamentAdminTabProps } from './types';
import Modal from '../../../../shared/components/Modal';
import { useAuth } from '../../../../shared/context/AuthContext';
import {
  validateTournamentStage,
  updateStageTeamResultServer,
  processTournamentStageServer,
  requestStageCorrection,
  StageValidationReport,
  GroupValidationSummary,
  StageResultItem,
  MissingResultDetail,
  resolveTournamentScoringConfig,
} from '../../../../shared/services/tournamentStageValidationService';
import { calculateTeamScore } from '../../../../shared/services/scoringEngine';
import { getResultDeadlineRemaining, DeadlineRemaining } from '../../../../shared/services/eventSettlementService';
import { TeamMatchResult, TournamentGroup, Match } from '../../../../shared/types/types';

export const StageValidationTab: React.FC<TournamentAdminTabProps> = (props) => {
  const { tournament, setTournament, showToast, setActiveTab } = props;
  const { user, profile } = useAuth();

  // ─── STATE ──────────────────────────────────────────────────────────────────
  const currentRound = tournament?.currentRound || 1;
  const [selectedRound, setSelectedRound] = useState<number>(currentRound);
  const [filter, setFilter] = useState<'all' | 'complete' | 'incomplete' | 'missing' | 'invalid'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isQualPreviewModalOpen, setIsQualPreviewModalOpen] = useState(false);
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [correctionReason, setCorrectionReason] = useState('');

  // Result update modal state
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [activeEditItem, setActiveEditItem] = useState<{
    groupId: string;
    groupName: string;
    matchId: string;
    matchNumber: number;
    teamId: string;
    teamName: string;
    placement: string | number;
    kills: string | number;
  } | null>(null);

  const [savingResult, setSavingResult] = useState(false);
  const [processingStage, setProcessingStage] = useState(false);
  const [requestingCorrection, setRequestingCorrection] = useState(false);

  // Sync selectedRound if tournament changes
  useEffect(() => {
    if (tournament?.currentRound && tournament.currentRound !== selectedRound && !tournament.roadmap?.find(r => r.roundNumber === selectedRound)) {
      setSelectedRound(tournament.currentRound);
    }
  }, [tournament?.currentRound]);

  // ─── 48-HOUR DEADLINE TICKER ───────────────────────────────────────────────
  const [deadlineRemaining, setDeadlineRemaining] = useState<DeadlineRemaining>(() =>
    getResultDeadlineRemaining(tournament)
  );

  useEffect(() => {
    if (tournament?.status !== 'completed' || tournament?.resultStatus === 'published') return;
    const interval = setInterval(() => {
      setDeadlineRemaining(getResultDeadlineRemaining(tournament));
    }, 1000);
    return () => clearInterval(interval);
  }, [tournament?.status, tournament?.completedAt, tournament?.resultDeadlineAt, tournament?.resultStatus]);

  // ─── AUTHORITATIVE VALIDATION REPORT ──────────────────────────────────────
  const report: StageValidationReport = useMemo(() => {
    if (!tournament) {
      return {
        roundNumber: selectedRound,
        stageName: `Round ${selectedRound}`,
        stageStatus: 'RESULTS_INCOMPLETE',
        totalGroups: 0,
        completedGroups: 0,
        pendingGroups: 0,
        totalMatches: 0,
        completedMatches: 0,
        pendingMatches: 0,
        totalResultsRequired: 0,
        completedResults: 0,
        missingResultsCount: 0,
        invalidResultsCount: 0,
        isValid: false,
        canProcess: false,
        statusMessage: 'No tournament loaded',
        groups: [],
        missingList: [],
        invalidList: [],
        tiesRequiringReview: [],
        scoringConfig: { killPoints: 1, placementPoints: {}, source: 'Default' },
      };
    }
    return validateTournamentStage(tournament, selectedRound);
  }, [tournament, selectedRound]);

  // Available rounds in tournament
  const availableRounds = useMemo(() => {
    if (Array.isArray(tournament?.roadmap) && tournament.roadmap.length > 0) {
      return tournament.roadmap.map((r) => ({
        roundNumber: r.roundNumber,
        stageName: r.stageName || `Round ${r.roundNumber}`,
      }));
    }
    const maxRound = Math.max(1, tournament?.currentRound || 1);
    return Array.from({ length: maxRound }, (_, i) => ({
      roundNumber: i + 1,
      stageName: `Round ${i + 1}`,
    }));
  }, [tournament?.roadmap, tournament?.currentRound]);

  // ─── FILTERED GROUPS & RESULTS ─────────────────────────────────────────────
  const filteredGroups = useMemo(() => {
    return report.groups
      .map((g) => {
        let items = g.items;

        // Text search
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          items = items.filter(
            (it) =>
              it.teamName.toLowerCase().includes(q) ||
              `match ${it.matchNumber}`.toLowerCase().includes(q)
          );
        }

        // Status filter
        if (filter === 'complete') {
          items = items.filter((it) => it.status === 'complete');
        } else if (filter === 'incomplete' || filter === 'missing') {
          items = items.filter((it) => it.status === 'missing' || it.status === 'invalid');
        } else if (filter === 'invalid') {
          items = items.filter((it) => it.status === 'invalid');
        }

        return { ...g, filteredItems: items };
      })
      .filter((g) => {
        if (filter === 'complete') return g.isComplete;
        if (filter === 'incomplete' || filter === 'missing') return !g.isComplete;
        if (filter === 'invalid') return g.invalidResults > 0 || g.duplicatePlacements.length > 0;
        return true;
      });
  }, [report.groups, filter, searchQuery]);

  // ─── LIVE SCORE CALCULATION PREVIEW IN MODAL ──────────────────────────────
  const editScorePreview = useMemo(() => {
    if (!activeEditItem || !tournament) return null;
    const pos = Math.floor(Number(activeEditItem.placement));
    const k = Math.floor(Number(activeEditItem.kills));
    if (isNaN(pos) || pos < 1 || isNaN(k) || k < 0) return null;

    const scoring = resolveTournamentScoringConfig(tournament);
    return calculateTeamScore({
      position: pos,
      kills: k,
      scoring,
    });
  }, [activeEditItem, tournament]);

  // ─── HANDLER: SAVE TEAM RESULT ────────────────────────────────────────────
  const handleSaveResult = async () => {
    if (!activeEditItem || !tournament) return;
    const pos = Math.floor(Number(activeEditItem.placement));
    const k = Math.floor(Number(activeEditItem.kills));

    if (isNaN(pos) || pos < 1) {
      showToast('Placement must be a positive number (1 or higher).', 'error');
      return;
    }
    if (isNaN(k) || k < 0) {
      showToast('Kills must be 0 or higher.', 'error');
      return;
    }

    try {
      setSavingResult(true);
      const res = await updateStageTeamResultServer({
        tournamentId: tournament.id,
        roundNumber: selectedRound,
        groupId: activeEditItem.groupId,
        matchId: activeEditItem.matchId,
        teamId: activeEditItem.teamId,
        placement: pos,
        kills: k,
        actorUid: user?.uid || 'organizer',
        actorName: profile?.username || user?.displayName || 'Organizer',
      });

      showToast(res.message, 'success');
      setIsUpdateModalOpen(false);
      setActiveEditItem(null);
    } catch (err: any) {
      console.error('[StageValidation] Save result error:', err);
      showToast(err.message || 'Failed to save result', 'error');
    } finally {
      setSavingResult(false);
    }
  };

  // ─── HANDLER: PROCESS STAGE ────────────────────────────────────────────────
  const handleConfirmProcessStage = async () => {
    if (!tournament) return;

    try {
      setProcessingStage(true);
      const result = await processTournamentStageServer({
        tournamentId: tournament.id,
        roundNumber: selectedRound,
        actorUid: user?.uid || 'organizer',
        actorName: profile?.username || user?.displayName || 'Organizer',
      });

      showToast(result.message, 'success');
      setIsQualPreviewModalOpen(false);

      if (result.nextRoundNumber) {
        setSelectedRound(result.nextRoundNumber);
      }
    } catch (err: any) {
      console.error('[StageValidation] Stage process error:', err);
      showToast(err.message || 'Failed to process stage.', 'error');
    } finally {
      setProcessingStage(false);
    }
  };

  // ─── HANDLER: REQUEST CORRECTION ───────────────────────────────────────────
  const handleSubmitCorrection = async () => {
    if (!tournament || !correctionReason.trim()) {
      showToast('Please enter a reason for the correction request.', 'warning');
      return;
    }

    try {
      setRequestingCorrection(true);
      const res = await requestStageCorrection({
        tournamentId: tournament.id,
        roundNumber: selectedRound,
        reason: correctionReason.trim(),
        actorUid: user?.uid || 'organizer',
        actorName: profile?.username || user?.displayName || 'Organizer',
      });

      showToast(res.message, 'info');
      setIsCorrectionModalOpen(false);
      setCorrectionReason('');
    } catch (err: any) {
      showToast(err.message || 'Failed to submit correction request', 'error');
    } finally {
      setRequestingCorrection(false);
    }
  };

  // ─── RENDER STATUS BADGE ───────────────────────────────────────────────────
  const renderStatusBadge = () => {
    switch (report.stageStatus) {
      case 'PROCESSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/30">
            <Lock className="w-3.5 h-3.5" /> Stage Processed & Locked
          </span>
        );
      case 'RESULTS_REVALIDATION_REQUIRED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5" /> ⚠ Stage Result Changed — Revalidation Required
          </span>
        );
      case 'VALIDATED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" /> All Results Validated ✅
          </span>
        );
      case 'RESULTS_INCOMPLETE':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/30">
            <AlertCircle className="w-3.5 h-3.5" /> ⚠ Results Incomplete ({report.missingResultsCount + report.invalidResultsCount} pending)
          </span>
        );
    }
  };

  return (
    <motion.div
      key="stage-validation"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      {/* ─── 1. TOP STAGE SWITCHER & DEADLINE ROW ─── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-500/10 border border-brand-500/30 text-brand-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black uppercase tracking-wider text-white">
                Tournament Stage Validation & Results
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Stage {selectedRound} — {report.stageName} • Deep Verification Engine
              </p>
            </div>
          </div>
        </div>

        {/* 48-Hour Deadline Indicator (if tournament is completed) */}
        {tournament.status === 'completed' && (
          <div className="flex items-center gap-3 bg-dark/80 border border-gray-800 rounded-xl px-4 py-2">
            <Clock className={`w-4 h-4 ${deadlineRemaining.isExpired ? 'text-red-500' : deadlineRemaining.isWarning ? 'text-amber-400' : 'text-emerald-400'}`} />
            <div>
              <div className="text-[10px] uppercase font-black tracking-widest text-gray-400">Result Deadline</div>
              <div className={`text-xs font-mono font-bold ${deadlineRemaining.statusColor}`}>
                {tournament.resultStatus === 'published' ? '✅ Published' : deadlineRemaining.formatted}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Round Selection Tabs */}
      <div className="flex overflow-x-auto gap-2 pb-1 custom-scrollbar">
        {availableRounds.map((rnd) => {
          const isSelected = rnd.roundNumber === selectedRound;
          const isPast = (tournament.currentRound || 1) > rnd.roundNumber;
          const isCurrent = (tournament.currentRound || 1) === rnd.roundNumber;

          return (
            <button
              type="button"
              key={rnd.roundNumber}
              onClick={() => setSelectedRound(rnd.roundNumber)}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${
                isSelected
                  ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20'
                  : 'bg-card border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
              }`}
            >
              <span>{rnd.stageName}</span>
              {isPast && <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">Processed</span>}
              {isCurrent && !isPast && <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">Active</span>}
            </button>
          );
        })}
      </div>

      {/* ─── 2. STAGE SUMMARY BANNER & METRICS ─── */}
      <div className="bg-card/70 border border-gray-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800/80 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-tight">
                {report.stageName}
              </h3>
              {renderStatusBadge()}
            </div>
            <p className="text-xs text-gray-400">{report.statusMessage}</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsReportModalOpen(true)}
              className="px-4 py-2 bg-dark border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-colors"
            >
              <FileCheck className="w-3.5 h-3.5 text-brand-400" />
              <span>Validation Report</span>
            </button>

            {report.stageStatus === 'PROCESSED' && (
              <button
                type="button"
                onClick={() => setIsCorrectionModalOpen(true)}
                className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Request Correction</span>
              </button>
            )}
          </div>
        </div>

        {/* 4 Summary Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-5">
          <div className="bg-dark/50 border border-gray-800/80 rounded-xl p-3 sm:p-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">
              Groups Complete
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-black font-mono text-white">
                {report.completedGroups} / {report.totalGroups}
              </span>
              <span className={`text-xs ${report.completedGroups === report.totalGroups && report.totalGroups > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {report.completedGroups === report.totalGroups && report.totalGroups > 0 ? '✅ 100%' : '⚠ Pending'}
              </span>
            </div>
          </div>

          <div className="bg-dark/50 border border-gray-800/80 rounded-xl p-3 sm:p-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">
              Matches Finished
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-black font-mono text-white">
                {report.completedMatches} / {report.totalMatches}
              </span>
              <span className={`text-xs ${report.completedMatches === report.totalMatches && report.totalMatches > 0 ? 'text-emerald-400' : 'text-gray-400'}`}>
                {report.completedMatches === report.totalMatches && report.totalMatches > 0 ? '✅' : 'in progress'}
              </span>
            </div>
          </div>

          <div className="bg-dark/50 border border-gray-800/80 rounded-xl p-3 sm:p-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">
              Required Results
            </span>
            <div className="flex items-baseline gap-2">
              <span className={`text-xl sm:text-2xl font-black font-mono ${report.completedResults === report.totalResultsRequired && report.totalResultsRequired > 0 ? 'text-emerald-400' : 'text-white'}`}>
                {report.completedResults} / {report.totalResultsRequired}
              </span>
              <span className={`text-xs font-black ${report.missingResultsCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {report.missingResultsCount > 0 ? `-${report.missingResultsCount} missing` : 'Complete'}
              </span>
            </div>
          </div>

          <div className="bg-dark/50 border border-gray-800/80 rounded-xl p-3 sm:p-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">
              Scoring System
            </span>
            <div className="text-xs font-black text-brand-400 truncate">
              {report.scoringConfig.source}
            </div>
            <div className="text-[10px] text-gray-400 mt-1">
              {report.scoringConfig.killPoints} pt/kill • Pos #1: {report.scoringConfig.placementPoints['1'] ?? 12} pts
            </div>
          </div>
        </div>

        {/* ─── PROCESS STAGE CALL TO ACTION BAR ─── */}
        <div className="mt-6 pt-5 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4 bg-dark/40 -mx-5 -mb-5 sm:-mx-6 sm:-mb-6 p-4 sm:p-5">
          <div className="text-xs">
            {report.stageStatus === 'PROCESSED' ? (
              <span className="text-blue-400 font-bold flex items-center gap-1.5">
                <Lock className="w-4 h-4" /> This stage has been processed. Results and qualification are finalized.
              </span>
            ) : report.canProcess ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> All required results are complete and validated. Ready to calculate standings and advance stage.
              </span>
            ) : (
              <span className="text-amber-400 font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" /> Complete all group, team, and match results before processing this stage.
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* View Missing Results Quick Jump */}
            {report.missingResultsCount > 0 && (
              <button
                type="button"
                onClick={() => setFilter(filter === 'missing' ? 'all' : 'missing')}
                className={`px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 border transition-all ${
                  filter === 'missing'
                    ? 'bg-red-500/20 text-red-300 border-red-500/50'
                    : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>View {report.missingResultsCount} Missing Results</span>
              </button>
            )}

            {/* PROCESS STAGE BUTTON */}
            {report.stageStatus === 'PROCESSED' ? (
              <button
                type="button"
                disabled
                className="w-full sm:w-auto px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" /> Stage Processed
              </button>
            ) : (
              <button
                type="button"
                disabled={!report.canProcess || processingStage}
                onClick={() => setIsQualPreviewModalOpen(true)}
                className={`w-full sm:w-auto px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                  report.canProcess
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-lg shadow-emerald-600/30 cursor-pointer active:scale-95'
                    : 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed opacity-60'
                }`}
                title={report.canProcess ? 'Process validated stage' : 'All results must be completed first'}
              >
                {processingStage ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Processing Stage...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Process Stage
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── 3. FILTERS & SEARCH BAR ─── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card/40 border border-gray-800 rounded-xl p-3">
        {/* Filter chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar">
          {(
            [
              { id: 'all', label: 'All Groups' },
              { id: 'complete', label: 'Complete' },
              { id: 'incomplete', label: 'Incomplete' },
              { id: 'missing', label: 'Missing Results' },
              { id: 'invalid', label: 'Invalid Results' },
            ] as const
          ).map((chip) => (
            <button
              type="button"
              key={chip.id}
              onClick={() => setFilter(chip.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-colors whitespace-nowrap ${
                filter === chip.id
                  ? 'bg-brand-500 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-[200px] sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search team or match..."
            className="w-full bg-dark border border-gray-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
          />
        </div>
      </div>

      {/* ─── 4. GROUPS LISTING & TEAM RESULTS TABLE ─── */}
      {filteredGroups.length === 0 ? (
        <div className="text-center py-12 bg-card/20 rounded-2xl border border-gray-800">
          <Users className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-400">No results found matching your criteria</p>
          <button
            type="button"
            onClick={() => {
              setFilter('all');
              setSearchQuery('');
            }}
            className="mt-3 text-xs text-brand-400 font-bold hover:underline"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredGroups.map((group) => {
            const hasDuplicates = group.duplicatePlacements.length > 0;
            const isGroupLocked = report.stageStatus === 'PROCESSED';

            return (
              <div
                key={group.groupId}
                className="bg-card/40 border border-gray-800 rounded-2xl p-4 sm:p-6 shadow-md"
              >
                {/* Group Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800/80 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-dark border border-gray-700 flex items-center justify-center font-black text-brand-400 text-sm">
                      {group.groupName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                        {group.groupName}
                        {group.isComplete ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-mono font-bold">
                            <CheckCircle2 className="w-3 h-3" /> Complete
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1 font-mono font-bold">
                            <AlertTriangle className="w-3 h-3" /> Incomplete
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {group.teams.length} Teams • {group.matches.length} Matches • {group.completedResults} / {group.requiredResults} Results Submitted
                      </p>
                    </div>
                  </div>

                  {/* Group progress counter badge */}
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs font-mono font-black text-white">
                        {group.completedResults} / {group.requiredResults}
                      </div>
                      <div className="text-[10px] text-gray-500">Results verified</div>
                    </div>
                    <div className="w-20 bg-dark rounded-full h-2 border border-gray-800 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          group.isComplete ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                        style={{
                          width: `${group.requiredResults > 0 ? (group.completedResults / group.requiredResults) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Duplicate Placements Alert */}
                {hasDuplicates && (
                  <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                    <div>
                      <strong className="font-bold">Duplicate Placement Conflict:</strong> In Match{' '}
                      {group.duplicatePlacements.map((d) => `#${d.matchNumber} (Rank #${d.placement} shared by: ${d.teams.join(', ')})`).join(', ')}.
                      Every team in a match must have a unique finishing placement rank.
                    </div>
                  </div>
                )}

                {/* Team Results Table */}
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-800 text-[10px] font-black uppercase tracking-wider text-gray-500">
                        <th className="py-2.5 px-3">Team / Player</th>
                        <th className="py-2.5 px-3">Match</th>
                        <th className="py-2.5 px-3">Placement</th>
                        <th className="py-2.5 px-3">Kills</th>
                        <th className="py-2.5 px-3">Points</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60">
                      {(group as any).filteredItems?.map((item: StageResultItem, idx: number) => {
                        const isMissing = item.status === 'missing';
                        const isInvalid = item.status === 'invalid';
                        const isComplete = item.status === 'complete';

                        return (
                          <tr
                            key={`${item.teamId}_${item.matchId}_${idx}`}
                            className={`hover:bg-dark/40 transition-colors ${
                              isMissing ? 'bg-red-500/5' : isInvalid ? 'bg-amber-500/5' : ''
                            }`}
                          >
                            {/* Team */}
                            <td className="py-3 px-3">
                              <div className="font-bold text-white truncate max-w-[180px]">
                                {item.teamName}
                              </div>
                              <div className="text-[10px] text-gray-500 font-mono">
                                ID: {item.teamId.slice(0, 8)}
                              </div>
                            </td>

                            {/* Match */}
                            <td className="py-3 px-3 font-mono font-bold text-gray-300">
                              Match #{item.matchNumber}
                            </td>

                            {/* Placement */}
                            <td className="py-3 px-3">
                              {item.placement ? (
                                <span className={`font-mono font-black ${item.placement === 1 ? 'text-amber-400' : 'text-gray-300'}`}>
                                  #{item.placement}
                                </span>
                              ) : (
                                <span className="text-gray-600 font-mono">—</span>
                              )}
                            </td>

                            {/* Kills */}
                            <td className="py-3 px-3">
                              {typeof item.kills === 'number' ? (
                                <span className="font-mono font-bold text-gray-300">
                                  {item.kills}
                                </span>
                              ) : (
                                <span className="text-gray-600 font-mono">—</span>
                              )}
                            </td>

                            {/* Points */}
                            <td className="py-3 px-3">
                              {typeof item.totalPoints === 'number' ? (
                                <div className="font-mono font-black text-brand-400">
                                  {item.totalPoints} pts
                                  <div className="text-[9px] text-gray-500 font-normal">
                                    ({item.placementPoints || 0} pos + {item.killPoints || 0} kill)
                                  </div>
                                </div>
                              ) : (
                                <span className="text-gray-600 font-mono">—</span>
                              )}
                            </td>

                            {/* Status */}
                            <td className="py-3 px-3">
                              {isComplete && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                  <CheckCircle2 className="w-3 h-3" /> Complete
                                </span>
                              )}
                              {isMissing && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                                  <XCircle className="w-3 h-3" /> Missing Result
                                </span>
                              )}
                              {isInvalid && (
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20"
                                  title={item.error}
                                >
                                  <AlertTriangle className="w-3 h-3" /> {item.error || 'Invalid'}
                                </span>
                              )}
                            </td>

                            {/* Action */}
                            <td className="py-3 px-3 text-right">
                              {isGroupLocked ? (
                                <span className="text-gray-600 text-[10px] flex items-center justify-end gap-1 font-mono">
                                  <Lock className="w-3 h-3" /> Locked
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveEditItem({
                                      groupId: item.groupId,
                                      groupName: item.groupName,
                                      matchId: item.matchId,
                                      matchNumber: item.matchNumber,
                                      teamId: item.teamId,
                                      teamName: item.teamName,
                                      placement: item.placement ?? '',
                                      kills: item.kills ?? '',
                                    });
                                    setIsUpdateModalOpen(true);
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-colors inline-flex items-center gap-1.5 ${
                                    isMissing || isInvalid
                                      ? 'bg-brand-500 hover:bg-brand-400 text-white shadow-md shadow-brand-500/20'
                                      : 'bg-dark border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white'
                                  }`}
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>{isMissing ? 'Update Result' : 'Edit'}</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── MODAL 1: RESULT UPDATE MODAL ─── */}
      <Modal
        isOpen={isUpdateModalOpen}
        onClose={() => {
          setIsUpdateModalOpen(false);
          setActiveEditItem(null);
        }}
        title={`Update Result: ${activeEditItem?.teamName}`}
      >
        {activeEditItem && (
          <div className="space-y-4">
            <div className="bg-dark/60 rounded-xl p-3 border border-gray-800 text-xs space-y-1">
              <div className="text-gray-400">
                Group:{' '}
                <strong className="text-white font-bold">{activeEditItem.groupName}</strong> • Match #{activeEditItem.matchNumber}
              </div>
              <div className="text-gray-400">
                Team: <strong className="text-brand-400 font-bold">{activeEditItem.teamName}</strong>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">
                  Finishing Placement (Rank)
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={activeEditItem.placement}
                  onChange={(e) =>
                    setActiveEditItem({ ...activeEditItem, placement: e.target.value })
                  }
                  placeholder="e.g. 1"
                  className="w-full bg-dark border border-gray-800 rounded-xl px-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-brand-500 font-mono"
                />
                <span className="text-[10px] text-gray-500 mt-1 block">
                  #1 = Winner / Booyah!
                </span>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">
                  Total Kills
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={activeEditItem.kills}
                  onChange={(e) =>
                    setActiveEditItem({ ...activeEditItem, kills: e.target.value })
                  }
                  placeholder="e.g. 8"
                  className="w-full bg-dark border border-gray-800 rounded-xl px-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-brand-500 font-mono"
                />
                <span className="text-[10px] text-gray-500 mt-1 block">
                  Verified frags/kills
                </span>
              </div>
            </div>

            {/* Authoritative Calculated Score Preview */}
            <div className="bg-dark/80 border border-brand-500/20 rounded-xl p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-brand-400 mb-2">
                Automatic Scoring Breakdown (Calculated by Engine)
              </div>
              {editScorePreview ? (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-card/40 rounded-lg p-2 border border-gray-800">
                    <span className="text-[10px] text-gray-400 block">Placement Pts</span>
                    <span className="text-sm font-black font-mono text-white">
                      +{editScorePreview.placementPoints}
                    </span>
                  </div>
                  <div className="bg-card/40 rounded-lg p-2 border border-gray-800">
                    <span className="text-[10px] text-gray-400 block">Kill Pts</span>
                    <span className="text-sm font-black font-mono text-white">
                      +{editScorePreview.killPoints}
                    </span>
                  </div>
                  <div className="bg-brand-500/10 rounded-lg p-2 border border-brand-500/30">
                    <span className="text-[10px] text-brand-400 block">Total Points</span>
                    <span className="text-sm font-black font-mono text-brand-400">
                      {editScorePreview.totalPoints} pts
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-500 italic">
                  Enter valid placement and kills above to preview calculated points.
                </p>
              )}
              <p className="text-[10px] text-gray-500 mt-2">
                🔒 Organizers cannot manually override calculated totals. All scoring formulas are authoritatively computed server-side.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-800">
              <button
                type="button"
                onClick={() => {
                  setIsUpdateModalOpen(false);
                  setActiveEditItem(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingResult || !editScorePreview}
                onClick={handleSaveResult}
                className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-brand-500 hover:bg-brand-400 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-brand-500/20"
              >
                {savingResult ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" /> Save Result
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── MODAL 2: DEEP VALIDATION REPORT MODAL ─── */}
      <Modal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        title="Stage Result Validation Audit Report"
        maxWidth="sm:max-w-2xl"
      >
        <div className="space-y-4">
          <div className="bg-dark/60 rounded-xl p-4 border border-gray-800">
            <h4 className="text-xs font-black text-white uppercase tracking-wider mb-2">
              RESULT VALIDATION BREAKDOWN
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-2.5 rounded-lg bg-card/60 border border-gray-800">
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Groups</span>
                <span className="text-base font-black font-mono text-white">
                  {report.completedGroups}/{report.totalGroups} {report.completedGroups === report.totalGroups ? '✅' : '❌'}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-card/60 border border-gray-800">
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Matches</span>
                <span className="text-base font-black font-mono text-white">
                  {report.completedMatches}/{report.totalMatches} {report.completedMatches === report.totalMatches ? '✅' : '❌'}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-card/60 border border-gray-800">
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Results</span>
                <span className="text-base font-black font-mono text-white">
                  {report.completedResults}/{report.totalResultsRequired} {report.missingResultsCount === 0 && report.invalidResultsCount === 0 ? '✅' : '❌'}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-card/60 border border-gray-800">
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Status</span>
                <span className={`text-xs font-black font-mono ${report.canProcess ? 'text-emerald-400' : 'text-red-400'}`}>
                  {report.canProcess ? 'READY ✅' : 'BLOCKED ❌'}
                </span>
              </div>
            </div>
          </div>

          {/* Missing Results Section */}
          {report.missingList.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <h5 className="text-xs font-black text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" /> Missing Results ({report.missingList.length})
              </h5>
              <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                {report.missingList.map((m, idx) => (
                  <div
                    key={idx}
                    className="text-xs text-red-300 font-mono bg-dark/40 px-3 py-1.5 rounded-lg border border-red-500/20 flex items-center justify-between"
                  >
                    <span>
                      {m.groupName} → <strong className="text-white">{m.teamName}</strong> → Match #{m.matchNumber}
                    </span>
                    <span className="text-[10px] text-red-400">{m.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invalid Results Section */}
          {report.invalidList.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
              <h5 className="text-xs font-black text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Invalid Results ({report.invalidList.length})
              </h5>
              <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                {report.invalidList.map((inv, idx) => (
                  <div
                    key={idx}
                    className="text-xs text-amber-300 font-mono bg-dark/40 px-3 py-1.5 rounded-lg border border-amber-500/20 flex items-center justify-between"
                  >
                    <span>
                      {inv.groupName} → <strong className="text-white">{inv.teamName}</strong> → Match #{inv.matchNumber}
                    </span>
                    <span className="text-[10px] text-amber-400 font-bold">{inv.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Duplicate Placements */}
          {report.groups.some((g) => g.duplicatePlacements.length > 0) && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <h5 className="text-xs font-black text-red-400 uppercase tracking-wider mb-2">
                Duplicate Placement Conflicts
              </h5>
              {report.groups.map((g) =>
                g.duplicatePlacements.map((d, dIdx) => (
                  <div key={dIdx} className="text-xs text-red-300 font-mono py-1">
                    {g.groupName} • Match #{d.matchNumber}: Placement #{d.placement} shared by {d.teams.join(', ')}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Final Verdict */}
          <div
            className={`p-4 rounded-xl text-xs font-bold border ${
              report.canProcess
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : 'bg-red-500/10 text-red-300 border-red-500/30'
            }`}
          >
            {report.canProcess ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>All verification checks passed! Stage is ready for processing and qualification.</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                <span>
                  Stage cannot be processed. All groups, teams, and matches must have verified results before advancement.
                </span>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setIsReportModalOpen(false)}
              className="px-5 py-2.5 rounded-xl bg-dark border border-gray-700 hover:border-gray-500 text-white text-xs font-black uppercase tracking-wider"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── MODAL 3: QUALIFICATION PREVIEW & CONFIRM PROCESS ─── */}
      <Modal
        isOpen={isQualPreviewModalOpen}
        onClose={() => setIsQualPreviewModalOpen(false)}
        title="Qualification Preview & Confirmation"
        maxWidth="sm:max-w-3xl"
      >
        <div className="space-y-5">
          <div className="bg-brand-500/10 border border-brand-500/30 rounded-xl p-4 text-xs text-brand-300">
            <p className="font-bold">
              Review calculated stage standings and qualified teams before finalizing.
            </p>
            <p className="text-[10px] text-gray-400 mt-1">
              Top teams advance automatically according to the stage roadmap rules. Organizers cannot manually manipulate qualification results.
            </p>
          </div>

          {/* Standings by Group */}
          {report.qualificationPreview?.groups.map((group) => (
            <div key={group.groupId} className="bg-dark/70 rounded-xl p-4 border border-gray-800">
              <h5 className="text-xs font-black text-white uppercase tracking-wider mb-3 flex items-center justify-between">
                <span>{group.groupName} Standings</span>
                <span className="text-[10px] text-emerald-400 font-mono">
                  {group.standings.filter((s) => s.qualificationStatus === 'qualified').length} Qualified
                </span>
              </h5>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-800 text-[10px] font-black uppercase text-gray-500">
                      <th className="py-2 px-2">Rank</th>
                      <th className="py-2 px-2">Team</th>
                      <th className="py-2 px-2">Matches</th>
                      <th className="py-2 px-2">Kills</th>
                      <th className="py-2 px-2">Placement Pts</th>
                      <th className="py-2 px-2">Total Pts</th>
                      <th className="py-2 px-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {group.standings.map((team, idx) => {
                      const isQual = team.qualificationStatus === 'qualified';
                      return (
                        <tr
                          key={team.teamId}
                          className={isQual ? 'bg-emerald-500/5' : 'text-gray-400'}
                        >
                          <td className="py-2.5 px-2 font-mono font-bold">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-2 font-bold text-white">
                            {team.teamName}
                          </td>
                          <td className="py-2.5 px-2 font-mono text-gray-300">
                            {team.matchesPlayed}
                          </td>
                          <td className="py-2.5 px-2 font-mono text-gray-300">
                            {team.totalKills}
                          </td>
                          <td className="py-2.5 px-2 font-mono text-gray-300">
                            {team.totalPlacementPoints}
                          </td>
                          <td className="py-2.5 px-2 font-mono font-black text-brand-400">
                            {team.totalPoints} pts
                          </td>
                          <td className="py-2.5 px-2 text-right">
                            {isQual ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                                <Check className="w-3 h-3" /> Qualified
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                                Eliminated
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Confirmation Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-800">
            <button
              type="button"
              onClick={() => setIsQualPreviewModalOpen(false)}
              className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-gray-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={processingStage}
              onClick={handleConfirmProcessStage}
              className="px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/25 cursor-pointer"
            >
              {processingStage ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Processing & Advancing Stage...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Confirm & Process Stage
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── MODAL 4: REQUEST RESULT CORRECTION MODAL ─── */}
      <Modal
        isOpen={isCorrectionModalOpen}
        onClose={() => setIsCorrectionModalOpen(false)}
        title="Request Stage Result Correction"
      >
        <div className="space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-300">
            <p className="font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> Caution: Result Correction Request
            </p>
            <p className="text-[10px] text-gray-400 mt-1">
              Requesting a correction on a processed stage will transition the stage status to{' '}
              <span className="font-mono text-amber-400">RESULTS_REVALIDATION_REQUIRED</span> and require full revalidation before further tournament advancement.
            </p>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">
              Reason for Correction Request
            </label>
            <textarea
              rows={4}
              value={correctionReason}
              onChange={(e) => setCorrectionReason(e.target.value)}
              placeholder="Explain what results need to be corrected and why (e.g., incorrect screenshot kill count for Team Alpha in Match 2)..."
              className="w-full bg-dark border border-gray-800 rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-800">
            <button
              type="button"
              onClick={() => setIsCorrectionModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-gray-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={requestingCorrection || !correctionReason.trim()}
              onClick={handleSubmitCorrection}
              className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-black font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {requestingCorrection ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Submitting...
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5" /> Submit Correction Request
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
};
