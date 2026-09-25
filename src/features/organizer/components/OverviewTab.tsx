import React, { useMemo } from 'react';
import {
  Trophy,
  Users,
  AlertTriangle,
  DollarSign,
  Radio,
  Shield,
  Activity,
  ArrowRight,
  Plus,
  Gamepad2,
  ChevronRight,
  ExternalLink,
  Lock,
  Zap,
  CheckCircle2,
  Clock,
  Sparkles,
  TrendingUp,
  AlertCircle,
  ArrowUpRight,
  FileCheck,
} from 'lucide-react';
import { Tournament } from '../../../shared/types/types';
import { getSlotCount, getFilledSlotCount } from '../../../shared/utils/scrimSlots';
import { calculateLevel, getXPForNextLevel, getLevelProgress, ORG_EXP_REWARDS } from '../../../shared/utils/utils';
import {
  computeOrganizerEventOverview,
  computeOrganizerFinancialOverview,
  computeOrganizerAlerts,
  OrganizerAlert,
} from '../../../shared/services/organizerFinancialsService';

export interface OverviewTabProps {
  kpis?: {
    activeTournaments: number;
    liveScrims: number;
    totalTeams: number;
    prizePool: number;
    monthlyRevenue: number;
    pendingPayouts: number;
    orgWalletBalance: number;
    escrowBalance: number;
    filledSlots: number;
    totalSlots: number;
  };
  activityFeed?: {
    id: string;
    icon: string;
    text: string;
    time: string;
    type: string;
  }[];
  hostedTournaments?: Tournament[] | any[];
  hostedScrims?: Tournament[] | any[];
  disputes?: any[];
  transactions?: any[];
  profile?: any;
  isPowerOrg?: boolean;
  powerOrgApplicationStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  completedScrimsCount?: number;
  minAuthenticScrimsForPowerOrg?: number;
  orgLevel?: number;
  orgXp?: number;
  onApplyPowerOrg?: () => void;
  onNavigateTab?: (tabId: string) => void;
  onCreateTournament?: () => void;
  onCreateScrim?: () => void;
}

const formatRupees = (amount: number = 0): string => {
  return `Rs. ${new Intl.NumberFormat('en-IN').format(amount)}`;
};

const renderIcon = (iconName: string) => {
  const normalized = (iconName || '').toLowerCase();
  if (normalized.includes('trophy')) {
    return <Trophy className="w-4 h-4 text-brand-400 shrink-0" />;
  }
  if (normalized.includes('user')) {
    return <Users className="w-4 h-4 text-blue-400 shrink-0" />;
  }
  if (normalized.includes('alert') || normalized.includes('warn')) {
    return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
  }
  if (normalized.includes('dollar') || normalized.includes('money') || normalized.includes('pay')) {
    return <DollarSign className="w-4 h-4 text-emerald-400 shrink-0" />;
  }
  if (normalized.includes('radio') || normalized.includes('broadcast')) {
    return <Radio className="w-4 h-4 text-indigo-400 shrink-0" />;
  }
  if (normalized.includes('shield')) {
    return <Shield className="w-4 h-4 text-red-400 shrink-0" />;
  }
  return <Activity className="w-4 h-4 text-brand-400 shrink-0" />;
};

const renderStatusBadge = (status: string) => {
  const s = (status || '').toLowerCase();
  if (s === 'live') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Live
      </span>
    );
  }
  if (s === 'upcoming' || s === 'published' || s === 'draft') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-surface text-gray-300 border border-gray-700/80">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
        {s.charAt(0).toUpperCase() + s.slice(1)}
      </span>
    );
  }
  if (s === 'completed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-surface text-gray-500 border border-gray-800">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-600" />
        Completed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-surface text-gray-400 border border-gray-800">
      {status || 'Unknown'}
    </span>
  );
};

