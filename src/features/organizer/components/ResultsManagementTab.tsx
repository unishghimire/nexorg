import React, { useState, useMemo } from 'react';
import {
  FileCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  Search,
  Filter,
  Trophy,
  Gamepad2,
  Calendar,
  ExternalLink,
  Target,
  ArrowUpRight,
  RotateCcw,
  Layers,
  Edit3,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { formatDate } from '../../../shared/utils/utils';
import {
  getResultDeadlineRemaining,
  DeadlineRemaining,
} from '../../../shared/services/eventSettlementService';

export interface ResultsManagementTabProps {
  hostedTournaments?: any[];
  hostedScrims?: any[];
  disputes?: any[];
  onNavigateTab?: (tabId: string) => void;
  onRefreshData?: () => void;
}

export const ResultsManagementTab: React.FC<ResultsManagementTabProps> = ({
  hostedTournaments = [],
  hostedScrims = [],
  disputes = [],
  onNavigateTab,
  onRefreshData,
}) => {
  const [activeSection, setActiveSection] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'TOURNAMENT' | 'SCRIM'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Collect all events with results status & 48h deadline status
  const eventResults = useMemo(() => {
    const combined = [
      ...hostedTournaments.map((t) => ({ ...t, _eventType: 'tournament' as const })),
      ...hostedScrims.map((s) => ({ ...s, _eventType: 'scrim' as const })),
    ];

    return combined.map((event) => {
      const eventId = event.id;
      const title = event.title || 'Untitled Event';
      const eventType = event._eventType;
      const status = String(event.status || 'open').toLowerCase();
      const isCompleted = status === 'completed' || status === 'finalized';
      const isLive = status === 'live';

      const isPerKill =
        event.scrimMode === 'PER_KILL' ||
        (event.rewardPerKill !== undefined && Number(event.rewardPerKill) > 0);

      // Result Status derivation
      const rawResStatus = String(event.resultStatus || 'pending').toLowerCase();
      const isPublished = rawResStatus === 'published' || rawResStatus === 'verified';
      const hasDisputes = disputes.some(
        (d) => (d.eventId === eventId || d.tournamentId === eventId || d.scrimId === eventId) && d.status === 'pending'
      );

      // 48h Deadline calculation
      const deadline: DeadlineRemaining | null = isCompleted
        ? getResultDeadlineRemaining(event)
        : null;

      let sectionCategory:
        | 'pending'
        | 'in_progress'
        | 'submitted'
        | 'under_review'
        | 'verified'
        | 'published'
        | 'overdue'
        | 'history'
        | 'disputed' = 'pending';

      if (hasDisputes) {
        sectionCategory = 'disputed';
      } else if (isPublished) {
        sectionCategory = 'published';
      } else if (deadline?.isExpired || event.penaltyApplied) {
        sectionCategory = 'overdue';
      } else if (event.resultsUnderReview) {
        sectionCategory = 'under_review';
      } else if (rawResStatus === 'submitted') {
        sectionCategory = 'submitted';
      } else if (isLive) {
        sectionCategory = 'in_progress';
      } else if (isCompleted) {
        sectionCategory = 'pending';
      } else {
        sectionCategory = 'pending';
      }

      // Result count metrics
      let totalResults = 0;
      let completedResults = 0;

      if (eventType === 'tournament') {
        const groups = event.groups || [];
        for (const g of groups) {
          const tCount = (g.teams || []).length;
          const mCount = (g.matches || []).length;
          totalResults += tCount * mCount;
          for (const m of g.matches || []) {
            completedResults += (m.results || []).filter((r: any) => r.placement > 0).length;
          }
        }
      } else {
        totalResults = Number(event.filledSlots || event.currentPlayers || 0);
        completedResults = Array.isArray(event.manualResults)
          ? event.manualResults.filter((r: any) => r.rank > 0).length
          : Array.isArray(event.winners)
          ? event.winners.length
          : 0;
      }

      return {
        eventId,
        title,
        eventType,
        status,
        isCompleted,
        isLive,
        isPerKill,
        rewardPerKill: Number(event.rewardPerKill || 0),
        rawResStatus,
        isPublished,
        hasDisputes,
        deadline,
        sectionCategory,
        totalResults,
        completedResults,
        completedAt: event.completedAt,
        resultDeadlineAt: event.resultDeadlineAt,
        rawEvent: event,
      };
    });
  }, [hostedTournaments, hostedScrims, disputes]);

  // Summary counters
  const summary = useMemo(() => {
    let pendingCount = 0;
    let inProgressCount = 0;
    let publishedCount = 0;
    let overdueCount = 0;
    let disputedCount = 0;

    for (const r of eventResults) {
      if (r.sectionCategory === 'pending') pendingCount++;
      else if (r.sectionCategory === 'in_progress') inProgressCount++;
      else if (r.sectionCategory === 'published') publishedCount++;
      else if (r.sectionCategory === 'overdue') overdueCount++;
      else if (r.sectionCategory === 'disputed') disputedCount++;
    }

    return {
      total: eventResults.length,
      pendingCount,
      inProgressCount,
      publishedCount,
      overdueCount,
      disputedCount,
    };
  }, [eventResults]);

  // Filtered
  const filteredResults = useMemo(() => {
    return eventResults.filter((item) => {
      if (typeFilter === 'TOURNAMENT' && item.eventType !== 'tournament') return false;
      if (typeFilter === 'SCRIM' && item.eventType !== 'scrim') return false;

      if (activeSection !== 'ALL') {
        if (activeSection === 'PENDING' && item.sectionCategory !== 'pending') return false;
        if (activeSection === 'IN_PROGRESS' && item.sectionCategory !== 'in_progress') return false;
        if (activeSection === 'PUBLISHED' && item.sectionCategory !== 'published') return false;
        if (activeSection === 'OVERDUE' && item.sectionCategory !== 'overdue') return false;
        if (activeSection === 'DISPUTED' && item.sectionCategory !== 'disputed') return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return item.title.toLowerCase().includes(q) || item.eventId.toLowerCase().includes(q);
      }

      return true;
    });
  }, [eventResults, activeSection, typeFilter, searchQuery]);

  const renderSectionBadge = (cat: string) => {
    switch (cat) {
      case 'published':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" /> Published &amp; Verified
          </span>
        );
      case 'overdue':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/30 animate-pulse">
            <AlertCircle className="w-3 h-3" /> 48h Deadline Overdue
          </span>
        );
      case 'disputed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3" /> Disputed Result
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" /> Match In Progress
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-surface text-gray-400 border border-gray-700">
            <Clock className="w-3 h-3 text-amber-400" /> Results Pending
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
            <FileCheck className="w-3.5 h-3.5" /> Scoring &amp; Publication Hub
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase">
            Tournament &amp; Scrim Result Management
          </h2>
          <p className="text-xs text-gray-400 font-medium mt-0.5">
            Authoritative scoring verification, 48-hour result deadlines, and match publication console.
          </p>
        </div>

        {onRefreshData && (
          <button
            type="button"
            onClick={onRefreshData}
            className="px-3.5 py-2 bg-surface hover:bg-gray-800 text-gray-300 rounded-xl text-xs font-bold uppercase tracking-wider border border-gray-700 flex items-center gap-1.5 transition-colors self-start sm:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Refresh
          </button>
        )}
      </div>

      {/* ─── 2. Status Counters ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => setActiveSection('ALL')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeSection === 'ALL'
              ? 'bg-brand-500/10 border-brand-500/50 shadow-md shadow-brand-950/20'
              : 'bg-dark/50 border-gray-800 hover:border-gray-700'
          }`}
        >
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-1">
            All Events
          </span>
          <div className="text-2xl font-black font-mono text-white">{summary.total}</div>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('PENDING')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeSection === 'PENDING'
              ? 'bg-amber-500/10 border-amber-500/50 shadow-md shadow-amber-950/20'
              : 'bg-dark/50 border-gray-800 hover:border-gray-700'
          }`}
        >
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block mb-1">
            Results Pending
          </span>
          <div className="text-2xl font-black font-mono text-amber-400">{summary.pendingCount}</div>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('OVERDUE')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeSection === 'OVERDUE'
              ? 'bg-red-500/10 border-red-500/50 shadow-md shadow-red-950/20'
              : 'bg-dark/50 border-gray-800 hover:border-gray-700'
          }`}
        >
          <span className="text-[10px] font-black uppercase tracking-widest text-red-400 block mb-1">
            48h Overdue
          </span>
          <div className="text-2xl font-black font-mono text-red-400">{summary.overdueCount}</div>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('PUBLISHED')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeSection === 'PUBLISHED'
              ? 'bg-emerald-500/10 border-emerald-500/50 shadow-md shadow-emerald-950/20'
              : 'bg-dark/50 border-gray-800 hover:border-gray-700'
          }`}
        >
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block mb-1">
            Published
          </span>
          <div className="text-2xl font-black font-mono text-emerald-400">{summary.publishedCount}</div>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('DISPUTED')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            activeSection === 'DISPUTED'
              ? 'bg-purple-500/10 border-purple-500/50 shadow-md shadow-purple-950/20'
              : 'bg-dark/50 border-gray-800 hover:border-gray-700'
          }`}
        >
          <span className="text-[10px] font-black uppercase tracking-widest text-purple-400 block mb-1">
            Disputed
          </span>
          <div className="text-2xl font-black font-mono text-purple-400">{summary.disputedCount}</div>
        </button>
      </div>

      {/* ─── 3. Search & Filter Bar ─── */}
      <div className="bg-card/50 border border-gray-800 rounded-xl p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 custom-scrollbar">
          {(
            [
              { id: 'ALL', label: 'All Results' },
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

        <div className="relative min-w-[200px] flex-1 max-w-xs">
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

      {/* ─── 4. Results Cards Listing ─── */}
      {filteredResults.length === 0 ? (
        <div className="text-center py-16 bg-card/20 rounded-2xl border border-gray-800">
          <FileCheck className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <h4 className="text-sm font-black uppercase text-white tracking-wider">No Results Found</h4>
          <p className="text-xs text-gray-400 mt-1">
            {searchQuery || activeSection !== 'ALL' || typeFilter !== 'ALL'
              ? 'No events match your current filter criteria.'
              : 'Host a tournament or scrim to enter results and track scoring.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredResults.map((item) => {
            const editUrl =
              item.eventType === 'tournament'
                ? `/tournaments/${item.eventId}`
                : `/scrims/${item.eventId}`;

            return (
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
                      {renderSectionBadge(item.sectionCategory)}
                      {item.isPerKill && (
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1">
                          <Target className="w-3 h-3" /> Per-Kill (Rs. {item.rewardPerKill}/kill)
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-gray-400 flex items-center gap-3 flex-wrap">
                      <span>
                        Results Verified: <strong className="text-white">{item.completedResults}</strong> / {item.totalResults || 'All'}
                      </span>
                      {item.completedAt && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-gray-500" /> Completed: {formatDate(item.completedAt)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions & 48h Deadline Pill */}
                  <div className="flex items-center gap-3">
                    {item.deadline && (
                      <div className="flex items-center gap-2 bg-dark/80 border border-gray-800 rounded-xl px-3 py-1.5">
                        <Clock className={`w-3.5 h-3.5 ${item.deadline.isExpired ? 'text-red-400' : item.deadline.isWarning ? 'text-amber-400' : 'text-emerald-400'}`} />
                        <div className="text-[10px] font-mono font-bold">
                          {item.deadline.isExpired ? (
                            <span className="text-red-400">Overdue (10% Penalty)</span>
                          ) : (
                            <span className={item.deadline.isWarning ? 'text-amber-400' : 'text-emerald-400'}>
                              {item.deadline.formatted}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <a
                      href={editUrl}
                      className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-brand-500 hover:bg-brand-400 text-white flex items-center gap-1.5 shadow-md shadow-brand-500/20 transition-all cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{item.eventType === 'tournament' ? 'Stage Console' : 'Enter Results'}</span>
                    </a>
                  </div>
                </div>

                {/* Subtext info */}
                <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-gray-500">Scoring Engine:</span>
                    <span className="text-gray-300">
                      {item.isPerKill
                        ? 'Verified Kills × configured Kill Rate = Calculated Reward'
                        : 'Placement Points + Kill Points = Total Points'}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-500">🔒 Calculations are authoritative server-side</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ResultsManagementTab;
