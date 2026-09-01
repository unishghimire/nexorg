import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../../shared/config/firebase';
import { Tournament, ManualResult, ResultTemplateConfig } from '../../../shared/types/types';
import Modal from '../../../shared/components/Modal';
import { Upload, Plus, Trash2, Save, Trophy, Users, DollarSign, CheckCircle2, AlertCircle, List } from 'lucide-react';
import { NotificationService } from '../../../shared/services/NotificationService';
import { useNotification } from '../../../shared/context/NotificationContext';
import { motion, AnimatePresence } from 'motion/react';
import { useInvisibleImage } from '../../../shared/hooks/useInvisibleImage';
import { MediaCategory } from '../../../shared/services/mediaService';
import ManualResultManager from './ManualResultManager';
import { useAuth } from '../../../shared/context/AuthContext';

interface ResultUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    tournament: Tournament;
    onSuccess: () => void;
}

const ResultUploadModal: React.FC<ResultUploadModalProps> = ({ isOpen, onClose, tournament, onSuccess }) => {
    const { showToast } = useNotification();
    const { user, profile } = useAuth();
    const [activeTab, setActiveTab] = useState<'file' | 'manual' | 'leaderboard'>('file');
    const [participants, setParticipants] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [resultUrl, setResultUrl] = useState('');
    const [winners, setWinners] = useState<{ uid: string; amount: number; rank: number; username: string }[]>([]);
    
    const [manualResults, setManualResults] = useState<ManualResult[]>([]);
    const [templateConfig, setTemplateConfig] = useState<ResultTemplateConfig>({
        template: 'classic',
        theme: { primaryColor: '#ef4444', background: 'dark' },
        showFields: { rank: true, team: true, score: true, status: true }
    });

    const handleSavePreset = async (name: string, config: ResultTemplateConfig) => {
        if (!user) return;
        try {
            const newPreset = { id: `preset-${Date.now()}`, name, config };
            const currentPresets = profile?.resultPresets || [];
            const updatedPresets = [...currentPresets, newPreset];
            
            await updateDoc(doc(db, 'users', user.uid), {
                resultPresets: updatedPresets
            });
            showToast('Preset saved successfully!', 'success');
        } catch (error) {
            console.error("Error saving preset:", error);
            showToast('Failed to save preset', 'error');
        }
    };

    const { handlePaste, handleDrop, handleDragOver, processAndUpload, isProcessing } = useInvisibleImage({
        onUploadStart: () => setLoading(true),
        onUploadEnd: () => setLoading(false),
        onUploadSuccess: (url) => {
            setResultUrl(url);
            showToast('Result image processed successfully', 'success');
        },
        onError: (err) => showToast(err, 'error')
    });

    useEffect(() => {
        if (isOpen && tournament.id) {
            const fetchParticipants = async () => {
                try {
                    const q = query(collection(db, 'participants'), where('tournamentId', '==', tournament.id));
                    const snap = await getDocs(q);
                    setParticipants(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                } catch (error) {
                    console.error("Error fetching participants:", error);
                }
            };
            fetchParticipants();

            if (tournament.prizeDistribution) {
                setWinners(tournament.prizeDistribution.map(p => ({
                    uid: '',
                    username: '',
                    amount: p.amount,
                    rank: p.rank
                })));
            } else {
                setWinners([{ uid: '', username: '', amount: 0, rank: 1 }]);
            }

            if (tournament.manualResults) {
                setManualResults(tournament.manualResults);
            }
            if (tournament.resultTemplate) {
                setTemplateConfig(tournament.resultTemplate);
            }
        }
    }, [isOpen, tournament]);

    const handleAddWinner = () => {
        const nextRank = winners.length + 1;
        setWinners([...winners, { uid: '', username: '', amount: 0, rank: nextRank }]);
    };

    const handleRemoveWinner = (index: number) => {
        setWinners(winners.filter((_, i) => i !== index));
    };

    const handleWinnerChange = (index: number, field: string, value: any) => {
        const newWinners = [...winners];
        if (field === 'uid') {
            const p = participants.find(part => part.userId === value);
            newWinners[index] = { 
                ...newWinners[index], 
                uid: value, 
                username: p ? p.username : '' 
            };
        } else {
            newWinners[index] = { ...newWinners[index], [field]: value };
        }
        setWinners(newWinners);
    };

    const handleSubmit = async () => {
        // Validate manual results
        if (activeTab === 'leaderboard') {
            const teams = new Set();
            const ranks = new Set();
            for (const res of manualResults) {
                if (!res.team.trim()) {
                    showToast('Team name is required for all leaderboard entries.', 'error');
                    return;
                }
                if (teams.has(res.team.trim().toLowerCase())) {
                    showToast(`Duplicate team name "${res.team}" found in leaderboard.`, 'error');
                    return;
                }
                teams.add(res.team.trim().toLowerCase());

                if (ranks.has(res.rank)) {
                    showToast(`Duplicate rank "${res.rank}" found in leaderboard.`, 'error');
                    return;
                }
                ranks.add(res.rank);

                if (isNaN(res.score)) {
                    showToast('Score must be a number for all leaderboard entries.', 'error');
                    return;
                }
            }
        }

        // Validate prize pool allocation for manual payout
        if (activeTab === 'manual' && tournament.prizePool && tournament.prizePool > 0) {
            const totalAllocated = winners.reduce((sum, w) => sum + (Number(w.amount) || 0), 0);
            if (totalAllocated !== tournament.prizePool) {
                if (totalAllocated > tournament.prizePool) {
                    showToast(`Total distributed prizes (NPR ${totalAllocated}) exceed tournament prize pool (NPR ${tournament.prizePool})`, 'error');
                } else {
                    showToast(`Total distributed prizes (NPR ${totalAllocated}) must equal tournament prize pool (NPR ${tournament.prizePool}). Remaining: NPR ${tournament.prizePool - totalAllocated}`, 'error');
                }
                return;
            }
        }

        setLoading(true);
        try {
            const validWinners = winners.filter(w => w.uid !== '').map(({ uid, amount, rank, username }) => ({ userId: uid, prize: Number(amount) || 0, rank, username }));

            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error('Authentication required');

            const res = await fetch('/api/wallet/distribute-prizes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    tournamentId: tournament.id,
                    winners: validWinners,
                    resultsData: { manualResults, resultTemplate: templateConfig }
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to distribute prizes');

            await NotificationService.notifyParticipants(
                tournament.id,
                'Results Uploaded!',
                `Final results for ${tournament.title} are now available. Check the leaderboard!`,
                'success',
                `/tournaments/${tournament.id}`
            );

            showToast('Results finalized and winners paid!', 'success');
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error("Error uploading results:", error);
            showToast(error.message || "Failed to upload results. Please try again.", "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Finalize Results: ${tournament.title}`} maxWidth="max-w-4xl">
            <div className="space-y-6">
                <div className="flex p-1 bg-dark rounded-2xl border border-gray-800">
                    {[
                        { id: 'file', label: 'File Upload', icon: Upload },
                        { id: 'leaderboard', label: 'Leaderboard Builder', icon: List },
                        { id: 'manual', label: 'Payouts', icon: DollarSign },
                    ].map((tab) => (
                        <button type="button" 
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-colors ${
                                activeTab === tab.id 
                                ? 'bg-brand-600 text-white shadow-lg' 
                                : 'text-gray-500 hover:text-gray-300'
                            }`}
                        >
                            <tab.icon className="w-4 h-4" /> {tab.label}
                        </button>
                    ))}
                </div>

                <AnimatePresence mode="wait">
                    {activeTab === 'file' && (
                        <motion.div 
                            key="file"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-4"
                        >
                            <div className="bg-brand-500/5 border border-brand-500/10 p-4 rounded-2xl flex gap-3 mb-4">
                                <AlertCircle className="w-5 h-5 text-brand-500 shrink-0" />
                                <p className="text-xs text-gray-400 leading-relaxed">
                                    Upload a screenshot of the final match results. This will be visible to all participants as proof of results.
                                </p>
                            </div>

                            <div className="relative group">
                                <div 
                                    onPaste={handlePaste}
                                    onDrop={handleDrop}
                                    onDragOver={handleDragOver}
                                    onClick={() => document.getElementById('result-proof-file-input')?.click()}
                                    className={`
                                        border-2 border-dashed rounded-2xl sm:rounded-3xl p-4 sm:p-8 md:p-10 text-center transition-colors duration-300 cursor-pointer
                                        ${resultUrl ? 'border-green-500/50 bg-green-500/5' : 'border-gray-800 bg-dark group-hover:border-brand-500/50 group-hover:bg-brand-500/5'}
                                        ${isProcessing ? 'border-brand-500 bg-brand-500/10' : ''}
                                    `}
                                >
                                    <div className="flex flex-col items-center">
                                        {isProcessing ? (
                                            <div className="w-16 h-16 border-4 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mb-4"></div>
                                        ) : resultUrl ? (
                                            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
                                                <CheckCircle2 className="w-8 h-8 text-green-500" />
                                            </div>
                                        ) : (
                                            <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                                <Upload className="w-8 h-8 text-gray-500 group-hover:text-brand-500" />
                                            </div>
                                        )}
                                        <h3 className="text-white font-black uppercase tracking-wider">
                                            {isProcessing ? 'Processing Image...' : resultUrl ? 'Image Processed' : 'Paste, Drop or Click to Select Image'}
                                        </h3>
                                        <p className="text-gray-500 text-xs mt-2 font-medium">PNG, JPG or WEBP (max. 5MB)</p>
                                    </div>
                                </div>
                                <input 
                                    id="result-proof-file-input"
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                        if (e.target.files?.[0]) {
                                            processAndUpload(e.target.files[0]);
                                        }
                                    }}
                                />
                            </div>

                            {resultUrl && (
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="relative rounded-2xl overflow-hidden border border-gray-800 shadow-2xl"
                                >
                                    <img src={resultUrl || undefined} alt="Result Preview" className="w-full h-48 object-cover" loading="lazy" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-4">
                                        <span className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-green-500" /> Uploaded Successfully
                                        </span>
                                    </div>
                                </motion.div>
                            )}
                        </motion.div>
                    )}

                    {activeTab === 'leaderboard' && (
                        <motion.div 
                            key="leaderboard"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-4"
                        >
                            <ManualResultManager 
                                results={manualResults}
                                onChange={setManualResults}
                                templateConfig={templateConfig}
                                onTemplateChange={setTemplateConfig}
                                presets={profile?.resultPresets || []}
                                onSavePreset={handleSavePreset}
                            />
                        </motion.div>
                    )}

                    {activeTab === 'manual' && (
                        <motion.div 
                            key="manual"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-4"
                        >
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                    <Trophy className="w-4 h-4 text-brand-500" /> Winners & Payouts
                                </h4>
                                <button type="button" 
                                    onClick={handleAddWinner}
                                    className="text-xs bg-brand-600/10 hover:bg-brand-600/20 text-brand-500 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors font-black uppercase tracking-wider border border-brand-500/20"
                                >
                                    <Plus className="w-3 h-3" /> Add Winner
                                </button>
                            </div>

                            {/* Live Prize Allocation Summary */}
                            {typeof tournament.prizePool === 'number' && tournament.prizePool > 0 && (() => {
                                const totalAllocated = winners.reduce((sum, w) => sum + (Number(w.amount) || 0), 0);
                                const isMatched = totalAllocated === tournament.prizePool;
                                const isExceeded = totalAllocated > tournament.prizePool;
                                return (
                                    <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-bold ${
                                        isMatched
                                            ? 'bg-green-500/10 border-green-500/30 text-green-400'
                                            : isExceeded
                                            ? 'bg-red-500/10 border-red-500/30 text-red-400'
                                            : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                    }`}>
                                        <span className="uppercase tracking-wider">
                                            Prize Pool: NPR {tournament.prizePool}
                                        </span>
                                        <span className="font-black">
                                            {isMatched
                                                ? `✓ 100% Allocated (NPR ${totalAllocated})`
                                                : isExceeded
                                                ? `Exceeds pool by NPR ${totalAllocated - tournament.prizePool}`
                                                : `Allocated: NPR ${totalAllocated} (Remaining: NPR ${tournament.prizePool - totalAllocated})`}
                                        </span>
                                    </div>
                                );
                            })()}

                            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                {winners.map((winner, index) => (
                                    <motion.div 
                                        key={index}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="bg-surface p-4 rounded-2xl border border-gray-800 flex flex-col md:flex-row gap-4 relative group"
                                    >
                                        <div className="w-full md:w-20">
                                            <label className="text-xs text-gray-500 uppercase font-black mb-1.5 block tracking-widest">Rank</label>
                                            <div className="relative">
                                                <Trophy className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-500" />
                                                <input 
                                                    type="number" 
                                                    value={isNaN(winner.rank) ? '' : winner.rank}
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value);
                                                        handleWinnerChange(index, 'rank', isNaN(val) ? 0 : val);
                                                    }}
                                                    className="w-full bg-dark border border-gray-800 rounded-xl py-2.5 pl-9 pr-3 text-sm text-white focus:border-brand-500 focus-visible:outline-none font-black"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-xs text-gray-500 uppercase font-black mb-1.5 block tracking-widest">Select Winner</label>
                                            <div className="relative">
                                                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                                                <select 
                                                    value={winner.uid}
                                                    onChange={(e) => handleWinnerChange(index, 'uid', e.target.value)}
                                                    className="w-full bg-dark border border-gray-800 rounded-xl py-2.5 pl-9 pr-3 text-sm text-white focus:border-brand-500 focus-visible:outline-none font-bold appearance-none"
                                                >
                                                    <option value="">Select Player</option>
                                                    {participants.map(p => (
                                                        <option key={p.userId} value={p.userId}>{p.username} ({p.inGameId})</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="w-full md:w-32">
                                            <label className="text-xs text-gray-500 uppercase font-black mb-1.5 block tracking-widest">Prize Amount</label>
                                            <div className="relative">
                                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-green-500" />
                                                <input 
                                                    type="number" 
                                                    value={isNaN(winner.amount) ? '' : winner.amount}
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value);
                                                        handleWinnerChange(index, 'amount', isNaN(val) ? 0 : val);
                                                    }}
                                                    className="w-full bg-dark border border-gray-800 rounded-xl py-2.5 pl-9 pr-3 text-sm text-white focus:border-brand-500 focus-visible:outline-none font-black"
                                                />
                                            </div>
                                        </div>
                                        <button type="button" 
                                            onClick={() => handleRemoveWinner(index)}
                                            className="absolute -top-2 -right-2 md:static md:mt-7 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white p-2.5 rounded-xl transition-colors duration-300 border border-red-500/20"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="pt-6 border-t border-gray-800 flex flex-col md:flex-row gap-3">
                    <button type="button" 
                        onClick={onClose}
                        className="flex-1 bg-surface hover:bg-surface text-white py-4 rounded-2xl font-black uppercase tracking-widest transition-colors active:scale-95"
                    >
                        Cancel
                    </button>
                    <button type="button" 
                        onClick={handleSubmit}
                        disabled={loading || (activeTab === 'file' && !resultUrl) || (activeTab === 'manual' && winners.every(w => w.uid === ''))}
                        className="flex-[2] bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 transition-colors active:scale-[0.98] hover:shadow-[0_0_25px_rgba(var(--brand-primary-rgb),0.4)]"
                    >
                        {loading ? (
                            <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <>
                                <Save className="w-6 h-6" /> Finalize & Pay Winners
                            </>
                        )}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ResultUploadModal;
