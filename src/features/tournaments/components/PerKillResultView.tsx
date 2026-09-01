// ═══════════════════════════════════════════════════════════════
// PER-KILL RESULT VIEW
// Public-facing result display for PER_KILL_REWARD tournaments.
// Shows: Player | Kills | Reward/Kill | Total Reward | Verification Status
// ponytail: reuses perKillEngine aggregation, no duplicate logic.
// ═══════════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import { Tournament } from '../../../shared/types/types';
import { PlayerKillReward } from '../../../shared/types/per-kill';
import { aggregateTeamRewards, buildPerKillSummary, buildFinancialBreakdown } from '../../../shared/services/perKillEngine';
import { Target, Trophy, Users, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../../../shared/utils/utils';

interface PerKillResultViewProps {
    tournament: Tournament;
}

export const PerKillResultView: React.FC<PerKillResultViewProps> = ({ tournament }) => {
    const killRewards: PlayerKillReward[] = (tournament as any).killRewards || [];
    const rewardConfig = (tournament as any).rewardSnapshot;
    const currency = rewardConfig?.currency || 'NPR';

    const summary = useMemo(() =>
        buildPerKillSummary({ killRewards, totalParticipants: tournament.currentPlayers, totalMatches: 1 }),
        [killRewards, tournament]
    );

    const breakdown = useMemo(() =>
        buildFinancialBreakdown({ killRewards }),
        [killRewards]
    );

    const teamSummaries = useMemo(() =>
        aggregateTeamRewards({ killRewards }),
        [killRewards]
    );

    if (killRewards.length === 0) {
        return (
            <div className="text-center py-12">
                <Target className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 font-medium">No results yet.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-surface rounded-xl border border-gray-800 p-4">
                    <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest block mb-1">Verified Kills</span>
                    <span className="text-xl font-black text-brand-400">{summary.totalVerifiedKills}</span>
                </div>
                <div className="bg-surface rounded-xl border border-gray-800 p-4">
                    <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest block mb-1">Total Rewards</span>
                    <span className="text-xl font-black text-white">{formatCurrency(summary.totalRewardsGenerated)} {currency}</span>
                </div>
                <div className="bg-surface rounded-xl border border-gray-800 p-4">
                    <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest block mb-1">Reward/Kill</span>
                    <span className="text-xl font-black text-white">{rewardConfig?.rewardPerKill} {currency}</span>
                </div>
                <div className="bg-surface rounded-xl border border-gray-800 p-4">
                    <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest block mb-1">Participants</span>
                    <span className="text-xl font-black text-white">{summary.totalParticipants}</span>
                </div>
            </div>

            {/* Top Killer */}
            {summary.topKiller && (
                <div className="bg-gradient-to-r from-yellow-500/10 to-transparent border border-yellow-500/20 rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center shrink-0">
                        <Trophy className="w-6 h-6 text-yellow-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <span className="text-[10px] text-yellow-500 uppercase font-black tracking-widest block">Top Killer</span>
                        <span className="text-lg font-black text-white truncate block">{summary.topKiller.playerName}</span>
                    </div>
                    <div className="text-right shrink-0">
                        <span className="text-2xl font-black text-yellow-500 block">{summary.topKiller.kills}</span>
                        <span className="text-[10px] text-gray-500 uppercase">kills</span>
                    </div>
                </div>
            )}

            {/* Financial Breakdown */}
            <div className="bg-surface rounded-2xl border border-gray-800 p-4">
                <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Earnings Breakdown</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <div>
                            <span className="text-[10px] text-gray-500 uppercase block">Verified</span>
                            <span className="text-sm font-black text-green-500">{formatCurrency(breakdown.verified)} {currency}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-yellow-500" />
                        <div>
                            <span className="text-[10px] text-gray-500 uppercase block">Pending</span>
                            <span className="text-sm font-black text-yellow-500">{formatCurrency(breakdown.pendingApproval)} {currency}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-blue-500" />
                        <div>
                            <span className="text-[10px] text-gray-500 uppercase block">Approved</span>
                            <span className="text-sm font-black text-blue-500">{formatCurrency(breakdown.approved)} {currency}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-brand-500" />
                        <div>
                            <span className="text-[10px] text-gray-500 uppercase block">Paid</span>
                            <span className="text-sm font-black text-brand-500">{formatCurrency(breakdown.paid)} {currency}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Team-by-team results */}
            <div className="space-y-4">
                {teamSummaries.map(team => (
                    <div key={team.teamId} className="bg-surface rounded-2xl border border-gray-800 overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-dark/30">
                            <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-brand-500" />
                                <h3 className="text-sm font-black text-white uppercase tracking-tight">{team.teamName}</h3>
                            </div>
                            <div className="flex gap-4 text-xs">
                                <div>
                                    <span className="text-gray-500 uppercase font-bold block text-[10px]">Kills</span>
                                    <span className="text-brand-400 font-black">{team.totalKills}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500 uppercase font-bold block text-[10px]">Reward</span>
                                    <span className="text-white font-black">{formatCurrency(team.totalReward)} {currency}</span>
                                </div>
                            </div>
                        </div>
                        <div className="divide-y divide-gray-800/50">
                            {team.playerBreakdown.map(player => (
                                <div key={player.playerId} className="grid grid-cols-12 gap-2 items-center px-4 py-3">
                                    <div className="col-span-5">
                                        <span className="text-xs font-bold text-white truncate block">{player.playerName}</span>
                                    </div>
                                    <div className="col-span-2 text-center">
                                        <span className="text-[10px] text-gray-500 uppercase block">Kills</span>
                                        <span className="text-xs font-black text-brand-400">{player.kills}</span>
                                    </div>
                                    <div className="col-span-2 text-center hidden sm:block">
                                        <span className="text-[10px] text-gray-500 uppercase block">Per Kill</span>
                                        <span className="text-xs text-gray-400">{rewardConfig?.rewardPerKill} {currency}</span>
                                    </div>
                                    <div className="col-span-5 sm:col-span-3 text-right">
                                        <span className="text-sm font-black text-white">{formatCurrency(player.reward)} {currency}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PerKillResultView;
