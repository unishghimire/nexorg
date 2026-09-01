// ═══════════════════════════════════════════════════════════════
// QUALIFICATION PANEL — Preview + Publish flow
// Uses tournamentEngine.generateQualificationPreview() — no duplicate logic.
// ponytail: pure preview, admin confirms before publishing.
// ═══════════════════════════════════════════════════════════════

import { useState, useMemo } from 'react';
import { Tournament, TournamentGroup } from '../../../shared/types/types';
import {
    generateQualificationPreview,
    isRoundComplete,
    QualificationPreview,
} from '../../../shared/services/tournamentEngine';

interface Props {
    tournament: Tournament;
    onPublish: (preview: QualificationPreview) => void;
    onClose: () => void;
}

export function QualificationPanel({ tournament, onPublish, onClose }: Props) {
    const [publishing, setPublishing] = useState(false);

    const roundStatus = useMemo(() => {
        const groups = tournament.groups || [];
        return isRoundComplete({ groups, tournament });
    }, [tournament]);

    const preview = useMemo(() => {
        if (!roundStatus.complete) return null;
        const roundConfig = tournament.roadmap?.[((tournament.currentRound || 1) - 1)];
        return generateQualificationPreview({
            groups: tournament.groups || [],
            tournament,
            roundNumber: tournament.currentRound || 1,
            qualificationCount: roundConfig?.qualificationRule || 2,
            qualificationType: roundConfig?.qualificationType || 'top_n_per_group',
        });
    }, [tournament, roundStatus.complete]);

    if (!roundStatus.complete) {
        return (
            <div className="rounded-lg bg-card border border-gray-800 p-6">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Qualification</h3>
                <p className="text-gray-400 text-sm">
                    Cannot generate qualification preview — not all matches are complete.
                </p>
                <p className="text-gray-500 text-xs mt-1">
                    {roundStatus.completedMatches} / {roundStatus.totalMatches} matches completed
                </p>
                <div className="mt-3 w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full transition-colors"
                        style={{ width: `${roundStatus.totalMatches > 0 ? (roundStatus.completedMatches / roundStatus.totalMatches) * 100 : 0}%` }} />
                </div>
                <button type="button" onClick={onClose} className="mt-4 w-full py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium transition-colors min-h-[44px]">
                    Close
                </button>
            </div>
        );
    }

    if (!preview) return null;

    const hasTies = preview.tiesRequiringReview.length > 0;

    return (
        <div className="rounded-lg bg-card border border-gray-800 p-4 sm:p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Qualification Preview</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Round {preview.roundNumber} · {preview.totalQualified} qualified · {preview.totalEliminated} eliminated</p>
                </div>
                <button type="button" onClick={onClose} className="text-gray-500 hover:text-white text-sm">✕</button>
            </div>

            {hasTies && (
                <div className="mb-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-3">
                    <p className="text-yellow-400 text-xs font-bold mb-1">⚠ Tie Requires Admin Review</p>
                    <p className="text-yellow-400/70 text-xs">
                        Teams at the qualification cutoff have equal points: {preview.tiesRequiringReview.map(t => t.teamName).join(', ')}
                    </p>
                    <p className="text-yellow-400/70 text-xs mt-1">
                        Resolve ties manually before publishing, or adjust the qualification count.
                    </p>
                </div>
            )}

            {/* Groups with standings + qualification status */}
            <div className="space-y-4">
                {preview.groups.map((group) => (
                    <div key={group.groupId} className="rounded-lg bg-surface border border-gray-800 overflow-hidden">
                        <div className="px-3 py-2 bg-gray-900/50 border-b border-gray-800">
                            <p className="text-xs font-bold text-white">{group.groupName}</p>
                        </div>
                        <div className="divide-y divide-gray-800/50">
                            {group.standings.map((standing) => {
                                const isQualified = standing.qualificationStatus === 'qualified';
                                return (
                                    <div key={standing.teamId} className="flex items-center px-3 py-2 gap-2">
                                        <span className={`text-xs font-bold w-6 text-center ${standing.rank <= 3 ? 'text-brand-400' : 'text-gray-500'}`}>
                                            {standing.rank}
                                        </span>
                                        <span className="flex-1 text-xs text-white font-medium truncate">{standing.teamName}</span>
                                        <span className="text-[10px] text-gray-500 hidden sm:inline">{standing.kills} kills</span>
                                        <span className="text-xs font-bold text-white">{standing.totalPoints}</span>
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                            isQualified ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-700 text-gray-500'
                                        }`}>
                                            {isQualified ? 'QUAL' : 'ELIM'}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Summary + Publish */}
            <div className="mt-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="text-xs text-gray-400">
                    <span className="text-emerald-400 font-bold">{preview.totalQualified} qualified</span>
                    {' · '}
                    <span className="text-gray-500 font-bold">{preview.totalEliminated} eliminated</span>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <button type="button" onClick={onClose} className="flex-1 sm:flex-none py-2 px-4 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-xs font-medium transition-colors min-h-[44px]">
                        Cancel
                    </button>
                    <button
                        onClick={() => { setPublishing(true); onPublish(preview); }}
                        disabled={hasTies || publishing}
                        className="flex-1 sm:flex-none py-2 px-4 rounded-lg bg-brand-500 hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors min-h-[44px]"
                    >
                        {publishing ? 'Publishing...' : 'Publish Qualification'}
                    </button>
                </div>
            </div>
        </div>
    );
}
