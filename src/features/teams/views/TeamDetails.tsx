import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../shared/config/firebase';
import { useAuth } from '../../../shared/context/AuthContext';
import { useNotification } from '../../../shared/context/NotificationContext';
import { Team, TeamMember, UserProfile, TeamInvite, TeamActivity } from '../../../shared/types/types';
import {Users, UserPlus, Settings, LogOut, X, ArrowLeft, Crown, Activity, Globe, Calendar, Trophy, Zap, ChevronRight, Star, Camera, AlertCircle, Check, UserCheck} from 'lucide-react';
import { useInvisibleImage } from '../../../shared/hooks/useInvisibleImage';
import { MediaCategory } from '../../../shared/services/mediaService';
import { timeAgo, formatDate, formatCurrency } from '../../../shared/utils/utils';
import Modal from '../../../shared/components/Modal';
import { Seo } from '../../../shared/components/Seo';
import { commitFirestoreBatches, type FirestoreBatchOperation } from '../../../shared/utils/firestoreBatches';

const TeamDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user, profile } = useAuth();
    const { showToast } = useNotification();
    
    const [team, setTeam] = useState<Team | null>(null);
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [invites, setInvites] = useState<TeamInvite[]>([]);
    const [activities, setActivities] = useState<TeamActivity[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [editTag, setEditTag] = useState('');
    const [editDesc, setEditDesc] = useState('');
    const [editRegion, setEditRegion] = useState('');
    const [editLogo, setEditLogo] = useState('');
    const [editBanner, setEditBanner] = useState('');
    const [saving, setSaving] = useState(false);
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);
    const [isUploadingBanner, setIsUploadingBanner] = useState(false);
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        isDestructive?: boolean;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {}
    });

    const logoUpload = useInvisibleImage({
        folder: 'teams/logos',
        category: MediaCategory.TEAM_LOGO,
        onUploadStart: () => setIsUploadingLogo(true),
        onUploadEnd: () => setIsUploadingLogo(false),
        onUploadSuccess: (url) => setEditLogo(url)
    });

    const bannerUpload = useInvisibleImage({
        folder: 'teams/banners',
        category: MediaCategory.TEAM_BANNER,
        onUploadStart: () => setIsUploadingBanner(true),
        onUploadEnd: () => setIsUploadingBanner(false),
        onUploadSuccess: (url) => setEditBanner(url)
    });

    const [inviteUserId, setInviteUserId] = useState('');
    const [inviting, setInviting] = useState(false);
    const [respondingInvite, setRespondingInvite] = useState(false);

    useEffect(() => {
        if (id) {
            fetchTeamData();
        }
    }, [id]);

    const fetchTeamData = async () => {
        setLoading(true);
        setFetchError(null);
        try {
            if (!id) return;
            const teamDoc = await getDoc(doc(db, 'teams', id));
            if (!teamDoc.exists()) {
                showToast('Team not found', 'error');
                setLoading(false);
                return;
            }

            const teamData = { id: teamDoc.id, ...teamDoc.data() } as Team;
            setTeam(teamData);
            setEditName(teamData.name);
            setEditTag(teamData.tag || '');
            setEditDesc(teamData.description || '');
            setEditRegion(teamData.region || '');
            setEditLogo(teamData.logoUrl || '');
            setEditBanner(teamData.bannerUrl || '');

            const membersQ = query(collection(db, 'team_members'), where('teamId', '==', id));
            const membersSnap = await getDocs(membersQ);
            const membersData = membersSnap.docs.map(d => ({ id: d.id, ...d.data() } as TeamMember));
            
            const userIds = [...new Set(membersData.map(m => m.userId))];
            const userProfilesMap: Record<string, UserProfile> = {};
            
            if (userIds.length > 0) {
                const chunks = [];
                for (let i = 0; i < userIds.length; i += 10) {
                    chunks.push(userIds.slice(i, i + 10));
                }
                
                for (const chunk of chunks) {
                    const q = query(collection(db, 'users_public'), where('__name__', 'in', chunk));
                    const usersSnap = await getDocs(q);
                    usersSnap.docs.forEach(doc => {
                        userProfilesMap[doc.id] = { uid: doc.id, ...doc.data() } as UserProfile;
                    });
                }
            }

            const membersWithProfiles = membersData.map(m => {
                if (userProfilesMap[m.userId]) {
                    return { ...m, user: userProfilesMap[m.userId] };
                }
                return m;
            });
            setMembers(membersWithProfiles);

            if (user) {
                try {
                    let invitesQ;
                    if (user.uid === teamData.ownerId || profile?.role === 'admin') {
                        invitesQ = query(collection(db, 'team_invites'), where('teamId', '==', id), where('status', '==', 'pending'));
                    } else {
                        invitesQ = query(collection(db, 'team_invites'), where('teamId', '==', id), where('inviteeId', '==', user.uid), where('status', '==', 'pending'));
                    }
                    const invitesSnap = await getDocs(invitesQ);
                    setInvites(invitesSnap.docs.map(d => ({ id: d.id, ...(d.data() as object) } as TeamInvite)));
                } catch (err) {
                    console.error("Error fetching invites:", err);
                    setInvites([]);
                }
            } else {
                setInvites([]);
            }

            const activitiesQ = query(collection(db, 'team_activity'), where('teamId', '==', id));
            const activitiesSnap = await getDocs(activitiesQ);
            const acts = activitiesSnap.docs.map(d => ({ id: d.id, ...(d.data() as object) } as TeamActivity));
            acts.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
            setActivities(acts);

        } catch (error: any) {
            console.error("Error fetching team:", error);
            setFetchError(error?.message || "Something went wrong while loading this team.");
        } finally {
            setLoading(false);
        }
    };

    const logActivity = async (action: string, details?: string) => {
        if (!team || !user) return;
        try {
            await addDoc(collection(db, 'team_activity'), {
                teamId: team.id,
                userId: user.uid,
                userName: profile?.username || user?.username || 'User',
                action,
                details,
                createdAt: serverTimestamp()
            });
        } catch (e) {
            console.error("Failed to log activity", e);
        }
    };

    const handleSaveTeam = async () => {
        if (!team || !editName.trim()) return;
        setSaving(true);
        try {
            await updateDoc(doc(db, 'teams', team.id), {
                name: editName,
                tag: editTag,
                description: editDesc,
                region: editRegion,
                logoUrl: editLogo,
                bannerUrl: editBanner
            });
            await logActivity('updated_team', 'Updated team profile settings');
            showToast('Team updated successfully', 'success');
            setIsEditing(false);
            fetchTeamData();
        } catch (error: any) {
            console.error("Error updating team:", error);
            showToast('Failed to update team', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleInvite = async () => {
        if (!team || !user || !inviteUserId.trim()) return;
        if (members.length >= 6) {
            showToast('Team is full (max 6 players)', 'error');
            return;
        }
        setInviting(true);
        try {
            const userDoc = await getDoc(doc(db, 'users_public', inviteUserId));
            if (!userDoc.exists()) {
                showToast('User not found', 'error');
                setInviting(false);
                return;
            }
            if (members.some(m => m.userId === inviteUserId)) {
                showToast('User is already a member', 'warning');
                setInviting(false);
                return;
            }
            if (invites.some(i => i.inviteeId === inviteUserId)) {
                showToast('User already has a pending invite', 'warning');
                setInviting(false);
                return;
            }
            await addDoc(collection(db, 'team_invites'), {
                teamId: team.id,
                teamName: team.name,
                inviterId: user.uid,
                inviteeId: inviteUserId,
                status: 'pending',
                createdAt: serverTimestamp()
            });
            await addDoc(collection(db, 'notifications'), {
                userId: inviteUserId,
                title: 'Team Invitation',
                message: `You have been invited to join ${team.name}`,
                type: 'invite',
                read: false,
                link: `/team/${team.id}`,
                timestamp: serverTimestamp()
            });
            await logActivity('invited_user', `Invited user ${userDoc.data().username}`);
            showToast('Invitation sent!', 'success');
            setInviteUserId('');
            fetchTeamData();
        } catch (error: any) {
            console.error("Error sending invite:", error);
            showToast('Failed to send invite', 'error');
        } finally {
            setInviting(false);
        }
    };

    const handleAcceptInvite = async (invite: TeamInvite) => {
        if (!team || !user || !profile) return;

        // Guard: check if user already belongs to ANY team (query team_members, not just local profile)
        if (profile.teamId && profile.teamId !== team.id) {
            showToast('You must leave your current team before joining another', 'warning');
            return;
        }
        setRespondingInvite(true);
        try {
            // Double-check membership in Firestore (handles stale profile / race conditions)
            const existingMembershipQ = query(
                collection(db, 'team_members'),
                where('userId', '==', user.uid)
            );
            const existingMembershipSnap = await getDocs(existingMembershipQ);
            if (!existingMembershipSnap.empty) {
                const existingTeamId = existingMembershipSnap.docs[0].data().teamId;
                if (existingTeamId === team.id) {
                    showToast('You are already a member of this team', 'warning');
                } else {
                    showToast('You must leave your current team before joining another', 'warning');
                }
                setRespondingInvite(false);
                return;
            }

            // Check team is not full (re-fetch to avoid stale count)
            const currentMembersQ = query(collection(db, 'team_members'), where('teamId', '==', team.id));
            const currentMembersSnap = await getDocs(currentMembersQ);
            if (currentMembersSnap.size >= 6) {
                showToast('Team is full (max 6 players)', 'error');
                setRespondingInvite(false);
                return;
            }
            // 1. Mark invite as accepted
            await updateDoc(doc(db, 'team_invites', invite.id), { status: 'accepted' });

            // 2. Create team_members doc (inviteId required by Firestore rules canJoinTeam())
            await addDoc(collection(db, 'team_members'), {
                teamId: team.id,
                userId: user.uid,
                username: profile.username || '',
                inGameName: profile.inGameName || '',
                role: 'member',
                inviteId: invite.id,
                joinedAt: serverTimestamp()
            });

            // 3. Update user profile with team info
            await updateDoc(doc(db, 'users', user.uid), {
                teamName: team.name,
                teamId: team.id
            });
            await setDoc(doc(db, 'users_public', user.uid), {
                teamName: team.name,
                teamId: team.id
            }, { merge: true });

            // 4. Log activity
            await addDoc(collection(db, 'team_activity'), {
                teamId: team.id,
                userId: user.uid,
                userName: profile.username || 'User',
                action: 'joined_team',
                details: 'Joined the team via invite',
                createdAt: serverTimestamp()
            });

            // 5. Notify team owner
            await addDoc(collection(db, 'notifications'), {
                userId: team.ownerId,
                title: 'New Team Member',
                message: `${profile.username || 'A player'} has accepted your invite and joined ${team.name}!`,
                type: 'success',
                read: false,
                link: `/team/${team.id}`,
                timestamp: serverTimestamp()
            });

            showToast(`You have joined ${team.name}!`, 'success');
            fetchTeamData();
        } catch (error: any) {
            console.error('Error accepting invite:', error);
            showToast('Failed to accept invite', 'error');
        } finally {
            setRespondingInvite(false);
        }
    };

    const handleDeclineInvite = async (invite: TeamInvite) => {
        if (!team || !user) return;
        setRespondingInvite(true);
        try {
            await updateDoc(doc(db, 'team_invites', invite.id), { status: 'declined' });
            showToast('Invite declined', 'info');
            fetchTeamData();
        } catch (error: any) {
            console.error('Error declining invite:', error);
            showToast('Failed to decline invite', 'error');
        } finally {
            setRespondingInvite(false);
        }
    };

    const handleLeaveTeam = () => {
        if (!team || !user || !currentUserMember) return;
        setConfirmModal({
            isOpen: true,
            title: 'Leave Team',
            message: 'Are you sure you want to leave this team? You will lose access to team-only tournaments.',
            onConfirm: executeLeaveTeam,
            isDestructive: true
        });
    };

    const executeLeaveTeam = async () => {
        if (!team || !user || !currentUserMember) return;
        setSaving(true);
        try {
            await deleteDoc(doc(db, 'team_members', currentUserMember.id));
            if (profile?.teamId === team.id) {
                await updateDoc(doc(db, 'users', user.uid), { teamName: '', teamId: '' });
                await setDoc(doc(db, 'users_public', user.uid), { teamName: '', teamId: '' }, { merge: true });
            }
            await logActivity('left_team', 'Left the team');
            showToast('You have left the team', 'info');
            navigate('/teams');
        } catch (error: any) {
            console.error("Error leaving team:", error);
            showToast('Failed to leave team', 'error');
        } finally {
            setSaving(false);
            setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
    };

    const handleDeleteTeam = () => {
        if (!team || !user || !isOwner) return;
        setConfirmModal({
            isOpen: true,
            title: 'Delete Team',
            message: 'CRITICAL: This will permanently delete the team and remove all members. This action cannot be undone.',
            onConfirm: executeDeleteTeam,
            isDestructive: true
        });
    };

    const executeDeleteTeam = async () => {
        if (!team || !user || !isOwner) return;
        setSaving(true);
        try {
            const membersQ = query(collection(db, 'team_members'), where('teamId', '==', team.id));
            const membersSnap = await getDocs(membersQ);
            const operations: FirestoreBatchOperation[] = [];
            membersSnap.docs.forEach(memberDoc => {
                const memberData = memberDoc.data();
                const memberUserId = memberData.userId;
                operations.push(batch => batch.delete(memberDoc.ref));
                operations.push(batch => batch.update(doc(db, 'users', memberUserId), { teamName: '', teamId: '' }));
                operations.push(batch => batch.set(doc(db, 'users_public', memberUserId), { teamName: '', teamId: '' }, { merge: true }));
                if (memberUserId !== user.uid) {
                    const notificationRef = doc(collection(db, 'notifications'));
                    operations.push(batch => batch.set(notificationRef, {
                        userId: memberUserId,
                        title: 'Team Disbanded',
                        message: `The team "${team.name}" has been disbanded by the owner.`,
                        type: 'alert',
                        read: false,
                        timestamp: serverTimestamp()
                    }));
                }
            });
            const invitesQ = query(collection(db, 'team_invites'), where('teamId', '==', team.id));
            const invitesSnap = await getDocs(invitesQ);
            invitesSnap.docs.forEach(invite => operations.push(batch => batch.delete(invite.ref)));
            const activityQ = query(collection(db, 'team_activity'), where('teamId', '==', team.id));
            const activitySnap = await getDocs(activityQ);
            activitySnap.docs.forEach(activity => operations.push(batch => batch.delete(activity.ref)));
            await commitFirestoreBatches(db, operations);
            await deleteDoc(doc(db, 'teams', team.id));
            showToast('Team deleted successfully', 'success');
            navigate('/teams');
        } catch (error: any) {
            console.error("Error deleting team:", error);
            showToast('Failed to delete team', 'error');
        } finally {
            setSaving(false);
            setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
    };

    const handleRemoveMember = (memberId: string, memberName: string, memberUserId: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Remove Member',
            message: `Are you sure you want to remove ${memberName} from the team?`,
            onConfirm: () => executeRemoveMember(memberId, memberName, memberUserId),
            isDestructive: true
        });
    };

    const executeRemoveMember = async (memberId: string, memberName: string, memberUserId: string) => {
        try {
            await deleteDoc(doc(db, 'team_members', memberId));
            await updateDoc(doc(db, 'users', memberUserId), { teamName: '', teamId: '' });
            await setDoc(doc(db, 'users_public', memberUserId), { teamName: '', teamId: '' }, { merge: true });
            await logActivity('removed_member', `Removed ${memberName} from the team`);
            showToast('Member removed', 'success');
            fetchTeamData();
        } catch (error) {
            console.error("Error removing member:", error);
            showToast('Failed to remove member', 'error');
        } finally {
            setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
    };

    if (loading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-xs text-gray-500 font-black uppercase tracking-widest">Loading Team...</p>
            </div>
        );
    }

    if (fetchError) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center gap-4 px-4">
                <AlertCircle className="w-14 h-14 text-red-400" />
                <p className="text-sm text-gray-400 font-bold max-w-md">{fetchError}</p>
                <button
                    onClick={fetchTeamData}
                    className="px-6 py-3 bg-brand-500 hover:bg-brand-600 text-black font-black uppercase tracking-widest rounded-xl transition"
                >
                    Try Again
                </button>
            </div>
        );
    }

    if (!team) {
        return (
            <div className="text-center py-20">
                <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-4">Team Not Found</h2>
                <Link to="/teams" className="text-brand-500 hover:text-brand-400 font-bold flex items-center justify-center gap-2 py-2 touch-target">
                    <ArrowLeft className="w-4 h-4" /> Back to Teams
                </Link>
            </div>
        );
    }

    const isOwner = user?.uid === team.ownerId;
    const currentUserMember = members.find(m => m.userId === user?.uid);
    const isAdmin = isOwner || currentUserMember?.role === 'admin';
    const isMember = !!currentUserMember;
    const pendingInviteForCurrentUser = !isMember ? invites.find(i => i.inviteeId === user?.uid && i.status === 'pending') : undefined;

    return (
        <div className="max-w-6xl mx-auto animate-fade-in pb-20 px-4">
            <Seo
                title="Esports Team | NexPlay"
                description="View esports team roster, stats, and tournament history on NexPlay"
                canonicalPath={`/team/${id}`}
                jsonLd={{
                    "@context": "https://schema.org",
                    "@type": "SportsTeam",
                    "name": team?.name || "Esports Team",
                    "sport": "Esports",
                    "url": `https://www.nexplayorg.app/team/${id}`,
                    "description": "View esports team roster, stats, and tournament history on NexPlay"
                }}
            />
            {/* Breadcrumbs & Back Button */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-500">
                    <Link to="/leaderboard" className="hover:text-brand-400 transition">Leaderboard</Link>
                    <ChevronRight className="w-3 h-3" />
                    <span className="text-white">Team Details</span>
                </div>
                <button type="button" 
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-gray-400 hover:text-white font-bold text-xs uppercase tracking-widest transition py-2 touch-target"
                >
                    <ArrowLeft className="w-4 h-4" /> Back
                </button>
            </div>

            {/* Team Hero Section */}
            <div className="bg-card rounded-3xl border border-gray-800 overflow-hidden shadow-2xl mb-8 relative">
                <div className="h-56 bg-gradient-to-r from-brand-900 via-purple-900 to-black relative">
                    {team.bannerUrl && (
                        <img src={team.bannerUrl || undefined} alt="Banner" className="w-full h-full object-cover opacity-50" loading="lazy" />
                    )}
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"></div>
                    <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
                </div>
                
                <div className="px-8 pb-8 relative">
                    <div className="flex flex-col md:flex-row items-start sm:items-end gap-8 -mt-20 relative z-10">
                        <div className="w-40 h-40 rounded-3xl border-4 border-card bg-dark overflow-hidden shadow-2xl flex items-center justify-center bg-gradient-to-br from-brand-600 to-purple-800 text-5xl font-black text-white shrink-0">
                            {team.logoUrl ? (
                                <img src={team.logoUrl || undefined} className="w-full h-full object-cover" alt="Logo" loading="lazy" />
                            ) : (
                                <Users className="w-16 h-16 text-white/50" />
                            )}
                        </div>
                        <div className="flex-grow pb-2 w-full">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight">{team.name}</h1>
                                        <span className="bg-brand-500/20 text-brand-400 text-[10px] font-black px-2 py-1 rounded border border-brand-500/30 uppercase tracking-widest">
                                            {team.tag || 'TEAM'}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-4 text-sm font-bold text-gray-400 mb-4">
                                        <div className="flex items-center gap-2"><Globe className="w-4 h-4" /> {team.region || 'Global'}</div>
                                        <div className="flex items-center gap-2"><Calendar className="w-4 h-4" /> Founded {team.formationDate ? formatDate(team.formationDate) : 'Recently'}</div>
                                        <div className="flex items-center gap-2 text-brand-400"><Trophy className="w-4 h-4" /> {formatCurrency(team.totalEarnings, 'NPR ')} Total Prize</div>
                                    </div>
                                    <p className="text-gray-400 font-medium max-w-2xl line-clamp-2">{team.description || 'No description provided.'}</p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    {isAdmin && !isEditing && (
                                        <button type="button" 
                                            onClick={() => setIsEditing(true)}
                                            className="bg-surface hover:bg-surface text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition flex items-center gap-2 border border-gray-700"
                                        >
                                            <Settings className="w-4 h-4" /> Settings
                                        </button>
                                    )}
                                    {isOwner && !isEditing && (
                                        <button type="button" 
                                            onClick={handleDeleteTeam}
                                            disabled={saving}
                                            className="bg-red-600/20 hover:bg-red-600/30 text-red-500 px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition flex items-center gap-2 border border-red-500/20"
                                        >
                                            <X className="w-4 h-4" /> {saving ? 'Deleting...' : 'Delete Team'}
                                        </button>
                                    )}
                                    {isMember && !isOwner && (
                                        <button type="button" 
                                            onClick={handleLeaveTeam}
                                            className="bg-red-600/20 hover:bg-red-600/30 text-red-500 px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition flex items-center gap-2 border border-red-500/20"
                                        >
                                            <LogOut className="w-4 h-4" /> Leave Team
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Invite Banner for Invited Users */}
            {pendingInviteForCurrentUser && (
                <div className="bg-gradient-to-r from-brand-900/60 via-purple-900/40 to-brand-900/60 rounded-3xl border border-brand-500/30 p-6 mb-8 shadow-2xl animate-fade-in">
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                        <div className="w-16 h-16 rounded-2xl bg-brand-500/20 flex items-center justify-center border border-brand-500/30 shrink-0">
                            <UserCheck className="w-8 h-8 text-brand-400" />
                        </div>
                        <div className="flex-grow text-center sm:text-left">
                            <h3 className="text-xl font-black text-white uppercase tracking-wider mb-1">You're Invited!</h3>
                            <p className="text-gray-300 font-medium">You've been invited to join <span className="text-brand-400 font-black">{team.name}</span>. Accept to become a team member.</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => handleDeclineInvite(pendingInviteForCurrentUser)}
                                disabled={respondingInvite}
                                className="bg-red-600/20 hover:bg-red-600/30 text-red-400 px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition flex items-center gap-2 border border-red-500/20 disabled:opacity-50"
                            >
                                <X className="w-4 h-4" /> Decline
                            </button>
                            <button
                                type="button"
                                onClick={() => handleAcceptInvite(pendingInviteForCurrentUser)}
                                disabled={respondingInvite}
                                className="bg-brand-600 hover:bg-brand-500 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition flex items-center gap-2 shadow-lg shadow-brand-500/25 disabled:opacity-50"
                            >
                                <Check className="w-4 h-4" /> {respondingInvite ? 'Joining...' : 'Accept & Join'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Team Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                    { label: 'Team Points', value: team.points || 0, icon: Star, color: 'text-yellow-500' },
                    { label: 'Total Wins', value: team.wins || 0, icon: Trophy, color: 'text-brand-500' },
                    { label: 'Rank Position', value: `#${team.ranking || 'N/A'}`, icon: Zap, color: 'text-purple-500' },
                    { label: 'Total Earnings', value: formatCurrency(team.totalEarnings), icon: Trophy, color: 'text-green-500' }
                ].map((stat, i) => (
                    <div key={i} className="bg-card p-6 rounded-3xl border border-gray-800 shadow-lg hover:border-gray-700 transition group">
                        <div className={`p-2 rounded-xl bg-white/5 w-fit mb-3 group-hover:scale-110 transition-transform`}>
                            <stat.icon className={`w-5 h-5 ${stat.color}`} />
                        </div>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{stat.label}</p>
                        <p className="text-xl font-black text-white">{stat.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* Roster List */}
                    <div className="bg-card rounded-3xl border border-gray-800 overflow-hidden shadow-xl">
                        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
                            <h3 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
                                <Users className="w-5 h-5 text-brand-500" /> Team Roster ({members.length}/6)
                            </h3>
                            {isAdmin && (
                                <button type="button" onClick={() => setInviteUserId('')} className="text-brand-400 hover:text-brand-300 text-xs font-black uppercase tracking-widest flex items-center gap-1 py-2 touch-target">
                                    <UserPlus className="w-4 h-4" /> Invite
                                </button>
                            )}
                        </div>
                        <div className="divide-y divide-gray-800">
                            {members.map(member => (
                                <div key={member.id} className="p-6 flex items-center justify-between hover:bg-white/5 transition group">
                                    <div className="flex items-center gap-4">
                                        <Link to={`/user/${member.userId}`} className="w-14 h-14 rounded-2xl bg-surface overflow-hidden border-2 border-gray-700 group-hover:border-brand-500 transition shrink-0">
                                            {member.user?.profilePicUrl ? (
                                                <img src={member.user.profilePicUrl || undefined} alt={member.user.username} className="w-full h-full object-cover" loading="lazy" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-500 font-black text-xl">
                                                    {member.user?.username?.[0]?.toUpperCase() || '?'}
                                                </div>
                                            )}
                                        </Link>
                                        <div>
                                            <Link to={`/user/${member.userId}`} className="font-black text-white hover:text-brand-400 transition text-lg flex items-center gap-2">
                                                {member.user?.username || 'Unknown User'}
                                                {member.userId === team.ownerId && <Crown className="w-4 h-4 text-yellow-500" />}
                                            </Link>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${member.role === 'admin' ? 'bg-brand-500/20 text-brand-400' : 'bg-surface text-gray-500'}`}>
                                                    {member.roleInTeam || (member.userId === team.ownerId ? 'Captain' : 'Member')}
                                                </span>
                                                {member.user?.status === 'online' && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-4">
                                        <div className="text-right hidden sm:block">
                                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Joined</p>
                                            <p className="text-xs font-bold text-white">{member.joinedAt ? formatDate(member.joinedAt) : 'N/A'}</p>
                                        </div>
                                        {isAdmin && member.userId !== team.ownerId && (
                                            <button type="button" 
                                                onClick={() => handleRemoveMember(member.id, member.user?.username || 'Unknown User', member.userId)}
                                                className="text-gray-500 hover:text-red-500 p-2 rounded-xl hover:bg-red-500/10 transition opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Activity Feed */}
                    <div className="bg-card rounded-3xl border border-gray-800 overflow-hidden shadow-xl">
                        <div className="p-6 border-b border-gray-800">
                            <h3 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
                                <Activity className="w-5 h-5 text-brand-500" /> Team Activity
                            </h3>
                        </div>
                        <div className="p-6 space-y-4">
                            {activities.length > 0 ? (
                                activities.map(act => (
                                    <div key={act.id} className="flex gap-4 items-start bg-dark p-4 rounded-2xl border border-gray-800">
                                        <div className="w-10 h-10 rounded-xl bg-brand-900/50 flex items-center justify-center shrink-0 border border-brand-500/30">
                                            <Activity className="w-5 h-5 text-brand-400" />
                                        </div>
                                        <div className="flex-grow">
                                            <p className="text-sm text-gray-300">
                                                <span className="font-black text-white">{act.userName}</span> {act.details || act.action}
                                            </p>
                                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">
                                                {act.createdAt ? timeAgo(act.createdAt.toDate()) : 'Just now'}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8 text-gray-500 font-bold uppercase tracking-widest text-xs">
                                    No recent activity
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    {/* Invite Section */}
                    {isAdmin && (
                        <div className="bg-card rounded-3xl border border-gray-800 p-6 shadow-xl">
                            <h3 className="text-lg font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                                <UserPlus className="w-5 h-5 text-brand-500" /> Recruit Players
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 block">Player User ID</label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            value={inviteUserId}
                                            onChange={(e) => setInviteUserId(e.target.value)}
                                            placeholder="Paste ID..."
                                            className="flex-grow bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 focus-visible:outline-none transition text-sm font-mono"
                                        />
                                        <button type="button" 
                                            onClick={handleInvite}
                                            disabled={inviting || !inviteUserId.trim()}
                                            className="bg-brand-600 hover:bg-brand-500 disabled:bg-surface text-white px-4 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition shrink-0"
                                        >
                                            {inviting ? '...' : 'Invite'}
                                        </button>
                                    </div>
                                </div>
                                
                                {invites.length > 0 && (
                                    <div className="mt-6 pt-4 border-t border-gray-800">
                                        <h4 className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-3">Pending Invites</h4>
                                        <div className="space-y-2">
                                            {invites.map(invite => (
                                                <div key={invite.id} className="flex items-center justify-between bg-dark p-3 rounded-xl border border-gray-800">
                                                    <span className="text-xs font-bold text-white truncate max-w-[120px]">{invite.inviteeId}</span>
                                                    {invite.inviteeId === user?.uid ? (
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeclineInvite(invite)}
                                                                disabled={respondingInvite}
                                                                className="text-[10px] font-black uppercase tracking-widest bg-red-500/20 text-red-400 px-2 py-0.5 rounded hover:bg-red-500/30 transition disabled:opacity-50"
                                                            >
                                                                Decline
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleAcceptInvite(invite)}
                                                                disabled={respondingInvite}
                                                                className="text-[10px] font-black uppercase tracking-widest bg-brand-500/20 text-brand-400 px-2 py-0.5 rounded hover:bg-brand-500/30 transition disabled:opacity-50"
                                                            >
                                                                {respondingInvite ? '...' : 'Accept'}
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] font-black uppercase tracking-widest bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded">Pending</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Team Info */}
                    <div className="bg-card p-6 rounded-3xl border border-gray-800 shadow-xl">
                        <h3 className="text-lg font-black text-white uppercase tracking-widest mb-4">Team Info</h3>
                        <div className="space-y-4">
                            <div>
                                <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest block mb-1">Region</span>
                                <div className="text-white font-bold">{team.region || 'Global'}</div>
                            </div>
                            <div>
                                <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest block mb-1">Total Members</span>
                                <div className="text-white font-bold">{members.length} / 6</div>
                            </div>
                            <div>
                                <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest block mb-1">Formation Date</span>
                                <div className="text-white font-bold">{team.formationDate ? formatDate(team.formationDate) : 'N/A'}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit Team Modal */}
            <Modal isOpen={isEditing} onClose={() => setIsEditing(false)} title="Edit Team Profile">
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 block">Team Name</label>
                                <input 
                                    type="text" 
                                    value={editName} 
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 focus-visible:outline-none transition font-bold"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 block">Team Tag</label>
                                <input 
                                    type="text" 
                                    value={editTag} 
                                    onChange={(e) => setEditTag(e.target.value)}
                                    placeholder="e.g. NXP"
                                    className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 focus-visible:outline-none transition font-bold"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 block">Region</label>
                                <input 
                                    type="text" 
                                    value={editRegion} 
                                    onChange={(e) => setEditRegion(e.target.value)}
                                    placeholder="e.g. Nepal, Asia"
                                    className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 focus-visible:outline-none transition font-bold"
                                />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 block">Description</label>
                                <textarea 
                                    value={editDesc} 
                                    onChange={(e) => setEditDesc(e.target.value)}
                                    className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 focus-visible:outline-none transition h-32 resize-none text-sm"
                                />
                            </div>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 block">Logo URL or Paste/Drop/Browse</label>
                            <div className="relative group">
                                <input 
                                    type="text" 
                                    value={editLogo} 
                                    onChange={(e) => setEditLogo(e.target.value)}
                                    onPaste={logoUpload.handlePaste}
                                    onDrop={logoUpload.handleDrop}
                                    onDragOver={logoUpload.handleDragOver}
                                    placeholder={isUploadingLogo ? "Uploading..." : "Paste URL/Image or click to Browse"}
                                    disabled={isUploadingLogo}
                                    className={`w-full bg-dark border ${isUploadingLogo ? 'border-brand-500' : 'border-gray-700 focus:border-brand-500'} rounded-xl px-4 py-3 text-white focus-visible:outline-none transition text-xs font-mono pr-16`}
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => document.getElementById('edit-logo-file-input')?.click()}
                                        className="text-gray-500 hover:text-brand-500 transition-colors p-2.5 touch-target"
                                        title="Browse image file"
                                    >
                                        <Camera className="w-4 h-4" />
                                    </button>
                                    {isUploadingLogo && (
                                        <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                                    )}
                                </div>
                                <input 
                                    id="edit-logo-file-input"
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                        if (e.target.files?.[0]) {
                                            logoUpload.processAndUpload(e.target.files[0]);
                                        }
                                    }}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-2 block">Banner URL or Paste/Drop/Browse</label>
                            <div className="relative group">
                                <input 
                                    type="text" 
                                    value={editBanner} 
                                    onChange={(e) => setEditBanner(e.target.value)}
                                    onPaste={bannerUpload.handlePaste}
                                    onDrop={bannerUpload.handleDrop}
                                    onDragOver={bannerUpload.handleDragOver}
                                    placeholder={isUploadingBanner ? "Uploading..." : "Paste URL/Image or click to Browse"}
                                    disabled={isUploadingBanner}
                                    className={`w-full bg-dark border ${isUploadingBanner ? 'border-brand-500' : 'border-gray-700 focus:border-brand-500'} rounded-xl px-4 py-3 text-white focus-visible:outline-none transition text-xs font-mono pr-16`}
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => document.getElementById('edit-banner-file-input')?.click()}
                                        className="text-gray-500 hover:text-brand-500 transition-colors p-2.5 touch-target"
                                        title="Browse image file"
                                    >
                                        <Camera className="w-4 h-4" />
                                    </button>
                                    {isUploadingBanner && (
                                        <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                                    )}
                                </div>
                                <input 
                                    id="edit-banner-file-input"
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                        if (e.target.files?.[0]) {
                                            bannerUpload.processAndUpload(e.target.files[0]);
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-800">
                        <button type="button" 
                            onClick={() => setIsEditing(false)}
                            className="px-6 py-3 rounded-xl font-bold text-gray-400 hover:text-white transition"
                        >
                            Cancel
                        </button>
                        <button type="button" 
                            onClick={handleSaveTeam}
                            disabled={saving || !editName.trim()}
                            className="bg-brand-600 hover:bg-brand-500 text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest transition shadow-lg"
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Confirmation Modal */}
            <Modal isOpen={confirmModal.isOpen} onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))} title={confirmModal.title}>
                <div className="p-2">
                    <p className="text-gray-400 mb-8 leading-relaxed">{confirmModal.message}</p>
                    <div className="flex justify-end gap-3">
                        <button type="button" 
                            onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                            className="px-6 py-3 rounded-xl font-bold text-gray-400 hover:text-white transition"
                        >
                            Cancel
                        </button>
                        <button type="button" 
                            onClick={confirmModal.onConfirm}
                            className={`${confirmModal.isDestructive ? 'bg-red-600 hover:bg-red-500' : 'bg-brand-600 hover:bg-brand-500'} text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest transition shadow-lg`}
                        >
                            Confirm
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default TeamDetails;
