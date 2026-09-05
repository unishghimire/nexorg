// ═══════════════════════════════════════════════════════════════
// PER-KILL RESULT UPLOADER
// Individual player kill entry for PER_KILL_REWARD tournaments.
// Different from ResultUploader: collects per-player kills, not just team totals.
// ponytail: reuses scoring engine patterns, no duplicate team systems.
// ═══════════════════════════════════════════════════════════════

import React, { useState, useMemo } from 'react';
import { Tournament, TournamentGroup, Match, Team } from '../../../shared/types/types';
import { Target, Shield, AlertTriangle, CheckCircle2, Users, ChevronDown } from 'lucide-react';
import Modal from '../../../shared/components/Modal';
import { useNotification } from '../../../shared/context/NotificationContext';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../../../shared/config/firebase';
import { validateKills, calculatePlayerReward, createKillRewardEntry } from '../../../shared/services/perKillEngine';
import { PlayerKillReward, RewardSnapshot } from '../../../shared/types/per-kill';
import { cleanFirestoreData } from '../../../shared/utils/utils';

interface PerKillResultUploaderProps {
    isOpen: boolean;
    onClose: () => void;
    tournament: Tournament;
    group: TournamentGroup;
    match: Match;
    onSuccess: () => void;
}

interface PlayerKillEntry {
    teamId: string;
    teamName: string;
    playerId: string;
    playerName: string;
    kills: number;
    killsInput: string;
    error?: string;
}