const OverviewTab: React.FC<OverviewTabProps> = ({
  kpis = {
    activeTournaments: 0,
    liveScrims: 0,
    totalTeams: 0,
    prizePool: 0,
    monthlyRevenue: 0,
    pendingPayouts: 0,
    orgWalletBalance: 0,
    escrowBalance: 0,
    filledSlots: 0,
    totalSlots: 0,
  },
  activityFeed = [],
  hostedTournaments = [],
  hostedScrims = [],
  disputes = [],
  transactions = [],
  profile,
  isPowerOrg = false,
  powerOrgApplicationStatus = 'none',
  completedScrimsCount,
  minAuthenticScrimsForPowerOrg = 20,
  orgLevel,
  orgXp,
  onApplyPowerOrg,
  onNavigateTab,
  onCreateTournament,
  onCreateScrim,
}) => {
  // Authoritative calculations from event data & wallet transactions
  const eventOverview = useMemo(() => {
    return computeOrganizerEventOverview({
      tournaments: hostedTournaments || [],
      scrims: hostedScrims || [],
    });
  }, [hostedTournaments, hostedScrims]);

  const financialOverview = useMemo(() => {
    return computeOrganizerFinancialOverview({
      tournaments: hostedTournaments || [],
      scrims: hostedScrims || [],
      transactions: transactions || [],
      profile,
    });
  }, [hostedTournaments, hostedScrims, transactions, profile]);

  const eventAlerts = useMemo(() => {
    return computeOrganizerAlerts({
      tournaments: hostedTournaments || [],
      scrims: hostedScrims || [],
      disputes: disputes || [],
    });
  }, [hostedTournaments, hostedScrims, disputes]);

  // Calculate verified completed authentic scrims
  const effectiveCompletedCount = typeof completedScrimsCount === 'number'
    ? completedScrimsCount
    : (hostedScrims || []).filter((s: any) =>
        s.status === 'completed' &&
        (s.payoutCompleted ||
         (Array.isArray(s.winners) && s.winners.length > 0) ||
         (Array.isArray(s.manualResults) && s.manualResults.length > 0) ||
         (Number(s.filledSlots) >= 2 || Number(s.currentPlayers) >= 2))
      ).length;

  const requiredScrims = Number(minAuthenticScrimsForPowerOrg) || 20;
  const progressPercent = Math.min(100, Math.round((effectiveCompletedCount / requiredScrims) * 100));
  const isRequirementMet = effectiveCompletedCount >= requiredScrims;
  const remainingScrims = Math.max(0, requiredScrims - effectiveCompletedCount);

  // Organization Level & EXP calculations
  const currentOrgXp = Math.max(0, Number(orgXp) || 0);
  const orgLevelValue = Math.max(1, Number(orgLevel) || calculateLevel(currentOrgXp));
  const nextLevelTarget = getXPForNextLevel(orgLevelValue);
  const levelProgressPercent = getLevelProgress(currentOrgXp);

  return (
    <div className="space-y-6 text-sm">
      {/* Overview Header with Quick Jump Buttons */}
      <div className="bg-card/70 border border-gray-800/80 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-brand-400 mb-0.5">
            <Activity className="w-3.5 h-3.5" /> Mission Control
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase">Dashboard Overview</h2>
          <p className="text-xs text-gray-400 font-medium mt-0.5">
            Real-time status, key operations, and shortcuts across your host suite.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onCreateTournament && (
            <button
              type="button"
              onClick={onCreateTournament}
              className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer ${
                isPowerOrg
                  ? 'bg-brand-600 hover:bg-brand-500 text-white shadow-md shadow-brand-950/40'
                  : 'bg-dark border border-gray-800 hover:border-amber-500/50 text-gray-400 hover:text-amber-300'
              }`}
            >
              {isPowerOrg ? <Plus className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5 text-amber-400" />}
              <span>Create Tournament</span>
              {!isPowerOrg && (
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">
                  POWER
                </span>
              )}
            </button>
          )}
          {onCreateScrim && (
            <button
              type="button"
              onClick={onCreateScrim}
              className="px-3.5 py-2 bg-surface hover:bg-surface text-gray-200 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider border border-gray-700 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Gamepad2 className="w-3.5 h-3.5 text-orange-400" /> Schedule Scrim
            </button>
          )}
        </div>
      </div>

      {/* ─── ORGANIZATION LEVEL & EXP PROGRESSION CARD ─── */}
      <div className="bg-gradient-to-br from-indigo-950/40 via-purple-950/20 to-card border border-purple-500/30 p-5 rounded-2xl shadow-lg relative overflow-hidden backdrop-blur-sm">
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-purple-500 via-indigo-500 to-brand-500 p-0.5 shadow-md shadow-purple-950/50 flex-shrink-0">
              <div className="w-full h-full bg-dark/95 rounded-[14px] flex flex-col items-center justify-center">
                <span className="text-[9px] font-black uppercase tracking-widest text-purple-300 leading-none">LVL</span>
                <span className="text-xl sm:text-2xl font-black text-white font-mono leading-tight">{orgLevelValue}</span>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  Organization Level {orgLevelValue}
                </span>
                <span className="text-[10px] text-gray-400 font-bold">
                  {currentOrgXp.toLocaleString()} Total EXP
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-tight mt-1">
                Organization Progression &amp; EXP
              </h3>
              <p className="text-xs text-gray-400">
                Earn host EXP through event creation and match completions to advance your organization level.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <div className="text-[11px] font-bold text-gray-300 bg-black/40 border border-white/5 px-2.5 py-1 rounded-xl flex items-center gap-1.5">
              <span className="text-purple-400 font-black font-mono">+{ORG_EXP_REWARDS.SCRIM_CREATED}</span> Scrim Create
            </div>
            <div className="text-[11px] font-bold text-gray-300 bg-black/40 border border-white/5 px-2.5 py-1 rounded-xl flex items-center gap-1.5">
              <span className="text-emerald-400 font-black font-mono">+{ORG_EXP_REWARDS.SCRIM_COMPLETED}</span> Scrim Done
            </div>
            <div className="text-[11px] font-bold text-gray-300 bg-black/40 border border-white/5 px-2.5 py-1 rounded-xl flex items-center gap-1.5">
              <span className="text-purple-400 font-black font-mono">+{ORG_EXP_REWARDS.TOURNAMENT_CREATED}</span> Tourn Create
            </div>
            <div className="text-[11px] font-bold text-gray-300 bg-black/40 border border-white/5 px-2.5 py-1 rounded-xl flex items-center gap-1.5">
              <span className="text-amber-400 font-black font-mono">+{ORG_EXP_REWARDS.TOURNAMENT_COMPLETED}</span> Tourn Done
            </div>
          </div>
        </div>

        {/* Level Progression Bar */}
        <div className="mt-4 pt-4 border-t border-gray-800/80 space-y-2 relative z-10">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-gray-400 uppercase text-[10px] font-black tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
              Level {orgLevelValue} Progress {orgLevelValue >= 100 ? '(Max Level)' : `(Next Target: Level ${orgLevelValue + 1})`}
            </span>
            <span className="text-purple-300 font-mono font-black">
              {currentOrgXp} / {nextLevelTarget} EXP ({Math.round(levelProgressPercent)}%)
            </span>
          </div>

          <div className="w-full h-2.5 bg-black/60 rounded-full overflow-hidden border border-white/5 p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-600 via-indigo-500 to-pink-500 shadow-sm shadow-purple-500/50 transition-all duration-500"
              style={{ width: `${levelProgressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* ─── POWER ORGANIZER TIER & TOURNAMENT UNLOCK PROGRESSION CARD ─── */}
      <div
        className={`p-5 rounded-2xl border transition-all ${
          isPowerOrg
            ? 'bg-gradient-to-br from-amber-500/10 via-emerald-500/5 to-card border-amber-500/30 shadow-lg shadow-amber-950/10'
            : isRequirementMet
            ? 'bg-gradient-to-br from-emerald-500/15 via-brand-500/10 to-card border-emerald-500/40 shadow-lg shadow-emerald-950/20'
            : 'bg-card/80 border-gray-800/80 shadow-md'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${
                  isPowerOrg
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-dark text-gray-400 border-gray-700'
                }`}
              >
                {isPowerOrg ? (
                  <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
                ) : (
                  <Shield className="w-3 h-3 text-gray-400" />
                )}
                {isPowerOrg ? 'Power Organizer Verified' : 'Standard Organizer'}
              </span>

              {isPowerOrg ? (
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Tournaments &amp; Scrims Unlocked
                </span>
              ) : powerOrgApplicationStatus === 'pending' ? (
                <span className="text-[10px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-400" /> Application Under Admin Review
                </span>
              ) : isRequirementMet ? (
                <span className="text-[10px] font-black text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> 20/20 Scrims Met — Ready to Apply
                </span>
              ) : (
                <span className="text-[10px] font-bold text-gray-400 bg-black/40 border border-white/5 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Lock className="w-3 h-3 text-amber-400" /> Tournament Hosting Locked
                </span>
              )}
            </div>

            <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
              {isPowerOrg ? (
                <>Official Tournament &amp; Scrim Host Suite</>
              ) : (
                <>Power Organizer Qualification</>
              )}
            </h3>

            <p className="text-xs text-gray-400 max-w-2xl leading-relaxed">
              {isPowerOrg
                ? 'Your organization has full verified authorization to create and host official multi-round tournaments, brackets, and all scrim formats on Nexplay.'
                : 'Standard Organizers can host Free Scrims, Paid Scrims, and Per-Kill Scrims. To unlock official Tournament hosting, complete 20 authentic scrims with verified results and apply for Power status.'}
            </p>
          </div>

          {/* Action button if eligible & not power org */}
          {!isPowerOrg && (
            <div className="shrink-0 flex items-center gap-2">
              {isRequirementMet ? (
                powerOrgApplicationStatus === 'pending' ? (
                  <button
                    type="button"
                    disabled
                    className="px-4 py-2.5 bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-xl text-xs font-black uppercase tracking-wider cursor-not-allowed flex items-center gap-1.5"
                  >
                    <Clock className="w-4 h-4 animate-spin text-amber-400" /> Review Pending
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onApplyPowerOrg}
                    className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-black rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer"
                  >
                    <Zap className="w-4 h-4 fill-black" /> Apply for Power Status
                  </button>
                )
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigateTab?.('scrims')}
                  className="px-4 py-2.5 bg-surface hover:bg-surface text-gray-200 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider border border-gray-700 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Gamepad2 className="w-4 h-4 text-orange-400" /> Host Scrims ({remainingScrims} left)
                </button>
              )}
            </div>
          )}
        </div>

        {/* Progression Bar (shown for standard organizers) */}
        {!isPowerOrg && (
          <div className="mt-4 pt-4 border-t border-gray-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-gray-400 uppercase text-[10px] font-black tracking-wider flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                Authentic Scrims Milestone (20 Required)
              </span>
              <span
                className={
                  isRequirementMet
                    ? 'text-emerald-400 font-mono font-black'
                    : 'text-amber-400 font-mono font-black'
                }
              >
                {effectiveCompletedCount} / 20 Scrims ({progressPercent}%)
              </span>
            </div>

            <div className="w-full h-2.5 bg-black/60 rounded-full overflow-hidden border border-white/5 p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isRequirementMet
                    ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 shadow-sm shadow-emerald-500/50'
                    : 'bg-gradient-to-r from-brand-600 to-amber-500 shadow-sm shadow-brand-500/40'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ─── EVENT ALERTS & ACTION HUB ─── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`w-4 h-4 ${eventAlerts.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`} />
            <span className="text-xs font-black uppercase tracking-wider text-white">
              {eventAlerts.length > 0 ? `Action Required (${eventAlerts.length})` : 'System Status'}
            </span>
          </div>
          <span className="text-[10px] text-gray-500 font-medium">
            {eventAlerts.length > 0 ? 'Prioritized Host Alerts' : 'All Clear'}
          </span>
        </div>

        {eventAlerts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {eventAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-2xl border flex flex-col justify-between transition-all backdrop-blur-sm ${
                  alert.severity === 'error'
                    ? 'bg-rose-950/20 border-rose-500/40 text-rose-300 shadow-md shadow-rose-950/20'
                    : alert.severity === 'warning'
                    ? 'bg-amber-950/20 border-amber-500/40 text-amber-300 shadow-md shadow-amber-950/20'
                    : 'bg-blue-950/20 border-blue-500/40 text-blue-300 shadow-md shadow-blue-950/20'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-black/40 border border-white/5 shrink-0 mt-0.5">
                    {alert.severity === 'error' ? (
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                    ) : alert.severity === 'warning' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Clock className="w-4 h-4 text-blue-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-white leading-snug">{alert.title}</h4>
                    <p className="text-xs text-gray-300 mt-1 leading-relaxed">{alert.message}</p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400">
                    {alert.type.replace(/_/g, ' ')}
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigateTab?.(alert.targetTab)}
                    className="text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <span>Resolve Now</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-emerald-950/15 border border-emerald-500/30 p-3.5 rounded-2xl flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-emerald-300">All Event Systems Operational</span>
                <span className="text-gray-400 ml-2 hidden sm:inline">
                  All active lock amounts are fully funded and no 48h result deadlines are pending.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab?.('locks')}
              className="text-[11px] font-black uppercase text-emerald-400 hover:text-emerald-300 shrink-0"
            >
              View Locks &rarr;
            </button>
          </div>
        )}
      </div>

      {/* ─── EVENT OPERATIONS OVERVIEW (8 METRIC CARDS) ─── */}
      <div className="bg-card/70 border border-gray-800/80 p-5 rounded-2xl shadow-lg backdrop-blur-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-800 pb-3">
          <div>
            <h3 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
              <Trophy className="w-4 h-4 text-brand-400" /> Event Operations Overview
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Live status distribution across your hosted tournaments and scrims
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-bold">
              Total Events: <span className="text-white font-mono">{eventOverview.totalTournaments + eventOverview.totalScrims}</span>
            </span>
          </div>
        </div>

        {/* Tournaments Row */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-brand-400 uppercase text-[11px] tracking-wider flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5" /> Tournaments ({eventOverview.totalTournaments})
            </span>
            <button
              type="button"
              onClick={() => onNavigateTab?.('tournaments')}
              className="text-[11px] font-bold text-gray-400 hover:text-brand-400 transition flex items-center gap-1 cursor-pointer"
            >
              Manage Tournaments <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <button
              type="button"
              onClick={() => onNavigateTab?.('tournaments')}
              className="p-3 bg-dark/60 hover:bg-dark border border-gray-800 hover:border-gray-700 rounded-xl text-left transition cursor-pointer"
            >
              <span className="text-[10px] uppercase font-bold text-gray-400 block">Total</span>
              <span className="text-xl font-black text-white font-mono">{eventOverview.totalTournaments}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab?.('tournaments')}
              className="p-3 bg-emerald-950/20 hover:bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-left transition cursor-pointer"
            >
              <span className="text-[10px] uppercase font-black text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live / Active
              </span>
              <span className="text-xl font-black text-emerald-300 font-mono">{eventOverview.activeTournaments}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab?.('tournaments')}
              className="p-3 bg-sky-950/20 hover:bg-sky-950/30 border border-sky-500/30 rounded-xl text-left transition cursor-pointer"
            >
              <span className="text-[10px] uppercase font-black text-sky-400 block">Upcoming / Open</span>
              <span className="text-xl font-black text-sky-300 font-mono">{eventOverview.upcomingTournaments}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab?.('tournaments')}
              className="p-3 bg-dark/60 hover:bg-dark border border-gray-800 hover:border-gray-700 rounded-xl text-left transition cursor-pointer"
            >
              <span className="text-[10px] uppercase font-bold text-gray-400 block">Completed</span>
              <span className="text-xl font-black text-gray-300 font-mono">{eventOverview.completedTournaments}</span>
            </button>
          </div>
        </div>

        {/* Scrims Row */}
        <div className="space-y-2 pt-2 border-t border-gray-800/60">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-orange-400 uppercase text-[11px] tracking-wider flex items-center gap-1.5">
              <Gamepad2 className="w-3.5 h-3.5" /> Scrims ({eventOverview.totalScrims})
            </span>
            <button
              type="button"
              onClick={() => onNavigateTab?.('scrims')}
              className="text-[11px] font-bold text-gray-400 hover:text-orange-400 transition flex items-center gap-1 cursor-pointer"
            >
              Manage Scrims <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <button
              type="button"
              onClick={() => onNavigateTab?.('scrims')}
              className="p-3 bg-dark/60 hover:bg-dark border border-gray-800 hover:border-gray-700 rounded-xl text-left transition cursor-pointer"
            >
              <span className="text-[10px] uppercase font-bold text-gray-400 block">Total</span>
              <span className="text-xl font-black text-white font-mono">{eventOverview.totalScrims}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab?.('scrims')}
              className="p-3 bg-emerald-950/20 hover:bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-left transition cursor-pointer"
            >
              <span className="text-[10px] uppercase font-black text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live / Active
              </span>
              <span className="text-xl font-black text-emerald-300 font-mono">{eventOverview.activeScrims}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab?.('scrims')}
              className="p-3 bg-sky-950/20 hover:bg-sky-950/30 border border-sky-500/30 rounded-xl text-left transition cursor-pointer"
            >
              <span className="text-[10px] uppercase font-black text-sky-400 block">Upcoming / Open</span>
              <span className="text-xl font-black text-sky-300 font-mono">{eventOverview.upcomingScrims}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab?.('scrims')}
              className="p-3 bg-dark/60 hover:bg-dark border border-gray-800 hover:border-gray-700 rounded-xl text-left transition cursor-pointer"
            >
              <span className="text-[10px] uppercase font-bold text-gray-400 block">Completed</span>
              <span className="text-xl font-black text-gray-300 font-mono">{eventOverview.completedScrims}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── FINANCIAL OVERVIEW & MAIN WALLET SYNC (5 METRIC CARDS) ─── */}
      <div className="bg-gradient-to-br from-emerald-950/20 via-card to-card border border-emerald-500/30 p-5 rounded-2xl shadow-lg backdrop-blur-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-800 pb-3">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-0.5">
              <DollarSign className="w-3.5 h-3.5" /> Single Source of Truth
            </div>
            <h3 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
              Financial Overview &amp; Main Wallet Sync
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Strictly derived from your registered Main NexPlay Wallet and verified event transaction history.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab?.('wallet')}
            className="text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 transition cursor-pointer shrink-0"
          >
            <span>Open Main Wallet</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* 1. Main Wallet Balance */}
          <div className="bg-dark/70 border border-emerald-500/40 p-4 rounded-xl relative overflow-hidden">
            <div className="text-[10px] uppercase font-black text-emerald-400 tracking-wider mb-1 flex items-center justify-between">
              <span>Main Wallet</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-black text-white font-mono">
              {formatRupees(financialOverview.mainWalletBalance)}
            </div>
            <div className="text-[10px] text-gray-400 mt-1">Available balance</div>
          </div>

          {/* 2. Total Locked Amount */}
          <button
            type="button"
            onClick={() => onNavigateTab?.('locks')}
            className="bg-dark/70 hover:bg-dark border border-amber-500/30 hover:border-amber-500/50 p-4 rounded-xl text-left transition cursor-pointer"
          >
            <div className="text-[10px] uppercase font-black text-amber-400 tracking-wider mb-1 flex items-center justify-between">
              <span>Total Locked</span>
              <Lock className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-black text-amber-300 font-mono">
              {formatRupees(financialOverview.totalLockedAmount)}
            </div>
            <div className="text-[10px] text-gray-400 mt-1">In active event escrow</div>
          </button>

          {/* 3. Pending Host Commission */}
          <button
            type="button"
            onClick={() => onNavigateTab?.('wallet')}
            className="bg-dark/70 hover:bg-dark border border-purple-500/30 hover:border-purple-500/50 p-4 rounded-xl text-left transition cursor-pointer"
          >
            <div className="text-[10px] uppercase font-black text-purple-400 tracking-wider mb-1 flex items-center justify-between">
              <span>Pending Commission</span>
              <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-xl font-black text-purple-300 font-mono">
              {formatRupees(financialOverview.pendingCommission)}
            </div>
            <div className="text-[10px] text-gray-400 mt-1">
              Released: {formatRupees(financialOverview.releasedCommission)}
            </div>
          </button>

          {/* 4. Upcoming Settlement */}
          <button
            type="button"
            onClick={() => onNavigateTab?.('settlements')}
            className="bg-dark/70 hover:bg-dark border border-cyan-500/30 hover:border-cyan-500/50 p-4 rounded-xl text-left transition cursor-pointer"
          >
            <div className="text-[10px] uppercase font-black text-cyan-400 tracking-wider mb-1 flex items-center justify-between">
              <span>Upcoming Settlement</span>
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-xl font-black text-cyan-300 font-mono">
              {formatRupees(financialOverview.upcomingSettlement)}
            </div>
            <div className="text-[10px] text-gray-400 mt-1">85% host share pending</div>
          </button>

          {/* 5. Fine Amount Today */}
          <button
            type="button"
            onClick={() => onNavigateTab?.('settlements')}
            className="bg-dark/70 hover:bg-dark border border-rose-500/30 hover:border-rose-500/50 p-4 rounded-xl text-left transition cursor-pointer"
          >
            <div className="text-[10px] uppercase font-black text-rose-400 tracking-wider mb-1 flex items-center justify-between">
              <span>Fine Amount Today</span>
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="text-xl font-black text-rose-400 font-mono">
              {formatRupees(financialOverview.fineAmountToday)}
            </div>
            <div className="text-[10px] text-gray-400 mt-1">
              Total: {formatRupees(financialOverview.historicalFines)}
            </div>
          </button>
        </div>
      </div>

      {/* 1. Interactive KPI Navigation Grid */}
      <div>
        <div className="flex items-center justify-between mb-2.5 px-1">
          <span className="text-[11px] font-black uppercase tracking-widest text-gray-400">
            Operations &amp; Metrics (Click to Navigate)
          </span>
          <span className="text-[10px] text-gray-500 font-medium">Instant Tab Jump</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
          {/* Active Tournaments -> Tournaments Tab */}
          <button
            type="button"
            onClick={() => onNavigateTab?.('tournaments')}
            className="text-left relative overflow-hidden bg-card/80 hover:bg-card p-4 sm:p-5 rounded-2xl border border-gray-800 hover:border-brand-500/50 group transition-all duration-200 shadow-sm hover:shadow-lg hover:shadow-brand-950/20 cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-gray-400 uppercase font-black tracking-wider group-hover:text-brand-400 transition-colors">
                Tournaments
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all" />
            </div>
            <div className="text-2xl font-black text-white tracking-tight group-hover:text-brand-400 transition-colors">
              {kpis?.activeTournaments ?? 0}
            </div>
            <div className="text-[10px] text-gray-500 mt-1 font-semibold flex items-center gap-1">
              <span>Manage active &amp; drafts</span>
            </div>
          </button>

          {/* Live Scrims -> Scrims Tab */}
          <button
            type="button"
            onClick={() => onNavigateTab?.('scrims')}
            className="text-left relative overflow-hidden bg-card/80 hover:bg-card p-4 sm:p-5 rounded-2xl border border-gray-800 hover:border-emerald-500/50 group transition-all duration-200 shadow-sm hover:shadow-lg hover:shadow-emerald-950/20 cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 text-[10px] text-gray-400 uppercase font-black tracking-wider group-hover:text-emerald-400 transition-colors">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Scrims
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
            </div>
            <div className="text-2xl font-black text-white tracking-tight group-hover:text-emerald-400 transition-colors">
              {kpis?.liveScrims ?? 0}
            </div>
            <div className="text-[10px] text-gray-500 mt-1 font-semibold">
              Slot grids &amp; matches
            </div>
          </button>

          {/* Total Teams -> Teams Tab */}
          <button
            type="button"
            onClick={() => onNavigateTab?.('teams')}
            className="text-left relative overflow-hidden bg-card/80 hover:bg-card p-4 sm:p-5 rounded-2xl border border-gray-800 hover:border-blue-500/50 group transition-all duration-200 shadow-sm hover:shadow-lg hover:shadow-blue-950/20 cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-gray-400 uppercase font-black tracking-wider group-hover:text-blue-400 transition-colors">
                Total Teams
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
            </div>
            <div className="text-2xl font-black text-white tracking-tight group-hover:text-blue-400 transition-colors">
              {kpis?.totalTeams ?? 0}
            </div>
            <div className="text-[10px] text-gray-500 mt-1 font-semibold">
              Rosters &amp; verification
            </div>
          </button>

          {/* Prize Pool -> Wallet Tab */}
          <button
            type="button"
            onClick={() => onNavigateTab?.('wallet')}
            className="text-left relative overflow-hidden bg-card/80 hover:bg-card p-4 sm:p-5 rounded-2xl border border-gray-800 hover:border-amber-500/50 group transition-all duration-200 shadow-sm hover:shadow-lg hover:shadow-amber-950/20 cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-gray-400 uppercase font-black tracking-wider group-hover:text-amber-400 transition-colors">
                Prize Pool
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
            </div>
            <div className="text-2xl font-black text-amber-400 tracking-tight">
              {formatRupees(kpis?.prizePool ?? 0)}
            </div>
            <div className="text-[10px] text-gray-500 mt-1 font-semibold">
              Prizes in rotation
            </div>
          </button>

          {/* Org Wallet -> Wallet Tab */}
          <button
            type="button"
            onClick={() => onNavigateTab?.('wallet')}
            className="text-left relative overflow-hidden bg-card/80 hover:bg-card p-4 sm:p-5 rounded-2xl border border-gray-800 hover:border-purple-500/50 group transition-all duration-200 shadow-sm hover:shadow-lg hover:shadow-purple-950/20 cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-gray-400 uppercase font-black tracking-wider group-hover:text-purple-400 transition-colors">
                Org Balance
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all" />
            </div>
            <div className="text-2xl font-black text-white tracking-tight group-hover:text-purple-400 transition-colors">
              {formatRupees(kpis?.orgWalletBalance ?? 0)}
            </div>
            <div className="text-[10px] text-gray-500 mt-1 font-semibold">
              Available organizer funds
            </div>
          </button>

          {/* Escrow Balance -> Wallet Tab */}
          <button
            type="button"
            onClick={() => onNavigateTab?.('wallet')}
            className="text-left relative overflow-hidden bg-card/80 hover:bg-card p-4 sm:p-5 rounded-2xl border border-gray-800 hover:border-cyan-500/50 group transition-all duration-200 shadow-sm hover:shadow-lg hover:shadow-cyan-950/20 cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-gray-400 uppercase font-black tracking-wider group-hover:text-cyan-400 transition-colors">
                Escrow Locked
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
            </div>
            <div className="text-2xl font-black text-white tracking-tight group-hover:text-cyan-400 transition-colors">
              {formatRupees(kpis?.escrowBalance ?? 0)}
            </div>
            <div className="text-[10px] text-gray-500 mt-1 font-semibold">
              Secured player entry fees
            </div>
          </button>

          {/* Monthly Revenue -> Wallet Tab */}
          <button
            type="button"
            onClick={() => onNavigateTab?.('wallet')}
            className="text-left relative overflow-hidden bg-card/80 hover:bg-card p-4 sm:p-5 rounded-2xl border border-gray-800 hover:border-emerald-500/50 group transition-all duration-200 shadow-sm hover:shadow-lg hover:shadow-emerald-950/20 cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-gray-400 uppercase font-black tracking-wider group-hover:text-emerald-400 transition-colors">
                Monthly Inflow
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
            </div>
            <div className="text-2xl font-black text-emerald-400 tracking-tight">
              {formatRupees(kpis?.monthlyRevenue ?? 0)}
            </div>
            <div className="text-[10px] text-gray-500 mt-1 font-semibold">
              Host earnings this month
            </div>
          </button>

          {/* Pending Payouts -> Wallet Tab */}
          <button
            type="button"
            onClick={() => onNavigateTab?.('wallet')}
            className="text-left relative overflow-hidden bg-card/80 hover:bg-card p-4 sm:p-5 rounded-2xl border border-gray-800 hover:border-red-500/50 group transition-all duration-200 shadow-sm hover:shadow-lg hover:shadow-red-950/20 cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-gray-400 uppercase font-black tracking-wider group-hover:text-red-400 transition-colors">
                Pending Payouts
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-red-400 group-hover:translate-x-0.5 transition-all" />
            </div>
            <div className="text-2xl font-black text-red-400 tracking-tight">
              {formatRupees(kpis?.pendingPayouts ?? 0)}
            </div>
            <div className="text-[10px] text-gray-500 mt-1 font-semibold">
              Click to review transfers
            </div>
          </button>
        </div>
      </div>

      {/* 2. Two-column Layout: Live Tournaments Data Table & Recent Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Live Tournaments Data Table */}
        <div className="lg:col-span-2 bg-card/80 border border-gray-800 rounded-2xl p-4 sm:p-6 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-tight">Tournaments Roster</h3>
              <p className="text-xs text-gray-400 mt-0.5">Quick status and registration metrics</p>
            </div>
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('tournaments')}
                className="text-xs font-bold text-brand-400 hover:text-brand-300 flex items-center gap-1 transition"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-[11px] text-gray-400 font-bold uppercase tracking-wider">
                  <th className="pb-3">Tournament</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Filled Slots</th>
                  <th className="pb-3 text-right">Prize Pool</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {hostedTournaments && hostedTournaments.length > 0 ? (
                  hostedTournaments.map((tournament, idx) => {
                    const current = getFilledSlotCount(tournament);
                    const max = getSlotCount(tournament);
                    return (
                      <tr
                        key={tournament.id || `tournament-${idx}`}
                        className="hover:bg-surface/50 transition-colors group"
                      >
                        <td className="py-3.5 pr-4">
                          <div className="font-bold text-white group-hover:text-brand-400 transition-colors">
                            {tournament.title || 'Untitled Tournament'}
                          </div>
                          {tournament.game && (
                            <div className="text-xs text-gray-500">
                              {tournament.game} • {tournament.format || 'Battle Royale'}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-2 whitespace-nowrap">
                          {renderStatusBadge(tournament.status)}
                        </td>
                        <td className="py-3.5 px-2 text-gray-300 font-mono text-xs whitespace-nowrap">
                          <span className="font-bold text-white">{current}</span>
                          <span className="text-gray-500">/{max}</span>
                        </td>
                        <td className="py-3.5 pl-2 text-right font-bold text-amber-400 whitespace-nowrap">
                          {formatRupees(tournament.prizePool || 0)}
                        </td>
                        <td className="py-3.5 pl-2 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onNavigateTab?.('tournaments')}
                            className="text-[11px] font-bold text-gray-400 hover:text-white px-2.5 py-1 rounded-lg bg-surface hover:bg-surface border border-gray-800 transition"
                          >
                            Manage
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-8 text-center text-xs text-gray-500"
                    >
                      No tournaments hosted yet. Click "Create Tournament" above to start!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Recent Activity Feed */}
        <div className="bg-card/80 border border-gray-800 rounded-2xl p-4 sm:p-6 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-tight">Recent Activity</h3>
              <p className="text-xs text-gray-400 mt-0.5">Latest events and actions</p>
            </div>
          </div>

          <div className="space-y-0">
            {activityFeed && activityFeed.length > 0 ? (
              activityFeed.map((item) => (
                <div
                  key={item.id}
                  className="py-2.5 border-b border-gray-800/60 last:border-b-0 flex items-start gap-3 hover:bg-surface/30 rounded-lg px-2 -mx-2 transition-colors"
                >
                  <div className="p-1.5 rounded-lg bg-surface/80 border border-gray-800 mt-0.5">
                    {renderIcon(item.icon)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white leading-snug font-medium">
                      {item.text}
                    </p>
                    <span className="text-[11px] text-gray-500 mt-0.5 block">
                      {item.time}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-gray-500">
                No recent activity.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewTab;
