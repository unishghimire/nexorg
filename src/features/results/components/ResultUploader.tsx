// ═══════════════════════════════════════════════════════════════
// RESULT UPPLIER (v2) — uses scoring engine for auto-calculation
// ponytail: replaces inline pointSystem math with scoringEngine calls.
// Falls back: tournament.scoringSnapshot → tournament.pointSystem → FF defaults.
// ═══════════════════════════════════════════════════════════════

import React, { useState, useMemo, useCallback } from 'react';
import { Tournament, TournamentGroup, Match, TeamMatchResult } from '../../../shared/types/types';
import { Camera, Shield, AlertTriangle, Trophy, Hash, Target, CheckCircle2 } from 'lucide-react';
import Modal from '../../../shared/components/Modal';
import { useNotification } from '../../../shared/context/NotificationContext';
import { doc, updateDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db, auth } from '../../../shared/config/firebase';
import { calculateTeamScore, validateResult } from '../../../shared/services/scoringEngine';
import { GameScoringConfig, FREE_FIRE_DEFAULT_SCORING, TournamentScoringSnapshot } from '../../../shared/types/scoring';
import { uploadImage, MediaCategory } from '../../../shared/services/mediaService';

interface ResultUploaderProps {
    isOpen: boolean;
    onClose: () => void;
    tournament: Tournament;
    group: TournamentGroup;
    match: Match;
    onSuccess: () => void;
}

// Convert legacy PointRule to GameScoringConfig format
function pointRuleToScoringConfig(pointSystem: any): GameScoringConfig {
    const placementPoints: Record<string, number> = {};
    if (pointSystem?.placementPoints) {
        for (const p of pointSystem.placementPoints) {
            placementPoints[String(p.rank)] = p.points;
        }
    }
    return {
        enabled: true,
        killPoints: pointSystem?.pointsPerKill ?? 1,
        placementPoints,
        maxPlacement: Object.keys(placementPoints).length > 0
            ? Math.max(...Object.keys(placementPoints).map(Number))
            : 12,
        scoringVersion: 1,
    };
}

