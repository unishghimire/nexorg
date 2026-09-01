import React from 'react';
import {
  Trophy,
  Users,
  AlertTriangle,
  DollarSign,
  Radio,
  Shield,
  Activity,
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
}

const formatRupees = (amount: number = 0): string => {
  return `Rs. ${new Intl.NumberFormat('en-IN').format(amount)}`;
};

const renderIcon = (iconName: string) => {
  const normalized = (iconName || '').toLowerCase();
  if (normalized.includes('trophy')) {
    return <Trophy className="w-4 h-4 text-indigo-400 shrink-0" />;
  }
  if (normalized.includes('user')) {
    return <Users className="w-4 h-4 text-indigo-400 shrink-0" />;
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
    return <Shield className="w-4 h-4 text-indigo-400 shrink-0" />;
  }
  return <Activity className="w-4 h-4 text-indigo-400 shrink-0" />;
};

const renderStatusBadge = (status: string) => {
  const s = (status || '').toLowerCase();
  if (s === 'live') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Live
      </span>
    );
  }
  if (s === 'upcoming' || s === 'published' || s === 'draft') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-800/80 text-slate-300 border border-slate-700/60">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
        {s.charAt(0).toUpperCase() + s.slice(1)}
      </span>
    );
  }
  if (s === 'completed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-900 text-slate-400 border border-zinc-800">
        <span className="w-1.5 h-1.5 rounded-full bg-surface" />
        Completed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-800/80 text-slate-400 border border-slate-700/60">
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
}) => {
  return (
    <div className="space-y-6 text-sm p-2 sm:p-4">
      {/* Overview Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Overview</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Key metrics and real-time activity for your esports organization.
          </p>
        </div>
      </div>

      {/* 1. KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Active Tournaments */}
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-900/40 to-indigo-900/10 p-4 sm:p-5 rounded-2xl border border-indigo-500/20 group">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-colors" />
          <div className="text-[10px] text-indigo-200/70 uppercase font-bold tracking-wider mb-2">Active Tournaments</div>
          <div className="text-2xl font-black text-white tracking-tight">{kpis?.activeTournaments ?? 0}</div>
        </div>

        {/* Live Scrims */}
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-900/40 to-emerald-900/10 p-4 sm:p-5 rounded-2xl border border-emerald-500/20 group">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-colors" />
          <div className="flex items-center gap-1.5 text-[10px] text-emerald-200/70 uppercase font-bold tracking-wider mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live Scrims</span>
          </div>
          <div className="text-2xl font-black text-white tracking-tight">{kpis?.liveScrims ?? 0}</div>
        </div>

        {/* Total Teams */}
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-900/40 to-blue-900/10 p-4 sm:p-5 rounded-2xl border border-blue-500/20 group">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-colors" />
          <div className="text-[10px] text-blue-200/70 uppercase font-bold tracking-wider mb-2">Total Teams</div>
          <div className="text-2xl font-black text-white tracking-tight">{kpis?.totalTeams ?? 0}</div>
        </div>

        {/* Prize Pool */}
        <div className="relative overflow-hidden bg-gradient-to-br from-amber-900/40 to-amber-900/10 p-4 sm:p-5 rounded-2xl border border-amber-500/20 group">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-colors" />
          <div className="text-[10px] text-amber-200/70 uppercase font-bold tracking-wider mb-2">Prize Pool</div>
          <div className="text-2xl font-black text-white tracking-tight">{formatRupees(kpis?.prizePool ?? 0)}</div>
        </div>

        {/* Org Wallet */}
        <div className="relative overflow-hidden bg-gradient-to-br from-purple-900/40 to-purple-900/10 p-4 sm:p-5 rounded-2xl border border-purple-500/20 group">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-colors" />
          <div className="text-[10px] text-purple-200/70 uppercase font-bold tracking-wider mb-2">Org Wallet</div>
          <div className="text-2xl font-black text-white tracking-tight">{formatRupees(kpis?.orgWalletBalance ?? 0)}</div>
        </div>

        {/* Escrow Balance */}
        <div className="relative overflow-hidden bg-gradient-to-br from-cyan-900/40 to-cyan-900/10 p-4 sm:p-5 rounded-2xl border border-cyan-500/20 group">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-colors" />
          <div className="text-[10px] text-cyan-200/70 uppercase font-bold tracking-wider mb-2">Escrow Balance</div>
          <div className="text-2xl font-black text-white tracking-tight">{formatRupees(kpis?.escrowBalance ?? 0)}</div>
        </div>

        {/* Monthly Revenue */}
        <div className="relative overflow-hidden bg-gradient-to-br from-green-900/40 to-green-900/10 p-4 sm:p-5 rounded-2xl border border-green-500/20 group">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-green-500/10 rounded-full blur-2xl group-hover:bg-green-500/20 transition-colors" />
          <div className="text-[10px] text-green-200/70 uppercase font-bold tracking-wider mb-2">Monthly Revenue</div>
          <div className="text-2xl font-black text-white tracking-tight">{formatRupees(kpis?.monthlyRevenue ?? 0)}</div>
        </div>

        {/* Pending Payouts */}
        <div className="relative overflow-hidden bg-gradient-to-br from-red-900/40 to-red-900/10 p-4 sm:p-5 rounded-2xl border border-red-500/20 group">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-red-500/10 rounded-full blur-2xl group-hover:bg-red-500/20 transition-colors" />
          <div className="text-[10px] text-red-200/70 uppercase font-bold tracking-wider mb-2">Pending Payouts</div>
          <div className="text-2xl font-black text-white tracking-tight">{formatRupees(kpis?.pendingPayouts ?? 0)}</div>
        </div>
      </div>

      {/* 2. Two-column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (lg:col-span-2): Live Tournaments Data Table */}
        <div className="lg:col-span-2 bg-card border border-slate-800 rounded-2xl p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white">Live Tournaments</h3>
          </div>

          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
                  <th className="pb-3 font-medium">Tournament</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Teams</th>
                  <th className="pb-3 font-medium text-right">Prize Pool</th>
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
                        className="border-b border-slate-800 hover:bg-card/30 transition-colors"
                      >
                        <td className="py-3.5 pr-4">
                          <div className="font-medium text-white">
                            {tournament.title || 'Untitled Tournament'}
                          </div>
                          {tournament.game && (
                            <div className="text-xs text-slate-400">
                              {tournament.game}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-2 whitespace-nowrap">
                          {renderStatusBadge(tournament.status)}
                        </td>
                        <td className="py-3.5 px-2 text-slate-300 font-mono text-xs whitespace-nowrap">
                          {current}/{max}
                        </td>
                        <td className="py-3.5 pl-2 text-right font-medium text-white whitespace-nowrap">
                          {formatRupees(tournament.prizePool || 0)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-8 text-center text-xs text-slate-400"
                    >
                      No tournaments available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Recent Activity Feed */}
        <div className="bg-card border border-slate-800 rounded-2xl p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white">Recent Activity</h3>
          </div>

          <div className="divide-y divide-gray-800">
            {activityFeed && activityFeed.length > 0 ? (
              activityFeed.map((item) => (
                <div
                  key={item.id}
                  className="py-3 border-b border-slate-800 last:border-b-0 flex items-start gap-3"
                >
                  <div className="p-1.5 rounded-md bg-card border border-slate-800 mt-0.5">
                    {renderIcon(item.icon)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white leading-snug">
                      {item.text}
                    </p>
                    <span className="text-xs text-slate-400 mt-0.5 block">
                      {item.time}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
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
