import React from 'react';
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
} from 'lucide-react';
import { Tournament } from '../../../shared/types/types';
import { getSlotCount, getFilledSlotCount } from '../../../shared/utils/scrimSlots';

export interface OverviewTabProps {
  kpis: {
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
  activityFeed: {
    id: string;
    icon: string;
    text: string;
    time: string;
    type: string;
  }[];
  hostedTournaments: Tournament[] | any[];
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
  onNavigateTab,
  onCreateTournament,
  onCreateScrim,
}) => {
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
              className="px-3.5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-1.5 shadow-md shadow-brand-950/40"
            >
              <Plus className="w-3.5 h-3.5" /> Create Tournament
            </button>
          )}
          {onCreateScrim && (
            <button
              type="button"
              onClick={onCreateScrim}
              className="px-3.5 py-2 bg-surface hover:bg-surface text-gray-200 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider border border-gray-700 transition flex items-center gap-1.5"
            >
              <Gamepad2 className="w-3.5 h-3.5 text-orange-400" /> Schedule Scrim
            </button>
          )}
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
