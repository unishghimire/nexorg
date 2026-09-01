// ═══════════════════════════════════════════════════════════════
// TOURNAMENT ROADMAP — Simple 4-stage visual: Register → Groups → Play → Finals
// ponytail: collapse 8-12 micro-stages into 4 that users actually understand.
// ═══════════════════════════════════════════════════════════════

import { Tournament } from '../../../shared/types/types';
import { computeTournamentProgress } from '../../../shared/services/tournamentEngine';

interface Props {
    tournament: Tournament;
    compact?: boolean;
}

// Simple stage type — no imports needed
type SimpleStatus = 'done' | 'active' | 'todo';

interface SimpleStage {
    label: string;
    sublabel?: string;
    status: SimpleStatus;
}

export function TournamentRoadmap({ tournament, compact = false }: Props) {
    const progress = computeTournamentProgress(tournament);

    // Derive 4 simple stages from tournament state
    const stage = (tournament.stage as string) || '';
    const hasGroups = (tournament.groups || []).length > 0;
    const isCompleted = tournament.status === 'completed';
    const currentRound = tournament.currentRound || 0;
    const roadmap = tournament.roadmap || [];
    const totalRounds = roadmap.length;

    // Count completed matches across all groups
    const allGroups = tournament.groups || [];
    const totalMatches = allGroups.reduce((sum, g) => sum + g.matches.length, 0);
    const completedMatches = allGroups.reduce(
        (sum, g) => sum + g.matches.filter(m => m.status === 'completed').length, 0
    );

    const stages: SimpleStage[] = [
        {
            label: 'Register',
            sublabel: `${tournament.currentPlayers || 0} players`,
            status: stage === 'registration' || (!stage && tournament.status === 'upcoming')
                ? 'active'
                : stage && stage !== 'registration' ? 'done' : 'todo',
        },
        {
            label: 'Groups',
            sublabel: hasGroups ? `${allGroups.length} groups` : undefined,
            status: hasGroups && (stage === 'group_stage' || stage === 'knockout' || currentRound > 0)
                ? 'done'
                : stage === 'group_stage' || (hasGroups && currentRound === 0)
                    ? 'active'
                    : 'todo',
        },
        {
            label: totalRounds > 1 ? `Play (${currentRound}/${totalRounds})` : 'Play',
            sublabel: totalMatches > 0 ? `${completedMatches}/${totalMatches} matches` : undefined,
            status: isCompleted
                ? 'done'
                : currentRound > 0 || stage === 'knockout'
                    ? 'active'
                    : 'todo',
        },
        {
            label: 'Finals',
            sublabel: isCompleted ? 'Champion crowned' : undefined,
            status: isCompleted ? 'done' : 'todo',
        },
    ];

    const statusStyle: Record<SimpleStatus, { dot: string; ring: string; text: string; bg: string; line: string }> = {
        done:   { dot: 'bg-emerald-500', ring: 'border-emerald-500/40', text: 'text-emerald-400', bg: 'bg-card', line: 'bg-emerald-500' },
        active: { dot: 'bg-brand-500 animate-pulse', ring: 'border-brand-500/60', text: 'text-brand-400', bg: 'bg-card', line: 'bg-brand-500' },
        todo:   { dot: 'bg-gray-700', ring: 'border-gray-800', text: 'text-gray-500', bg: 'bg-card', line: 'bg-gray-800' },
    };

    return (
        <div className="w-full">
            {/* Header with progress bar */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Roadmap</h3>
                <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-500 rounded-full transition-colors duration-500" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="text-xs font-bold text-gray-400">{progress}%</span>
                </div>
            </div>

            {/* 4-stage flow — horizontal on desktop, vertical on mobile */}
            <div className="flex flex-col sm:flex-row sm:items-stretch gap-1 sm:gap-0">
                {stages.map((s, i) => {
                    const style = statusStyle[s.status];
                    const isLast = i === stages.length - 1;

                    return (
                        <div key={i} className="flex items-center sm:flex-1">
                            {/* Stage pill */}
                            <div className={`flex-1 rounded-lg border ${style.ring} ${style.bg} px-3 py-2.5 transition-colors`}>
                                <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                                    <div className="min-w-0">
                                        <p className={`text-xs font-bold truncate ${s.status === 'todo' ? 'text-gray-500' : 'text-white'}`}>
                                            {s.label}
                                        </p>
                                        {s.sublabel && !compact && (
                                            <p className={`text-[10px] truncate ${style.text}`}>{s.sublabel}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Connector line — desktop only */}
                            {!isLast && (
                                <div className={`hidden sm:block h-0.5 w-3 xl:w-5 shrink-0 ${style.line}`} />
                            )}
                            {/* Arrow — mobile only */}
                            {!isLast && (
                                <div className="sm:hidden text-gray-700 text-[10px] px-2 py-1">↓</div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
