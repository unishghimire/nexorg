// ═══════════════════════════════════════════════════════════════
// PER-KILL LEADERBOARD
// Individual player + team leaderboards for PER_KILL_REWARD tournaments.
// ponytail: reuses perKillEngine aggregation functions, no duplicate logic.
// ═══════════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import { Tournament } from '../../../shared/types/types';
import { PlayerKillReward } from '../../../shared/types/per-kill';
import { buildPerKillLeaderboard, aggregateTeamRewards } from '../../../shared/services/perKillEngine';
import { Crown, Target, Trophy, Users } from 'lucide-react';
import { formatCurrency } from '../../../shared/utils/utils';

interface PerKillLeaderboardProps {
    tournament: Tournament;
}

export const PerKillLeaderboard: React.FC<PerKillLeaderboardProps> = ({ tournament }) => {
    const killRewards: PlayerKillReward[] = (tournament as any).killRewards || [];
    const currency = (tournament as any).rewardSnapshot?.currency || 'NPR';

    const playerLeaderboard = useMemo(() =>
        buildPerKillLeaderboard({ killRewards, sortBy: 'kills' }),
        [killRewards]
    );

    const teamLeaderboard = useMemo(() =>
        aggregateTeamRewards({ killRewards }),
        [killRewards]
    );

    if (killRewards.length === 0) {
        return (
            <div className="text-center py-12">
                <Target className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 font-medium">No kill results yet.</p>
                <p className="text-sm text-gray-500 mt-2">Results will appear after admin submits match data.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Individual Kill Leaderboard */}
            <div>
                <div className="flex items-center gap-2 mb-3">
                    <Crown className="w-4 h-4 text-yellow-500" />
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Kill Leaderboard</h3>
                </div>
                <div className="bg-surface rounded-2xl border border-gray-800 overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-800 bg-dark/30">
                                <th className="px-3 py-2 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest">Rank</th>
                                <th className="px-3 py-2 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest">Player</th>
                                <th className="px-3 py-2 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest hidden sm:table-cell">Team</th>
                                <th className="px-3 py-2 text-right text-[10px] font-black text-gray-500 uppercase tracking-widest">Kills</th>
                                <th className="px-3 py-2 text-right text-[10px] font-black text-gray-500 uppercase tracking-widest">Reward</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/50">
                            {playerLeaderboard.slice(0, 20).map((entry) => (
                                <tr key={entry.playerId} className={`hover:bg-dark/30 transition ${entry.rank <= 3 ? 'bg-brand-600/5' : ''}`}>
                                    <td className="px-3 py-2.5">
                                        <span className={`text-xs font-black ${entry.rank === 1 ? 'text-yellow-500' : entry.rank === 2 ? 'text-gray-400' : entry.rank === 3 ? 'text-orange-500' : 'text-gray-500'}`}>
                                            {entry.rank}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2.5">
                                        <span className="text-xs font-bold text-white truncate block max-w-[120px]">{entry.playerName}</span>
                                    </td>
                                    <td className="px-3 py-2.5 hidden sm:table-cell">
                                        <span className="text-xs text-gray-400 truncate block max-w-[100px]">{entry.teamName || '-'}</span>
                                    </td>
                                    <td className="px-3 py-2.5 text-right">
                                        <span className="text-xs font-black text-brand-400">{entry.kills}</span>
                                    </td>
                                    <td className="px-3 py-2.5 text-right">
                                        <span className="text-xs font-black text-white">{formatCurrency(entry.reward)} {entry.currency}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Team Leaderboard — only for Duo/Squad */}
            {tournament.teamType !== 'solo' && teamLeaderboard.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <Users className="w-4 h-4 text-brand-500" />
                        <h3 className="text-sm font-black text-white uppercase tracking-widest">Team Leaderboard</h3>
                    </div>
                    <div className="bg-surface rounded-2xl border border-gray-800 overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-800 bg-dark/30">
                                    <th className="px-3 py-2 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest">Rank</th>
                                    <th className="px-3 py-2 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest">Team</th>
                                    <th className="px-3 py-2 text-right text-[10px] font-black text-gray-500 uppercase tracking-widest">Kills</th>
                                    <th className="px-3 py-2 text-right text-[10px] font-black text-gray-500 uppercase tracking-widest">Reward</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/50">
                                {teamLeaderboard.map((team, i) => (
                                    <tr key={team.teamId} className={`hover:bg-dark/30 transition ${i === 0 ? 'bg-brand-600/5' : ''}`}>
                                        <td className="px-3 py-2.5">
                                            <span className={`text-xs font-black ${i === 0 ? 'text-yellow-500' : 'text-gray-500'}`}>{i + 1}</span>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <span className="text-xs font-bold text-white">{team.teamName}</span>
                                        </td>
                                        <td className="px-3 py-2.5 text-right">
                                            <span className="text-xs font-black text-brand-400">{team.totalKills}</span>
                                        </td>
                                        <td className="px-3 py-2.5 text-right">
                                            <span className="text-xs font-black text-white">{formatCurrency(team.totalReward)} {currency}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PerKillLeaderboard;
