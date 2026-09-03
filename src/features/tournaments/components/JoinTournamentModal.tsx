import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../../shared/config/firebase';
import { normalizeScrimSlots, countFilledScrimSlots } from '../../../shared/utils/scrimSlots';
import { Tournament, UserProfile, Team, TeamMember } from '../../../shared/types/types';
import Modal from '../../../shared/components/Modal';
import { useNotification } from '../../../shared/context/NotificationContext';
import { NotificationService } from '../../../shared/services/NotificationService';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../shared/context/AuthContext';
import { ShieldCheck, Users, Trophy, DollarSign } from 'lucide-react';
import { formatCurrency, formatGameName } from '../../../shared/utils/utils';

interface JoinTournamentModalProps {
    isOpen: boolean;
    onClose: () => void;
    tournament: Tournament;
    profile: UserProfile;
    teamMembers?: any[];
    onSuccess: () => void;
}

const JoinTournamentModal: React.FC<JoinTournamentModalProps> = ({
    isOpen,
    onClose,
    tournament,
    profile,
    teamMembers: initialTeamMembers = [],
    onSuccess
}) => {
    const { user } = useAuth();
    const { showToast } = useNotification();
    const navigate = useNavigate();

    const [userTeams, setUserTeams] = useState<Team[]>([]);
    const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
    const [availableMembers, setAvailableMembers] = useState<TeamMember[]>([]);
    const [loadingTeams, setLoadingTeams] = useState(false);

    const [teammate1, setTeammate1] = useState('');
    const [teammate2, setTeammate2] = useState('');
    const [teammate3, setTeammate3] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && user) {
            fetchUserPermanentTeams();
        }
    }, [isOpen, user]);

    const fetchUserPermanentTeams = async () => {
        if (!user) return;
        setLoadingTeams(true);
        try {
            // Find teams owned by user or where user is a member
            const memberQ = query(collection(db, 'team_members'), where('userId', '==', user.uid));
            const memberSnap = await getDocs(memberQ);
            const teamIds = Array.from(new Set(memberSnap.docs.map(d => d.data().teamId)));

            const ownerQ = query(collection(db, 'teams'), where('ownerId', '==', user.uid));
            const ownerSnap = await getDocs(ownerQ);
            const ownedTeams = ownerSnap.docs.map(d => ({ id: d.id, ...d.data() } as Team));

            const fetchedTeams = [...ownedTeams];
            for (const tid of teamIds) {
                if (!fetchedTeams.some(t => t.id === tid)) {
                    const tDoc = await getDoc(doc(db, 'teams', tid));
                    if (tDoc.exists()) {
                        fetchedTeams.push({ id: tDoc.id, ...tDoc.data() } as Team);
                    }
                }
            }

            setUserTeams(fetchedTeams);
            if (fetchedTeams.length > 0) {
                setSelectedTeam(fetchedTeams[0]);
                fetchTeamRoster(fetchedTeams[0].id);
            } else if (initialTeamMembers.length > 0) {
                setAvailableMembers(initialTeamMembers);
            }
        } catch (err) {
            console.warn('Error loading user teams:', err);
        } finally {
            setLoadingTeams(false);
        }
    };

    const fetchTeamRoster = async (teamId: string) => {
        try {
            const membersQ = query(collection(db, 'team_members'), where('teamId', '==', teamId));
            const snap = await getDocs(membersQ);
            const members = snap.docs
                .map(d => ({ id: d.id, ...d.data() } as TeamMember))
                .filter(m => m.userId !== user?.uid); // Filter out captain (already in lineup)
            setAvailableMembers(members);
        } catch (err) {
            console.warn('Error loading team members:', err);
        }
    };

    const handleTeamChange = (teamId: string) => {
        const team = userTeams.find(t => t.id === teamId) || null;
        setSelectedTeam(team);
        setTeammate1('');
        setTeammate2('');
        setTeammate3('');
        if (team) {
            fetchTeamRoster(team.id);
        }
    };

    const handleSubmit = async () => {
        if (!user || !tournament || !profile) return;

        if (tournament.teamType === 'duo') {
            if (!teammate1) {
                showToast("Please select your teammate for Duo participation.", "warning");
                return;
            }
        }

        if (tournament.teamType === 'squad') {
            if (!teammate1 || !teammate2 || !teammate3) {
                showToast("Please select 3 teammates for Squad lineup.", "warning");
                return;
            }
            // Check for duplicate players
            const selectedNames = [teammate1, teammate2, teammate3];
            const uniqueNames = new Set(selectedNames);
            if (uniqueNames.size !== selectedNames.length) {
                showToast("Cannot select the same teammate multiple times.", "error");
                return;
            }
        }

        const teammates = tournament.teamType === 'duo'
            ? [teammate1]
            : tournament.teamType === 'squad'
            ? [teammate1, teammate2, teammate3]
            : [];

        const selectedPlayers = [profile.inGameName || profile.username, ...teammates];

        setLoading(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error('Authentication required');

            const teamId = selectedTeam?.id || profile.teamId || user.uid;
            const teamName = selectedTeam?.name || profile.teamName || profile.username || 'Registered Team';

            let joinedViaApi = false;
            try {
                const res = await fetch('/api/wallet/join-tournament', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({
                        tournamentId: tournament.id,
                        teammates,
                        teamId,
                        teamName,
                        selectedPlayers,
                    }),
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok && data.success !== false) {
                    joinedViaApi = true;
                }
            } catch {}

            if (!joinedViaApi) {
                if (Number(tournament.entryFee) > 0) {
                    throw new Error('Wallet service is currently unreachable. Please try again in a moment.');
                }
                // Free event fallback: save participant & assign slot directly
                const partRef = doc(collection(db, 'participants'));
                await setDoc(partRef, {
                    id: partRef.id,
                    tournamentId: tournament.id,
                    userId: user.uid,
                    username: profile.username || 'Team Leader',
                    inGameName: profile.inGameName || profile.username,
                    inGameId: profile.inGameId || 'N/A',
                    teamId,
                    teamName,
                    teammates,
                    selectedPlayers,
                    timestamp: serverTimestamp(),
                    status: 'confirmed',
                });

                if (Array.isArray(tournament.slots)) {
                    const normalized = normalizeScrimSlots(tournament.slots, (tournament as any).totalSlots || 12);
                    let slotAssigned = false;
                    const updated = normalized.map(s => {
                        if (!slotAssigned && s.status === 'open') {
                            slotAssigned = true;
                            return {
                                ...s,
                                status: 'filled' as const,
                                teamName,
                                teamId,
                                userId: user.uid,
                                leader: profile.username || profile.inGameName,
                            };
                        }
                        return s;
                    });
                    const filledCount = countFilledScrimSlots(updated);
                    await Promise.all([
                        updateDoc(doc(db, 'tournaments', tournament.id), { slots: updated, filledSlots: filledCount, currentPlayers: filledCount }).catch(() => {}),
                        updateDoc(doc(db, 'scrims', tournament.id), { slots: updated, filledSlots: filledCount, currentPlayers: filledCount }).catch(() => {}),
                    ]);
                }
            }

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
            showToast(e.message || 'Failed to join tournament', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Join ${tournament.teamType.toUpperCase()} Tournament`}>
            <div className="space-y-5">
                <div className="bg-brand-600/10 border border-brand-500/20 p-4 rounded-2xl">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center shadow-lg shadow-brand-600/20">
                            <Trophy className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-white font-black uppercase tracking-tight">{tournament.title}</h3>
                            <p className="text-[10px] text-brand-500 font-black uppercase tracking-widest">{formatGameName(tournament.game)} • {tournament.teamType.toUpperCase()}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-dark/50 p-2.5 rounded-xl border border-white/5">
                            <div className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Entry Fee</div>
                            <div className="text-white font-black text-sm">{tournament.entryFee > 0 ? formatCurrency(tournament.entryFee) : 'FREE'}</div>
                        </div>
                        <div className="bg-dark/50 p-2.5 rounded-xl border border-white/5">
                            <div className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Your Balance</div>
                            <div className={`text-sm font-black ${profile.balance >= (tournament.entryFee || 0) ? 'text-green-400' : 'text-red-400'}`}>
                                {formatCurrency(profile.balance || 0)}
                            </div>
                        </div>
                    </div>
                </div>

                {tournament.teamType !== 'solo' && userTeams.length > 0 && (
                    <div>
                        <label className="text-[10px] text-gray-500 uppercase font-black tracking-wider mb-2 block">
                            Select Permanent Team
                        </label>
                        <select
                            value={selectedTeam?.id || ''}
                            onChange={(e) => handleTeamChange(e.target.value)}
                            className="w-full bg-dark border border-gray-700 rounded-xl p-3 text-white focus:border-brand-500 focus-visible:outline-none font-bold text-sm"
                        >
                            {userTeams.map(t => (
                                <option key={t.id} value={t.id}>{t.name} ({t.tag || 'TEAM'})</option>
                            ))}
                        </select>
                    </div>
                )}

                {tournament.teamType === 'duo' && (
                    <div>
                        <label className="text-[10px] text-gray-500 uppercase font-black tracking-wider mb-2 block">
                            Select Duo Teammate
                        </label>
                        {availableMembers.length > 0 ? (
                            <select 
                                value={teammate1}
                                onChange={(e) => setTeammate1(e.target.value)}
                                className="w-full bg-dark border border-gray-700 rounded-xl p-3 text-white focus:border-brand-500 focus-visible:outline-none font-bold text-sm"
                            >
                                <option value="">Select teammate from roster</option>
                                {availableMembers.map(m => (
                                    <option key={m.id || m.userId} value={m.inGameName || m.username}>
                                        {m.inGameName || m.username} ({m.role || 'Member'})
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <input 
                                type="text" 
                                value={teammate1}
                                onChange={(e) => setTeammate1(e.target.value)}
                                className="w-full bg-dark border border-gray-700 rounded-xl p-3 text-white focus:border-brand-500 focus-visible:outline-none font-bold text-sm"
                                placeholder="Enter teammate in-game name"
                            />
                        )}
                    </div>
                )}

                {tournament.teamType === 'squad' && (
                    <div className="space-y-3">
                        <label className="text-[10px] text-gray-500 uppercase font-black tracking-wider block">
                            Select Squad Lineup (3 Teammates)
                        </label>

                        <div>
                            <span className="text-[9px] text-gray-400 font-bold block mb-1">Teammate #1</span>
                            {availableMembers.length > 0 ? (
                                <select 
                                    value={teammate1}
                                    onChange={(e) => setTeammate1(e.target.value)}
                                    className="w-full bg-dark border border-gray-700 rounded-xl p-3 text-white focus:border-brand-500 focus-visible:outline-none font-bold text-sm"
                                >
                                    <option value="">Select teammate</option>
                                    {availableMembers.map(m => (
                                        <option key={m.id || m.userId} value={m.inGameName || m.username}>
                                            {m.inGameName || m.username} ({m.role || 'Member'})
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <input 
                                    type="text" 
                                    value={teammate1}
                                    onChange={(e) => setTeammate1(e.target.value)}
                                    className="w-full bg-dark border border-gray-700 rounded-xl p-3 text-white focus:border-brand-500 focus-visible:outline-none font-bold text-sm"
                                    placeholder="Enter teammate 1 in-game name"
                                />
                            )}
                        </div>

                        <div>
                            <span className="text-[9px] text-gray-400 font-bold block mb-1">Teammate #2</span>
                            {availableMembers.length > 0 ? (
                                <select 
                                    value={teammate2}
                                    onChange={(e) => setTeammate2(e.target.value)}
                                    className="w-full bg-dark border border-gray-700 rounded-xl p-3 text-white focus:border-brand-500 focus-visible:outline-none font-bold text-sm"
                                >
                                    <option value="">Select teammate</option>
                                    {availableMembers.map(m => (
                                        <option key={m.id || m.userId} value={m.inGameName || m.username}>
                                            {m.inGameName || m.username} ({m.role || 'Member'})
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <input 
                                    type="text" 
                                    value={teammate2}
                                    onChange={(e) => setTeammate2(e.target.value)}
                                    className="w-full bg-dark border border-gray-700 rounded-xl p-3 text-white focus:border-brand-500 focus-visible:outline-none font-bold text-sm"
                                    placeholder="Enter teammate 2 in-game name"
                                />
                            )}
                        </div>

                        <div>
                            <span className="text-[9px] text-gray-400 font-bold block mb-1">Teammate #3</span>
                            {availableMembers.length > 0 ? (
                                <select 
                                    value={teammate3}
                                    onChange={(e) => setTeammate3(e.target.value)}
                                    className="w-full bg-dark border border-gray-700 rounded-xl p-3 text-white focus:border-brand-500 focus-visible:outline-none font-bold text-sm"
                                >
                                    <option value="">Select teammate</option>
                                    {availableMembers.map(m => (
                                        <option key={m.id || m.userId} value={m.inGameName || m.username}>
                                            {m.inGameName || m.username} ({m.role || 'Member'})
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <input 
                                    type="text" 
                                    value={teammate3}
                                    onChange={(e) => setTeammate3(e.target.value)}
                                    className="w-full bg-dark border border-gray-700 rounded-xl p-3 text-white focus:border-brand-500 focus-visible:outline-none font-bold text-sm"
                                    placeholder="Enter teammate 3 in-game name"
                                />
                            )}
                        </div>
                    </div>
                )}

                <div className="flex items-start gap-2.5 p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                    <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-gray-300 leading-relaxed">
                        Lineup is registered under your permanent team profile. Entry fee will be deducted from your wallet upon confirmation.
                    </p>
                </div>

                <div className="flex gap-3 pt-2">
                    <button type="button" 
                        onClick={onClose} 
                        disabled={loading}
                        className="flex-1 bg-surface hover:bg-surface/80 text-white py-3 rounded-xl font-black uppercase text-xs tracking-wider transition disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button type="button" 
                        onClick={handleSubmit} 
                        disabled={loading || profile.balance < (tournament.entryFee || 0)}
                        className="flex-1 bg-brand-600 hover:bg-brand-500 text-white py-3 rounded-xl font-black uppercase text-xs tracking-wider transition shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : 'Confirm Registration'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default JoinTournamentModal;
