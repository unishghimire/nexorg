import React from 'react';
import { motion } from 'motion/react';
import { XCircle, CheckCircle2, User } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../../shared/config/firebase';
import { commitFirestoreBatches } from '../../../../shared/utils/firestoreBatches';
import { TournamentAdminTabProps } from './types';

export const ParticipantsTab: React.FC<TournamentAdminTabProps> = (props) => {
    const { participants, setParticipants, showToast } = props;

    const handleApprove = async (id: string) => {
        try {
            await updateDoc(doc(db, 'participants', id), { status: 'approved' });
            setParticipants(participants.map(p => p.id === id ? { ...p, status: 'approved' } : p));
            showToast('Player approved', 'success');
        } catch { showToast('Failed to approve', 'error'); }
    };

    const handleReject = async (id: string) => {
        if (!window.confirm('Reject this registration?')) return;
        try {
            await updateDoc(doc(db, 'participants', id), { status: 'rejected' });
            setParticipants(participants.map(p => p.id === id ? { ...p, status: 'rejected' } : p));
            showToast('Player rejected', 'info');
        } catch { showToast('Failed to reject', 'error'); }
    };

    const handleCheckIn = async (id: string) => {
        try {
            const isCheckedIn = participants.find(p => p.id === id)?.checkedIn;
            await updateDoc(doc(db, 'participants', id), {
                checkedIn: !isCheckedIn,
                checkedInAt: !isCheckedIn ? new Date() : null,
            });
            setParticipants(participants.map(p => p.id === id ? { ...p, checkedIn: !isCheckedIn, checkedInAt: !isCheckedIn ? new Date() as any : null } : p));
            showToast(isCheckedIn ? 'Player checked out' : 'Player checked in', 'success');
        } catch { showToast('Failed to toggle check-in', 'error'); }
    };

    const handleBulkCheckIn = async () => {
        const approved = participants.filter(p => p.status === 'approved' && !p.checkedIn);
        if (approved.length === 0) { showToast('No approved players pending check-in', 'info'); return; }
        if (!window.confirm(`Check in all ${approved.length} approved players?`)) return;
        try {
            const operations = approved.map(p => (batch: any) => {
                batch.update(doc(db, 'participants', p.id), { checkedIn: true, checkedInAt: new Date() });
            });
            await commitFirestoreBatches(db, operations);
            setParticipants(participants.map(p => p.status === 'approved' && !p.checkedIn ? { ...p, checkedIn: true, checkedInAt: new Date() as any } : p));
            showToast(`${approved.length} players checked in`, 'success');
        } catch { showToast('Failed to bulk check-in', 'error'); }
    };

    return (
        <motion.div
            key="participants"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-surface p-4 sm:p-8 rounded-2xl sm:rounded-3xl border border-gray-800 space-y-6"
        >
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                    <h2 className="text-lg sm:text-xl font-black uppercase tracking-tighter text-white mb-1">Participant Registrations</h2>
                    <p className="text-gray-500 text-xs sm:text-sm font-medium">Review and manage player registrations.</p>
                </div>
                <div className="flex gap-2 sm:gap-4">
                    <div className="bg-dark px-4 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl border border-gray-800 text-center flex-1 sm:flex-none">
                        <div className="text-[10px] sm:text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Approved</div>
                        <div className="text-lg sm:text-xl font-black text-white">{participants.filter(p => p.status === 'approved').length}</div>
                    </div>
                    <div className="bg-dark px-4 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl border border-gray-800 text-center flex-1 sm:flex-none">
                        <div className="text-[10px] sm:text-[10px] text-yellow-500/50 font-black uppercase tracking-widest mb-1">Pending</div>
                        <div className="text-lg sm:text-xl font-black text-yellow-500">{participants.filter(p => p.status === 'pending').length}</div>
                    </div>
                    <div className="bg-dark px-4 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl border border-gray-800 text-center flex-1 sm:flex-none">
                        <div className="text-[10px] sm:text-[10px] text-green-500/50 font-black uppercase tracking-widest mb-1">Checked In</div>
                        <div className="text-lg sm:text-xl font-black text-green-500">{participants.filter(p => p.checkedIn).length}</div>
                    </div>
                </div>
                <button
                    onClick={handleBulkCheckIn}
                    className="bg-green-600 hover:bg-green-500 text-white px-4 py-2.5 min-h-[44px] rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-colors"
                >
                    <CheckCircle2 className="w-4 h-4 shrink-0" /> Check In All
                </button>
            </div>

            {participants.length === 0 ? (
                <div className="py-16 text-center text-gray-500 font-bold uppercase tracking-widest text-xs">
                    No participants registered yet
                </div>
            ) : (
                <>
                    {/* Mobile card view */}
                    <div className="sm:hidden space-y-3">
                        {participants.map((p) => (
                            <div key={p.id} className="bg-dark rounded-xl border border-gray-800 p-4 space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-dark border border-gray-800 overflow-hidden shrink-0">
                                        {p.logoUrl ? (
                                            <img src={p.logoUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <User className="w-5 h-5 text-gray-600" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-black text-white truncate">{p.username}</p>
                                        <p className="text-[10px] text-brand-500 font-bold uppercase truncate">{p.teamName || 'Solo'}</p>
                                    </div>
                                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest shrink-0 ${
                                        p.status === 'approved' ? 'bg-green-500/10 text-green-500' :
                                        p.status === 'rejected' ? 'bg-red-500/10 text-red-500' :
                                        'bg-yellow-500/10 text-yellow-500'
                                    }`}>
                                        {p.status || 'pending'}
                                    </span>
                                </div>
                                <div className="text-xs space-y-1 pl-13">
                                    <p className="text-white font-bold break-anywhere">{p.inGameName || '—'}</p>
                                    <p className="text-gray-500 font-mono break-anywhere">{p.inGameId || '—'}</p>
                                </div>
                                <div className="flex gap-2 pt-1">
                                    {p.status !== 'approved' && (
                                        <button type="button" onClick={() => handleApprove(p.id)}
                                            className="flex-1 py-2.5 border border-green-500/20 text-green-500 hover:bg-green-500/10 rounded-lg transition-colors text-xs font-bold uppercase tracking-widest touch-target flex items-center justify-center gap-1.5">
                                            <CheckCircle2 className="w-4 h-4" /> Approve
                                        </button>
                                    )}
                                    {p.status !== 'rejected' && (
                                        <button type="button" onClick={() => handleReject(p.id)}
                                            className="flex-1 py-2.5 border border-red-500/20 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors text-xs font-bold uppercase tracking-widest touch-target flex items-center justify-center gap-1.5">
                                            <XCircle className="w-4 h-4" /> Reject
                                        </button>
                                    )}
                                    {p.status === 'approved' && (
                                        <button type="button" onClick={() => handleCheckIn(p.id)}
                                            className={`flex-1 py-2.5 border rounded-lg transition-colors text-xs font-bold uppercase tracking-widest touch-target flex items-center justify-center gap-1.5 ${
                                                p.checkedIn
                                                    ? 'border-green-500/30 bg-green-500/10 text-green-500'
                                                    : 'border-blue-500/20 text-blue-500 hover:bg-blue-500/10'
                                            }`}>
                                            <CheckCircle2 className="w-4 h-4" /> {p.checkedIn ? 'In' : 'Check-In'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Desktop table view */}
                    <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-left min-w-[600px]">
                            <thead>
                                <tr className="border-b border-gray-800">
                                    <th className="pb-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Player / Team</th>
                                    <th className="pb-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">In-Game Details</th>
                                    <th className="pb-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Status</th>
                                    <th className="pb-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/50">
                                {participants.map((p) => (
                                    <tr key={p.id} className="group hover:bg-white/[0.02] transition-colors">
                                        <td className="py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-dark border border-gray-800 overflow-hidden shrink-0">
                                                    {p.logoUrl ? (
                                                        <img src={p.logoUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <User className="w-5 h-5 text-gray-600" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-black text-white truncate">{p.username}</p>
                                                    <p className="text-[10px] text-brand-500 font-bold uppercase truncate">{p.teamName || 'Solo'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4">
                                            <p className="text-xs font-bold text-white break-anywhere">{p.inGameName}</p>
                                            <p className="text-[10px] text-gray-500 font-mono break-anywhere">{p.inGameId}</p>
                                        </td>
                                        <td className="py-4 text-center">
                                            <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${
                                                p.status === 'approved' ? 'bg-green-500/10 text-green-500' :
                                                p.status === 'rejected' ? 'bg-red-500/10 text-red-500' :
                                                'bg-yellow-500/10 text-yellow-500'
                                            }`}>
                                                {p.status || 'pending'}
                                            </span>
                                        </td>
                                        <td className="py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                {p.status !== 'approved' && (
                                                    <button type="button" onClick={() => handleApprove(p.id)}
                                                        className="p-2 border border-green-500/20 text-green-500 hover:bg-green-500/10 rounded-lg transition-colors touch-target"
                                                        title="Approve">
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {p.status !== 'rejected' && (
                                                    <button type="button" onClick={() => handleReject(p.id)}
                                                        className="p-2 border border-red-500/20 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors touch-target"
                                                        title="Reject">
                                                        <XCircle className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {p.status === 'approved' && (
                                                    <button type="button" onClick={() => handleCheckIn(p.id)}
                                                        className={`p-2 border rounded-lg transition-colors touch-target ${
                                                            p.checkedIn
                                                                ? 'border-green-500/30 bg-green-500/10 text-green-500'
                                                                : 'border-blue-500/20 text-blue-500 hover:bg-blue-500/10'
                                                        }`}
                                                        title={p.checkedIn ? 'Checked In' : 'Check In'}>
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </motion.div>
    );
};
