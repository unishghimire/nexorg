import React, { useState } from 'react';
import { auth } from '../../../shared/config/firebase';
import { Tournament, UserProfile } from '../../../shared/types/types';
import Modal from '../../../shared/components/Modal';
import { useNotification } from '../../../shared/context/NotificationContext';
import { NotificationService } from '../../../shared/services/NotificationService';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../shared/context/AuthContext';
import { Trophy, Users, DollarSign, ShieldCheck } from 'lucide-react';
import { formatCurrency, formatGameName } from '../../../shared/utils/utils';

interface RegistrationModalProps {
    isOpen: boolean;
    onClose: () => void;
    tournament: Tournament;
    profile: UserProfile;
    onSuccess: () => void;
}

const RegistrationModal: React.FC<RegistrationModalProps> = ({
    isOpen,
    onClose,
    tournament,
    profile,
    onSuccess
}) => {
    const { user } = useAuth();
    const { showToast } = useNotification();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!user || !tournament || !profile) return;

        setLoading(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error('Authentication required');

            const res = await fetch('/api/wallet/join-tournament', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ tournamentId: tournament.id }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to join tournament');

            await NotificationService.create(
                user.uid,
                'Tournament Joined!',
                `You have successfully joined ${tournament.title}. Good luck!`,
                'success',
                `/tournaments/${tournament.id}`
            );
            
            showToast('Joined Successfully!', 'success');
            onSuccess();
            onClose();
            navigate('/dashboard');
        } catch (e: any) {
            showToast(e.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Confirm Registration">
            <div className="space-y-6">
                <div className="bg-brand-600/10 border border-brand-500/20 p-4 rounded-2xl">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center shadow-lg shadow-brand-600/20">
                            <Trophy className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-white font-black uppercase tracking-tight">{tournament.title}</h3>
                            <p className="text-[10px] text-brand-500 font-black uppercase tracking-widest">{formatGameName(tournament.game)}</p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-dark/50 p-3 rounded-xl border border-white/5">
                            <div className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1 flex items-center gap-1">
                                <DollarSign className="w-3 h-3" /> Entry Fee
                            </div>
                            <div className="text-white font-black">{tournament.entryFee > 0 ? formatCurrency(tournament.entryFee) : 'FREE'}</div>
                        </div>
                        <div className="bg-dark/50 p-3 rounded-xl border border-white/5">
                            <div className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1 flex items-center gap-1">
                                <Users className="w-3 h-3" /> Format
                            </div>
                            <div className="text-white font-black uppercase">{tournament.teamType}</div>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Your Details</h4>
                    <div className="bg-surface p-4 rounded-2xl border border-gray-800 space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500 font-bold">In-Game Name</span>
                            <span className="text-sm text-white font-black">{profile.inGameName}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500 font-bold">In-Game ID</span>
                            <span className="text-sm text-white font-mono">{profile.inGameId}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-gray-800">
                            <span className="text-xs text-gray-500 font-bold">Available Balance</span>
                            <span className={`text-sm font-black ${profile.balance >= tournament.entryFee ? 'text-green-500' : 'text-red-500'}`}>
                                {formatCurrency(profile.balance)}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
                    <ShieldCheck className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-gray-400 leading-relaxed">
                        By confirming, you agree to follow the tournament rules and maintain fair play. Entry fee will be deducted from your wallet.
                    </p>
                </div>

                <div className="flex gap-3 pt-2">
                    <button type="button" 
                        onClick={onClose}
                        disabled={loading}
                        className="flex-1 bg-surface hover:bg-surface text-white py-4 rounded-2xl font-black uppercase tracking-widest transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button type="button" 
                        onClick={handleSubmit}
                        disabled={loading || profile.balance < tournament.entryFee}
                        className="flex-1 bg-brand-600 hover:bg-brand-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-brand-600/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : 'Confirm Join'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default RegistrationModal;