export const PerKillResultUploader: React.FC<PerKillResultUploaderProps> = ({
    isOpen, onClose, tournament, group, match, onSuccess
}) => {
    const { showToast } = useNotification();
    const [loading, setLoading] = useState(false);
    const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
    const [screenshot, setScreenshot] = useState<File | null>(null);

    const rewardConfig: RewardSnapshot | undefined = (tournament as any).rewardSnapshot;

    // Build player entries from group teams
    // ponytail: for SOLO, each team has 1 player (the owner). For DUO/SQUAD, we need team player lists.
    // Team.players is string[] of user IDs. We fetch player names from team data.
    const playerEntries = useMemo<PlayerKillEntry[]>(() => {
        const entries: PlayerKillEntry[] = [];

        for (const team of group.teams) {
            const playerIds = team.players || [];
            const playerNames = (team as any).playerNames || playerIds.map((id, i) => `Player ${i + 1}`);

            if (playerIds.length === 0) {
                // Fallback: use team owner as solo player
                entries.push({
                    teamId: team.id,
                    teamName: team.name,
                    playerId: team.ownerId || team.id,
                    playerName: team.name,
                    kills: 0,
                    killsInput: '',
                });
            } else {
                playerIds.forEach((pid, i) => {
                    entries.push({
                        teamId: team.id,
                        teamName: team.name,
                        playerId: pid,
                        playerName: playerNames[i] || `Player ${i + 1}`,
                        kills: 0,
                        killsInput: '',
                    });
                });
            }
        }
        return entries;
    }, [group]);

    const [killData, setKillData] = useState<PlayerKillEntry[]>(playerEntries);

    // Validate all entries
    const validation = useMemo(() => {
        const errors: string[] = [];
        let totalKills = 0;

        for (const entry of killData) {
            if (entry.killsInput === '') continue; // Not submitted = 0

            const result = validateKills(parseInt(entry.killsInput));
            if (!result.valid && entry.killsInput !== '') {
                errors.push(`${entry.playerName}: ${result.errors[0]}`);
            }
            totalKills += result.valid ? result.value : 0;
        }

        return { errors, totalKills, valid: errors.length === 0 };
    }, [killData]);

    // Calculate live reward preview
    const rewardPreview = useMemo(() => {
        if (!rewardConfig) return [];

        return killData.map(entry => {
            const kills = entry.killsInput === '' ? 0 : (validateKills(parseInt(entry.killsInput)).valid ? parseInt(entry.killsInput) : 0);
            const { rewardAmount } = calculatePlayerReward({
                verifiedKills: kills,
                rewardPerKill: rewardConfig.rewardPerKill,
                minimumKillsForReward: rewardConfig.minimumKillsForReward,
                maximumRewardPerMatch: rewardConfig.maximumRewardPerMatch,
            });
            return { ...entry, kills, reward: rewardAmount };
        });
    }, [killData, rewardConfig]);

    // Group by team for display
    const teamGroups = useMemo(() => {
        const map: Record<string, { teamName: string; players: PlayerKillEntry[] }> = {};
        for (const entry of killData) {
            if (!map[entry.teamId]) map[entry.teamId] = { teamName: entry.teamName, players: [] };
            map[entry.teamId].players.push(entry);
        }
        return map;
    }, [killData]);

    const handleKillChange = (index: number, value: string) => {
        setKillData(prev => prev.map((e, i) => i === index ? { ...e, killsInput: value } : e));
    };

    const handleSubmit = async () => {
        if (!rewardConfig) {
            showToast('No reward configuration found for this tournament', 'error');
            return;
        }
        if (!validation.valid) {
            showToast(`Invalid kill data: ${validation.errors[0]}`, 'error');
            return;
        }

        setLoading(true);
        try {
            const user = auth.currentUser;
            if (!user) return;

            // Build kill reward entries — only for players with non-empty kill input
            const killRewards: PlayerKillReward[] = killData
                .filter(e => e.killsInput !== '' && validateKills(parseInt(e.killsInput)).valid)
                .map(entry => createKillRewardEntry({
                    tournamentId: tournament.id,
                    groupId: group.id,
                    matchId: match.id,
                    teamId: entry.teamId,
                    playerId: entry.playerId,
                    playerName: entry.playerName,
                    submittedKills: parseInt(entry.killsInput),
                    rewardPerKill: rewardConfig.rewardPerKill,
                    currency: rewardConfig.currency,
                    minimumKillsForReward: rewardConfig.minimumKillsForReward,
                    maximumRewardPerMatch: rewardConfig.maximumRewardPerMatch,
                }));

            // Save to tournament document — append to killRewards array
            const tournamentRef = doc(db, 'tournaments', tournament.id);
            await updateDoc(tournamentRef, cleanFirestoreData({
                killRewards: arrayUnion(...killRewards),
                updatedAt: new Date() as any,
            }));

            // Also update the match with results
            const matchResults = killRewards.map(r => ({
                teamId: r.teamId,
                teamName: r.playerName,
                kills: r.submittedKills,
                placement: 0, // Not applicable in per-kill mode
                totalPoints: 0, // Not applicable
            }));

            // Update the match in the group
            const updatedGroups = tournament.groups?.map(g => {
                if (g.id !== group.id) return g;
                return {
                    ...g,
                    matches: g.matches.map(m => {
                        if (m.id !== match.id) return m;
                        return { ...m, results: matchResults as any, status: 'completed' as const };
                    }),
                };
            });

            await updateDoc(tournamentRef, cleanFirestoreData({ groups: updatedGroups }));

            showToast('Kill results submitted for verification', 'success');
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error submitting kill results:', error);
            showToast('Failed to submit kill results', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Flatten killData for the table view
    let flatIndex = 0;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Per-Kill Result Entry">
            <div className="space-y-4 sm:space-y-6">
                {/* Header — reward info */}
                <div className="bg-brand-600/10 border border-brand-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Target className="w-5 h-5 text-brand-500" />
                        <h3 className="text-sm font-black text-white uppercase tracking-widest">Per-Kill Reward Mode</h3>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div>
                            <span className="text-gray-500 uppercase font-bold block">Reward/Kill</span>
                            <span className="text-white font-black">{rewardConfig?.rewardPerKill} {rewardConfig?.currency}</span>
                        </div>
                        <div>
                            <span className="text-gray-500 uppercase font-bold block">Min Kills</span>
                            <span className="text-white font-black">{rewardConfig?.minimumKillsForReward ?? 0}</span>
                        </div>
                        <div>
                            <span className="text-gray-500 uppercase font-bold block">Total Players</span>
                            <span className="text-white font-black">{killData.length}</span>
                        </div>
                        <div>
                            <span className="text-gray-500 uppercase font-bold block">Total Kills</span>
                            <span className="text-brand-400 font-black">{validation.totalKills}</span>
                        </div>
                    </div>
                </div>

                {/* Validation errors */}
                {validation.errors.length > 0 && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                        <div className="text-xs text-red-400 space-y-1">
                            {validation.errors.map((err, i) => <p key={i}>{err}</p>)}
                        </div>
                    </div>
                )}

                {/* Team-by-team player kill entry */}
                <div className="space-y-3">
                    {Object.entries(teamGroups).map(([teamId, teamData]) => {
                        const isExpanded = expandedTeam === teamId || teamData.players.length === 1;
                        return (
                            <div key={teamId} className="bg-surface rounded-xl border border-gray-800 overflow-hidden">
                                <button
                                    onClick={() => setExpandedTeam(isExpanded ? null : teamId)}
                                    className="w-full flex items-center justify-between p-3 hover:bg-dark/50 transition"
                                >
                                    <div className="flex items-center gap-2">
                                        <Users className="w-4 h-4 text-brand-500" />
                                        <span className="text-sm font-black text-white uppercase tracking-tight">{teamData.teamName}</span>
                                        <span className="text-[10px] text-gray-500">({teamData.players.length} player{teamData.players.length > 1 ? 's' : ''})</span>
                                    </div>
                                    {teamData.players.length > 1 && (
                                        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                    )}
                                </button>
                                {isExpanded && (
                                    <div className="border-t border-gray-800 divide-y divide-gray-800/50">
                                        {teamData.players.map((player) => {
                                            const allIdx = killData.findIndex(e => e.playerId === player.playerId && e.teamId === player.teamId);
                                            const preview = rewardPreview[allIdx];
                                            return (
                                                <div key={player.playerId} className="grid grid-cols-12 gap-2 items-center p-3">
                                                    <div className="col-span-5 sm:col-span-4">
                                                        <span className="text-xs font-bold text-white truncate block">{player.playerName}</span>
                                                    </div>
                                                    <div className="col-span-4 sm:col-span-3">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={player.killsInput}
                                                            onChange={(e) => handleKillChange(allIdx, e.target.value)}
                                                            placeholder="0"
                                                            className="w-full bg-dark border border-gray-800 rounded-lg px-3 py-2 text-white text-center text-sm font-bold focus:border-brand-500 focus-visible:outline-none transition"
                                                        />
                                                    </div>
                                                    <div className="col-span-3 sm:col-span-2 text-center">
                                                        <span className="text-[10px] text-gray-500 uppercase font-bold block">Kills</span>
                                                    </div>
                                                    <div className="col-span-12 sm:col-span-3 text-right">
                                                        <span className="text-[10px] text-gray-500 uppercase font-bold block">Reward</span>
                                                        <span className="text-sm font-black text-brand-400">
                                                            {preview ? `${preview.reward} ${rewardConfig?.currency}` : `0 ${rewardConfig?.currency}`}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {/* Team subtotal */}
                                        <div className="bg-dark/30 px-3 py-2 flex justify-between items-center">
                                            <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Team Total</span>
                                            <span className="text-sm font-black text-white">
                                                {teamData.players.reduce((sum, p) => {
                                                    const idx = killData.findIndex(e => e.playerId === p.playerId && e.teamId === p.teamId);
                                                    const pv = rewardPreview[idx];
                                                    return sum + (pv?.reward || 0);
                                                }, 0)} {rewardConfig?.currency}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Info note */}
                <div className="flex items-start gap-2 text-[10px] text-gray-500">
                    <Shield className="w-3 h-3 shrink-0 mt-0.5" />
                    <p>
                        Results are submitted as <span className="text-gray-400">pending verification</span>.
                        Rewards are calculated only after admin verifies the kills. No money is released until verification is complete.
                    </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 bg-dark border border-gray-800 rounded-xl text-xs font-black uppercase tracking-widest text-gray-400 hover:text-white transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !validation.valid}
                        className="flex-1 py-3 bg-brand-600 hover:bg-brand-500 rounded-xl text-xs font-black uppercase tracking-widest text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Submitting...' : 'Submit for Verification'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default PerKillResultUploader;
