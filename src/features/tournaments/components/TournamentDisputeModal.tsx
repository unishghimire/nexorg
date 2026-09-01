import React, { useState } from 'react';
import { ShieldAlert, X, ChevronRight, AlertTriangle } from 'lucide-react';
import { Tournament } from '../../../shared/types/types';
import { auth } from '../../../shared/config/firebase';

interface TournamentDisputeModalProps {
    isOpen: boolean;
    onClose: () => void;
    tournament: Tournament;
    showToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const DISPUTE_CATEGORIES = [
    { id: 'match_room', label: '⚔️ Match Room Issue', desc: 'Wrong room ID/pass, host unresponsive, wrong lobby settings, or illegal players in room' },
    { id: 'cheating_rules', label: '🛡️ Cheating / Rule Violation', desc: 'Hacking, teaming, griefing, illegal ringers, or match conduct violations' },
    { id: 'score_discrepancy', label: '📊 Result / Score Discrepancy', desc: 'Incorrect kill count, incorrect placement points, or wrong team declared winner' },
    { id: 'prize_payout', label: '💰 Prize / Payout Dispute', desc: 'Prize money distribution mismatch or delayed prize transfer' },
    { id: 'other', label: '❓ Other Tournament Dispute', desc: 'General tournament / scrim issue requiring organizer or admin intervention' },
];

export const TournamentDisputeModal: React.FC<TournamentDisputeModalProps> = ({
    isOpen,
    onClose,
    tournament,
    showToast,
}) => {
    const [category, setCategory] = useState('match_room');
    const [matchRoom, setMatchRoom] = useState('1');
    const [reportedTeamName, setReportedTeamName] = useState('');
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reason.trim() || reason.trim().length < 5) {
            showToast('Please provide a detailed description (at least 5 characters).', 'warning');
            return;
        }

        const user = auth.currentUser;
        if (!user) {
            showToast('Please log in to report a dispute.', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            const token = await user.getIdToken();
            const selectedCat = DISPUTE_CATEGORIES.find(c => c.id === category);
            const fullReason = `[${selectedCat?.label || 'Dispute'}] ${reason.trim()}`;

            const isScrim = tournament.matchType === 'scrims' || (tournament as any).isScrim === true;
            const res = await fetch('/api/disputes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    disputeType: isScrim ? 'scrim' : 'tournament',
                    tournamentId: tournament.id,
                    matchRoom,
                    reason: fullReason,
                    reportedTeamName: reportedTeamName.trim() || undefined,
                }),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                showToast('Dispute filed successfully. The organizer and admin team will review your report.', 'success');
                onClose();
            } else {
                showToast(data.message || 'Failed to submit dispute.', 'error');
            }
        } catch (err: any) {
            showToast(err.message || 'Network error while submitting dispute.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose} />
            <div className="relative bg-card border border-gray-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl z-10 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-gray-800 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
                            <ShieldAlert className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-white uppercase tracking-tight">Report Match Dispute</h3>
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{tournament.title}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close modal"
                        className="p-2 text-gray-400 hover:text-white bg-surface hover:bg-surface/80 rounded-full transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Category */}
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                            Dispute Category
                        </label>
                        <div className="space-y-2">
                            {DISPUTE_CATEGORIES.map(cat => (
                                <label
                                    key={cat.id}
                                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                                        category === cat.id
                                            ? 'bg-red-500/10 border-red-500/40 text-white'
                                            : 'bg-surface/50 border-gray-800 text-gray-300 hover:border-gray-700'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="dispute_category"
                                        value={cat.id}
                                        checked={category === cat.id}
                                        onChange={e => setCategory(e.target.value)}
                                        className="mt-1 accent-red-500"
                                    />
                                    <div className="text-xs">
                                        <div className="font-black uppercase">{cat.label}</div>
                                        <div className="text-[11px] text-gray-400 font-semibold mt-0.5">{cat.desc}</div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Match Room / Group */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <div>
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5">
                                Match Group / Room
                            </label>
                            <input
                                type="text"
                                value={matchRoom}
                                onChange={e => setMatchRoom(e.target.value)}
                                placeholder="e.g. Group A / Match 1"
                                className="w-full bg-surface border border-gray-700 rounded-xl p-3 text-white text-xs font-bold focus:border-red-500 focus-visible:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5">
                                Accused Team / Player (Optional)
                            </label>
                            <input
                                type="text"
                                value={reportedTeamName}
                                onChange={e => setReportedTeamName(e.target.value)}
                                placeholder="e.g. Team XYZ or In-Game Name"
                                className="w-full bg-surface border border-gray-700 rounded-xl p-3 text-white text-xs font-bold focus:border-red-500 focus-visible:outline-none"
                            />
                        </div>
                    </div>

                    {/* Detailed Reason */}
                    <div className="pt-2">
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5">
                            Detailed Description &amp; Evidence
                        </label>
                        <textarea
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            placeholder="Explain what happened in detail, including time, player names, and what rules were violated..."
                            className="w-full bg-surface border border-gray-700 rounded-xl p-3.5 text-white text-xs font-semibold focus:border-red-500 focus-visible:outline-none h-28"
                            required
                        />
                    </div>

                    {/* Notice */}
                    <div className="flex items-start gap-2 p-3 bg-red-950/40 border border-red-500/20 rounded-xl text-[11px] text-red-200 font-semibold">
                        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <span>Filing a dispute sends an instant alert to the tournament organizer and platform administrators for official review. False reports may lead to penalties.</span>
                    </div>

                    <div className="pt-3 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white font-bold text-xs uppercase tracking-wider transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !reason.trim()}
                            className="px-6 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition flex items-center gap-2 shadow-lg shadow-red-600/20"
                        >
                            {isSubmitting ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span>Submit Dispute</span>
                                    <ChevronRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
