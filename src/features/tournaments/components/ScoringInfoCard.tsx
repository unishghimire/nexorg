// ═══════════════════════════════════════════════════════════════
// ScoringInfoCard — shows tournament scoring config to participants
// ponytail: one component, used on details page + results page.
// Reads tournament.scoringSnapshot or falls back to pointSystem/FF defaults.
// ═══════════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import { Tournament } from '../../../shared/types/types';
import { Target, Trophy, Shield, Info } from 'lucide-react';
import { FREE_FIRE_DEFAULT_SCORING, GameScoringConfig } from '../../../shared/types/scoring';

interface ScoringInfoCardProps {
    tournament: Tournament;
    compact?: boolean;
}

function resolveScoring(tournament: Tournament): { config: GameScoringConfig; source: string } {
    // 1. Frozen snapshot from creation
    if (tournament.scoringSnapshot) {
        const snap = tournament.scoringSnapshot;
        return {
            config: {
                enabled: true,
                killPoints: snap.killPoints,
                placementPoints: snap.placementPoints,
                maxPlacement: snap.maxPlacement || 12,
                scoringVersion: snap.scoringVersion,
            },
            source: 'Tournament Scoring',
        };
    }
    // 2. Legacy pointSystem
    if (tournament.pointSystem) {
        const placementPoints: Record<string, number> = {};
        if (tournament.pointSystem.placementPoints) {
            for (const p of tournament.pointSystem.placementPoints) {
                placementPoints[String(p.rank)] = p.points;
            }
        }
        return {
            config: {
                enabled: true,
                killPoints: tournament.pointSystem.pointsPerKill ?? 1,
                placementPoints: Object.keys(placementPoints).length > 0
                    ? placementPoints
                    : FREE_FIRE_DEFAULT_SCORING.placementPoints,
                maxPlacement: Object.keys(placementPoints).length > 0
                    ? Math.max(...Object.keys(placementPoints).map(Number))
                    : 12,
                scoringVersion: 1,
            },
            source: 'Custom Points',
        };
    }
    // 3. FF defaults
    return {
        config: { ...FREE_FIRE_DEFAULT_SCORING, scoringVersion: 1 },
        source: 'Free Fire Default',
    };
}

export const ScoringInfoCard: React.FC<ScoringInfoCardProps> = ({ tournament, compact = false }) => {
    const { config, source } = useMemo(() => resolveScoring(tournament), [tournament]);

    // Build placement points table (sorted by position)
    const placements = useMemo(() => {
        return Object.entries(config.placementPoints)
            .map(([pos, pts]) => ({ pos: parseInt(pos), pts }))
            .sort((a, b) => a.pos - b.pos);
    }, [config]);

    // Top 3 + summary for compact mode
    const topPlacements = placements.slice(0, 3);
    const hasMore = placements.length > 3;

    if (compact) {
        return (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-brand-500" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scoring</span>
                    </div>
                    <span className="text-[9px] text-slate-600 font-bold uppercase">{source}</span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-center">
                        <p className="text-xl font-black text-white">{config.killPoints}</p>
                        <p className="text-[9px] text-slate-500 uppercase font-bold">Per Kill</p>
                    </div>
                    <div className="w-px h-8 bg-slate-800" />
                    <div className="text-center">
                        <p className="text-xl font-black text-white">{placements.length}</p>
                        <p className="text-[9px] text-slate-500 uppercase font-bold">Placements</p>
                    </div>
                    <div className="w-px h-8 bg-slate-800" />
                    <div className="flex gap-1.5">
                        {topPlacements.map(p => (
                            <div key={p.pos} className="text-center">
                                <p className={`text-sm font-black ${p.pos === 1 ? 'text-amber-400' : p.pos === 2 ? 'text-slate-300' : 'text-orange-400'}`}>
                                    {p.pts}
                                </p>
                                <p className="text-[8px] text-slate-600">#{p.pos}</p>
                            </div>
                        ))}
                        {hasMore && <span className="text-[10px] text-slate-600 self-center">…</span>}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 sm:mb-6">
                <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-brand-500/10 flex items-center justify-center">
                        <Target className="w-5 h-5 sm:w-6 sm:h-6 text-brand-500" />
                    </div>
                    <div>
                        <h3 className="text-white font-black text-sm sm:text-lg uppercase tracking-tight">Scoring System</h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase">{source}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 bg-brand-500/10 px-3 py-1.5 rounded-xl">
                    <Shield className="w-3.5 h-3.5 text-brand-500" />
                    <span className="text-[10px] text-brand-500 font-black uppercase">Auto-Calc</span>
                </div>
            </div>

            {/* Kill Points */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className="bg-slate-800/50 p-3 sm:p-4 rounded-xl border border-slate-800 text-center">
                    <Target className="w-5 h-5 sm:w-6 sm:h-6 text-red-400 mx-auto mb-2" />
                    <p className="text-2xl sm:text-3xl font-black text-white">{config.killPoints}</p>
                    <p className="text-[10px] text-slate-500 uppercase font-bold mt-1">Points Per Kill</p>
                </div>
                <div className="bg-slate-800/50 p-3 sm:p-4 rounded-xl border border-slate-800 text-center">
                    <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 mx-auto mb-2" />
                    <p className="text-2xl sm:text-3xl font-black text-white">{placements.length}</p>
                    <p className="text-[10px] text-slate-500 uppercase font-bold mt-1">Scored Placements</p>
                </div>
            </div>

            {/* Placement Points Table */}
            <div>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-3">Placement Points Table</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {placements.map(p => (
                        <div
                            key={p.pos}
                            className={`text-center p-2 sm:p-3 rounded-xl border transition ${
                                p.pos === 1
                                    ? 'bg-amber-500/10 border-amber-500/30'
                                    : p.pos === 2
                                    ? 'bg-slate-400/10 border-slate-400/30'
                                    : p.pos === 3
                                    ? 'bg-orange-500/10 border-orange-500/30'
                                    : 'bg-slate-800/30 border-slate-800'
                            }`}
                        >
                            <p className={`text-base sm:text-lg font-black ${
                                p.pos === 1 ? 'text-amber-400'
                                : p.pos === 2 ? 'text-slate-300'
                                : p.pos === 3 ? 'text-orange-400'
                                : 'text-white'
                            }`}>
                                {p.pts}
                            </p>
                            <p className="text-[9px] text-slate-500 font-bold mt-0.5">
                                {p.pos === 1 ? '1st' : p.pos === 2 ? '2nd' : p.pos === 3 ? '3rd' : `${p.pos}th`}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Formula explanation */}
            <div className="mt-4 sm:mt-6 flex items-start gap-2 bg-slate-800/30 border border-slate-800 p-3 rounded-xl">
                <Info className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                <p className="text-[11px] text-slate-400 leading-relaxed">
                    <span className="text-white font-bold">Total = Placement Points + (Kills × {config.killPoints})</span>
                    <br />
                    Example: 1st place with 5 kills = {config.placementPoints['1'] ?? 12} + (5 × {config.killPoints}) = {(config.placementPoints['1'] ?? 12) + 5 * config.killPoints} points
                </p>
            </div>
        </div>
    );
};

export default ScoringInfoCard;