export const ResultUploader: React.FC<ResultUploaderProps> = ({ isOpen, onClose, tournament, group, match, onSuccess }) => {
    const { showToast } = useNotification();
    const [loading, setLoading] = useState(false);
    const [screenshot, setScreenshot] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [results, setResults] = useState<TeamMatchResult[]>(
        group.teams.map(t => ({
            teamId: t.id,
            teamName: t.name,
            kills: 0,
            placement: 1,
            totalPoints: 0
        }))
    );

    // Resolve which scoring config to use — cascade: snapshot → pointSystem → FF defaults
    const scoringConfig: GameScoringConfig = useMemo(() => {
        // 1. Tournament scoring snapshot (frozen at creation)
        if ((tournament as any).scoringSnapshot) {
            const snap = (tournament as any).scoringSnapshot as TournamentScoringSnapshot;
            return {
                enabled: true,
                killPoints: snap.killPoints,
                placementPoints: snap.placementPoints,
                maxPlacement: snap.maxPlacement || 12,
                scoringVersion: snap.scoringVersion,
            };
        }
        // 2. Legacy tournament.pointSystem
        if (tournament.pointSystem) {
            return pointRuleToScoringConfig(tournament.pointSystem);
        }
        // 3. Free Fire defaults
        return { ...FREE_FIRE_DEFAULT_SCORING, scoringVersion: 1 };
    }, [tournament]);

    const scoringSource = useMemo(() => {
        if ((tournament as any).scoringSnapshot) return 'Tournament Snapshot';
        if (tournament.pointSystem) return 'Custom Point System';
        return 'Free Fire Default';
    }, [tournament]);

    // Live recompute all results when scoring config or any input changes
    const scoredResults = useMemo(() => {
        return results.map(r => {
            const scored = calculateTeamScore({
                position: r.placement,
                kills: r.kills,
                scoring: scoringConfig,
            });
            return {
                ...r,
                totalPoints: scored.totalPoints,
                placementPoints: scored.placementPoints,
                killPoints: scored.killPoints,
            };
        });
    }, [results, scoringConfig]);

    // Sort by totalPoints desc for live standings preview
    const standings = useMemo(() => {
        return [...scoredResults].sort((a, b) => {
            if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
            if (b.killPoints !== a.killPoints) return b.killPoints - a.killPoints;
            return a.placement - b.placement;
        });
    }, [scoredResults]);

    // Check for duplicate placements
    const placementErrors = useMemo(() => {
        const seen = new Map<number, string[]>();
        scoredResults.forEach(r => {
            const existing = seen.get(r.placement) || [];
            existing.push(r.teamName);
            seen.set(r.placement, existing);
        });
        const dupes: string[] = [];
        seen.forEach((teams, pos) => {
            if (teams.length > 1) dupes.push(`Position ${pos}: ${teams.join(', ')}`);
        });
        return dupes;
    }, [scoredResults]);

    // Validate a single result entry
    const validateEntry = useCallback((placement: number, kills: number) => {
        return validateResult({
            position: placement,
            kills,
            maxPlacement: scoringConfig.maxPlacement,
        });
    }, [scoringConfig]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setScreenshot(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleUpdateResult = (teamId: string, field: 'kills' | 'placement', value: number) => {
        setResults(prev => prev.map(r => {
            if (r.teamId === teamId) {
                return { ...r, [field]: value };
            }
            return r;
        }));
    };

    const handleSubmit = async () => {
        // Validate all entries
        for (const r of scoredResults) {
            const v = validateEntry(r.placement, r.kills);
            if (!v.valid) {
                showToast(`${r.teamName}: ${v.errors[0]}`, 'error');
                return;
            }
        }
        if (placementErrors.length > 0) {
            showToast('Duplicate placements detected — fix before submitting', 'error');
            return;
        }

        if (!screenshot && !window.confirm("Continue without screenshot proof?")) {
            return;
        }

        setLoading(true);
        try {
            let screenshotUrl = '';
            if (screenshot) {
                try {
                    const uploadRes = await uploadImage(screenshot, MediaCategory.OTHER);
                    if (uploadRes.success && uploadRes.url) {
                        screenshotUrl = uploadRes.url;
                    } else {
                        console.warn("Screenshot upload warning:", uploadRes.error);
                    }
                } catch (err) {
                    console.error("Error uploading screenshot to ImgBB:", err);
                }
            }

            const tournamentRef = doc(db, 'tournaments', tournament.id);

            const updatedGroups = tournament.groups?.map(g => {
                if (g.id === group.id) {
                    return {
                        ...g,
                        matches: g.matches.map(m => {
                            if (m.id === match.id) {
                                return {
                                    ...m,
                                    status: 'completed' as const,
                                    // FIX: Store full ScoredResult with placementPoints + killPoints breakdown
                                    // This preserves the scoring audit trail and enables recalculation
                                    results: scoredResults.map(r => ({
                                        teamId: r.teamId,
                                        teamName: r.teamName,
                                        placement: r.placement,
                                        kills: r.kills,
                                        placementPoints: r.placementPoints,
                                        killPoints: r.killPoints,
                                        totalPoints: r.totalPoints,
                                        scoringVersion: scoringConfig.scoringVersion,
                                    })),
                                    screenshotUrl
                                };
                            }
                            return m;
                        })
                    };
                }
                return g;
            }) || [];

            await updateDoc(tournamentRef, {
                groups: updatedGroups
            });

            // Update participant stats — fetch the tournament's participants once,
            // index by userId, and look up in memory instead of N+1 queries.
            const batch = writeBatch(db);
            const participantsSnap = await getDocs(query(
                collection(db, 'participants'),
                where('tournamentId', '==', tournament.id)
            ));
            const participantsByUser = new Map<string, { ref: any; data: any }>();
            for (const docSnap of participantsSnap.docs) {
                participantsByUser.set(docSnap.data().userId, { ref: docSnap.ref, data: docSnap.data() });
            }
            for (const res of scoredResults) {
                const p = participantsByUser.get(res.teamId);
                if (!p) continue;
                batch.update(p.ref, {
                    totalKills: (p.data.totalKills || 0) + res.kills,
                    totalPoints: (p.data.totalPoints || 0) + res.totalPoints,
                    matchesPlayed: (p.data.matchesPlayed || 0) + 1
                });
            }
            await batch.commit();

            showToast("Match results uploaded and points calculated!", "success");
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error(error);
            showToast(error.message || "Failed to upload results", "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Upload Match Result - ${group.name}`}>
            <div className="space-y-6 max-h-[70vh] overflow-y-auto px-1 custom-scrollbar">
                {/* Scoring Info Bar */}
                <div className="flex items-center justify-between bg-brand-500/5 border border-brand-500/20 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-brand-500" />
                        <span className="text-xs font-black text-brand-500 uppercase tracking-widest">Auto-Calc Active</span>
                    </div>
                    <div className="text-right">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">{scoringSource}</span>
                        <span className="text-[10px] text-slate-500 ml-2">
                            {scoringConfig.killPoints} pt/kill · {Object.keys(scoringConfig.placementPoints).length} placements
                        </span>
                    </div>
                </div>

                {/* Screenshot Upload */}
                <div className="space-y-3">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Match Screenshot (Proof)</label>
                    <div
                        onClick={() => document.getElementById('result-screenshot')?.click()}
                        className="relative h-48 rounded-3xl border-2 border-dashed border-slate-800 hover:border-brand-500 transition-colors cursor-pointer overflow-hidden flex flex-col items-center justify-center bg-dark group"
                    >
                        {previewUrl ? (
                            <>
                                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" loading="lazy" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-colors flex items-center justify-center">
                                    <Camera className="w-8 h-8 text-white" />
                                </div>
                            </>
                        ) : (
                            <>
                                <Camera className="w-10 h-10 text-slate-600 mb-2 group-hover:text-brand-500 transition-colors" />
                                <p className="text-slate-500 text-xs font-bold">CLICK TO UPLOAD PROOF</p>
                            </>
                        )}
                        <input id="result-screenshot" type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                    </div>
                </div>

                {/* Duplicate placement warnings */}
                {placementErrors.length > 0 && (
                    <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 p-3 rounded-xl">
                        <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                        <div className="text-xs text-red-300">
                            <p className="font-bold mb-1">Duplicate Placements:</p>
                            {placementErrors.map((e, i) => <p key={i}>{e}</p>)}
                        </div>
                    </div>
                )}

                {/* Team Results — with live score breakdown */}
                <div className="space-y-3">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Team Performance</label>

                    {scoredResults.map((res) => {
                        const validation = validateEntry(res.placement, res.kills);
                        return (
                            <div key={res.teamId} className="bg-dark p-4 rounded-2xl border border-slate-800 space-y-3">
                                {/* Team name + total */}
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-black text-white truncate">{res.teamName}</p>
                                    <div className="text-right">
                                        <span className="text-lg font-black text-brand-500">{res.totalPoints}</span>
                                        <span className="text-[10px] text-slate-500 ml-1">pts</span>
                                    </div>
                                </div>

                                {/* Input row */}
                                <div className="flex gap-3 items-center">
                                    {/* Placement */}
                                    <div className="flex-1">
                                        <label className="text-[9px] text-slate-500 font-bold uppercase mb-1 block flex items-center gap-1">
                                            <Trophy className="w-2.5 h-2.5" /> Placement
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={res.placement}
                                            onChange={e => handleUpdateResult(res.teamId, 'placement', parseInt(e.target.value) || 1)}
                                            className={`w-full bg-surface border rounded-xl p-2.5 text-white text-sm font-bold text-center focus:focus-visible:outline-none transition ${
                                                validation.valid
                                                    ? 'border-slate-800 focus:border-brand-500'
                                                    : 'border-red-500/50 focus:border-red-500'
                                            }`}
                                        />
                                    </div>
                                    {/* Kills */}
                                    <div className="flex-1">
                                        <label className="text-[9px] text-slate-500 font-bold uppercase mb-1 block flex items-center gap-1">
                                            <Target className="w-2.5 h-2.5" /> Kills
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={res.kills}
                                            onChange={e => handleUpdateResult(res.teamId, 'kills', parseInt(e.target.value) || 0)}
                                            className={`w-full bg-surface border rounded-xl p-2.5 text-white text-sm font-bold text-center focus:focus-visible:outline-none transition ${
                                                validation.valid
                                                    ? 'border-slate-800 focus:border-brand-500'
                                                    : 'border-red-500/50 focus:border-red-500'
                                            }`}
                                        />
                                    </div>
                                </div>

                                {/* Live score breakdown */}
                                <div className="flex items-center gap-2 text-[10px] font-mono">
                                    <span className="bg-slate-800/50 text-slate-400 px-2 py-1 rounded-lg">
                                        Place: <span className="text-white font-bold">{res.placementPoints}</span>
                                    </span>
                                    <span className="text-slate-600">+</span>
                                    <span className="bg-slate-800/50 text-slate-400 px-2 py-1 rounded-lg">
                                        Kills: <span className="text-white font-bold">{res.killPoints}</span>
                                        <span className="text-slate-500"> ({res.kills}×{scoringConfig.killPoints})</span>
                                    </span>
                                    <span className="text-slate-600">=</span>
                                    <span className="bg-brand-500/10 text-brand-500 px-2 py-1 rounded-lg font-bold">
                                        {res.totalPoints}
                                    </span>
                                </div>

                                {/* Validation error */}
                                {!validation.valid && (
                                    <p className="text-[10px] text-red-400 font-bold flex items-center gap-1">
                                        <AlertTriangle className="w-2.5 h-2.5" /> {validation.errors[0]}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Live Standings Preview */}
                <div className="bg-dark p-4 rounded-2xl border border-slate-800">
                    <p className="text-[10px] font-black text-brand-500 uppercase tracking-widest mb-3 flex items-center gap-1">
                        <Hash className="w-3 h-3" /> Live Standings Preview
                    </p>
                    <div className="space-y-1">
                        {standings.map((s, i) => (
                            <div key={s.teamId} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-slate-800/30 transition">
                                <span className={`w-6 text-center text-xs font-black ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-orange-400' : 'text-slate-500'}`}>
                                    {i + 1}
                                </span>
                                <span className="flex-1 text-sm font-bold text-white truncate">{s.teamName}</span>
                                <span className="text-[10px] text-slate-500 font-mono">{s.kills} kills</span>
                                <span className="text-sm font-black text-brand-500 w-10 text-right">{s.totalPoints}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Submit */}
                <div className="flex gap-3 sticky bottom-0 bg-card pt-2">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-400 font-bold text-sm uppercase tracking-widest hover:bg-slate-800/50 transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || placementErrors.length > 0}
                        className="flex-1 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-black text-sm uppercase tracking-widest transition flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <CheckCircle2 className="w-4 h-4" />
                        )}
                        Submit Results
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ResultUploader;
