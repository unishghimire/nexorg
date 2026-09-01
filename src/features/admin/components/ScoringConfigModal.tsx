// ═══════════════════════════════════════════════════════════════
// SCORING CONFIG MODAL — admin configures game-level scoring
// ponytail: one focused component, uses the same scoringEngine for preview.
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { GameScoringConfig, FREE_FIRE_DEFAULT_SCORING } from '../../../shared/types/scoring';
import { RewardConfig } from '../../../shared/types/per-kill';
import { Target } from 'lucide-react';
import { validateScoringConfig, generateScoringPreview } from '../../../shared/services/scoringEngine';

interface ScoringConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    gameName: string;
    gameId: string;
    currentScoring?: GameScoringConfig | null;
    onSave: (config: GameScoringConfig) => Promise<void>;
}

export const ScoringConfigModal: React.FC<ScoringConfigModalProps> = ({
    isOpen, onClose, gameName, gameId, currentScoring, onSave
}) => {
    const [killPoints, setKillPoints] = useState(1);
    const [placementPoints, setPlacementPoints] = useState<Record<string, number>>({});
    const [maxPlacement, setMaxPlacement] = useState(12);
    const [enabled, setEnabled] = useState(true);
    const [rewardEnabled, setRewardEnabled] = useState(false);
    const [rewardPerKill, setRewardPerKill] = useState(10);
    const [rewardCurrency, setRewardCurrency] = useState('NPR');
    const [minimumKillsForReward, setMinimumKillsForReward] = useState(0);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Initialize from existing config or Free Fire defaults
    useEffect(() => {
        if (currentScoring) {
            setKillPoints(currentScoring.killPoints);
            setPlacementPoints({ ...currentScoring.placementPoints });
            setMaxPlacement(currentScoring.maxPlacement || 12);
            setEnabled(currentScoring.enabled);
            // Load reward config if exists
            if (currentScoring.rewardConfig) {
                setRewardEnabled(currentScoring.rewardConfig.enabled);
                setRewardPerKill(currentScoring.rewardConfig.rewardPerKill);
                setRewardCurrency(currentScoring.rewardConfig.currency);
                setMinimumKillsForReward(currentScoring.rewardConfig.minimumKillsForReward || 0);
            }
        } else {
            // Default to Free Fire scoring for new configs
            setKillPoints(FREE_FIRE_DEFAULT_SCORING.killPoints);
            setPlacementPoints({ ...FREE_FIRE_DEFAULT_SCORING.placementPoints });
            setMaxPlacement(FREE_FIRE_DEFAULT_SCORING.maxPlacement || 12);
            setEnabled(true);
        }
        setError('');
    }, [currentScoring, isOpen]);

    const rewardConfig: RewardConfig = useMemo(() => ({
        enabled: rewardEnabled,
        rewardPerKill,
        currency: rewardCurrency,
        minimumKillsForReward,
    }), [rewardEnabled, rewardPerKill, rewardCurrency, minimumKillsForReward]);

    const config: GameScoringConfig = useMemo(() => ({
        enabled,
        killPoints,
        placementPoints,
        maxPlacement,
        scoringVersion: (currentScoring?.scoringVersion || 0) + 1,
        rewardConfig,
        updatedAt: new Date() as any,
        updatedBy: '',
    }), [enabled, killPoints, placementPoints, maxPlacement, rewardConfig, currentScoring]);

    const preview = useMemo(() => generateScoringPreview(config), [config]);
    const validation = useMemo(() => validateScoringConfig(config), [config]);

    const handlePlacementChange = (pos: string, value: number) => {
        setPlacementPoints(prev => ({ ...prev, [pos]: value }));
    };

    const handleAddPosition = () => {
        const nextPos = maxPlacement + 1;
        setPlacementPoints(prev => ({ ...prev, [String(nextPos)]: 0 }));
        setMaxPlacement(nextPos);
    };

    const handleRemovePosition = (pos: string) => {
        setPlacementPoints(prev => {
            const next = { ...prev };
            delete next[pos];
            return next;
        });
        const positions = Object.keys(placementPoints).map(Number).filter(n => n !== parseInt(pos));
        setMaxPlacement(positions.length > 0 ? Math.max(...positions) : 0);
    };

    const handleSave = async () => {
        if (!validation.valid) {
            setError(validation.errors[0]);
            return;
        }
        setSaving(true);
        try {
            await onSave(config);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to save scoring config');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    const sortedPositions = Object.keys(placementPoints)
        .map(Number)
        .sort((a, b) => a - b);

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <div className="bg-card w-full max-w-2xl rounded-2xl border border-slate-800 p-6 space-y-6 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar">
                {/* Header */}
                <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                    <div>
                        <h3 className="text-xl font-black uppercase tracking-widest text-white">Scoring Configuration</h3>
                        <p className="text-xs text-slate-400 mt-1">{gameName} — Game-Level Scoring</p>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Enable toggle */}
                <div className="flex items-center justify-between bg-dark p-4 rounded-xl border border-slate-800">
                    <div>
                        <p className="text-sm font-bold text-white">Enable Scoring</p>
                        <p className="text-xs text-slate-400">When enabled, new tournaments inherit this scoring</p>
                    </div>
                    <button type="button"
                        onClick={() => setEnabled(!enabled)}
                        className={`w-12 h-6 rounded-full transition ${enabled ? 'bg-brand-500' : 'bg-slate-700'} relative`}
                        aria-label="Toggle scoring"
                    >
                        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition ${enabled ? 'left-6' : 'left-0.5'}`} />
                    </button>
                </div>

                {/* Kill Points */}
                <div>
                    <label htmlFor="scoring-kill-points" className="block text-xs font-black text-slate-400 uppercase mb-2 tracking-widest">Points Per Kill</label>
                    <div className="flex items-center gap-3">
                        <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={killPoints}
                            onChange={e => setKillPoints(parseFloat(e.target.value) || 0)}
                            className="w-24 bg-dark border border-slate-800 text-white rounded-xl p-3 text-center text-lg font-black focus:border-brand-500 focus-visible:outline-none"
                        />
                        <span className="text-sm text-slate-400">point{killPoints !== 1 ? 's' : ''} per kill</span>
                    </div>
                </div>

                {/* Placement Points */}
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Placement Points</label>
                        <button type="button"
                            onClick={handleAddPosition}
                            className="text-brand-500 hover:text-brand-400 text-xs font-bold flex items-center gap-1"
                        >
                            <Plus className="w-3 h-3" /> Add Position
                        </button>
                    </div>
                    <div className="space-y-2 max-h-[240px] overflow-y-auto custom-scrollbar pr-1">
                        {sortedPositions.map(pos => (
                            <div key={pos} className="flex items-center gap-3 bg-dark p-2 rounded-xl border border-slate-800 group">
                                <span className="w-10 text-center text-xs font-black text-slate-500">
                                    {pos === 1 ? '1st' : pos === 2 ? '2nd' : pos === 3 ? '3rd' : pos + 'th'}
                                </span>
                                <input
                                    type="number"
                                    min="0"
                                    value={placementPoints[String(pos)] ?? 0}
                                    onChange={e => handlePlacementChange(String(pos), parseInt(e.target.value) || 0)}
                                    className="flex-1 bg-surface border border-slate-800 text-white rounded-lg p-2 text-sm font-bold focus:border-brand-500 focus-visible:outline-none"
                                />
                                <span className="text-xs text-slate-500">pts</span>
                                <button type="button"
                                    onClick={() => handleRemovePosition(String(pos))}
                                    className="p-1.5 text-slate-600 hover:text-red-500 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Preview — uses the SAME scoring engine */}
                <div className="bg-dark p-4 rounded-xl border border-slate-800">
                    <p className="text-xs font-black text-brand-500 uppercase tracking-widest mb-3">Scoring Preview</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {preview.slice(0, 9).map((line, i) => (
                            <div key={i} className="text-xs text-slate-300 font-mono bg-surface px-3 py-1.5 rounded-lg">
                                {line}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Validation warning */}
                {validation.errors.length > 0 && (
                    <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 p-3 rounded-xl">
                        <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                        <div className="text-xs text-red-300">
                            {validation.errors.map((e, i) => <p key={i}>{e}</p>)}
                        </div>
                    </div>
                )}

                {/* Save */}
                <div className="flex gap-3 pt-2 sticky bottom-0 bg-card">
                    <button type="button"
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-400 font-bold text-sm uppercase tracking-widest hover:bg-slate-800/50 transition"
                    >
                        Cancel
                    </button>
                    <button type="button"
                        onClick={handleSave}
                        disabled={saving || !validation.valid}
                        className="flex-1 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-black text-sm uppercase tracking-widest transition flex items-center justify-center gap-2"
                    >
                        {saving ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        Save Scoring
                    </button>
                </div>
                {error && <p className="text-xs text-red-400 text-center">{error}</p>}
            </div>
        </div>
    );
};

export default ScoringConfigModal;
