import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../../shared/config/firebase';
import { Tournament, UserProfile } from '../../../shared/types/types';
import { DEFAULT_BANNER } from '../../../shared/constants/constants';
import { useAuth } from '../../../shared/context/AuthContext';
import { formatCurrency, formatDate, formatGameName, getYoutubeId, toDateSafe, sanitizeUrl } from '../../../shared/utils/utils';
import { getSlotCount, getFilledSlotCount } from '../../../shared/utils/scrimSlots';
import { Clock, Users, Trophy, Lock, Eye, EyeOff, Play, Share2, Calendar, MapPin, Info, Medal, ExternalLink, ChevronRight, AlertCircle, CheckCircle2, Search, Building2 , Target, Trash2, Settings2, AlertTriangle, ShieldAlert } from 'lucide-react';
import RegistrationModal from '../components/RegistrationModal';
import JoinTournamentModal from '../components/JoinTournamentModal';
import { TournamentDisputeModal } from '../components/TournamentDisputeModal';
import Modal from '../../../shared/components/Modal';
import { motion, AnimatePresence } from 'motion/react';
import { NotificationService } from '../../../shared/services/NotificationService';
import { useNotification } from '../../../shared/context/NotificationContext';
import Seo from '../../../shared/components/Seo';
import ProfileLink from '../../profile/components/ProfileLink';
import PrizeBoard from '../components/PrizeBoard';
import ScoringInfoCard from '../components/ScoringInfoCard';
import TournamentResultModal from '../components/TournamentResultModal';
import PerKillResultView from '../components/PerKillResultView';
import PerKillLeaderboard from '../components/PerKillLeaderboard';
import { TournamentRoadmap } from '../components/TournamentRoadmap';
import GroupStandingsView from '../components/GroupStandingsView';
import { fetchRoomCredentials } from '../../../shared/services/roomCredentials';

const TOURNAMENT_TAB_IDS = ['overview', 'description', 'participants', 'groups', 'roadmap', 'results', 'killrewards'] as const;
type TournamentTabId = typeof TOURNAMENT_TAB_IDS[number];

const getTournamentTab = (value: string | null): TournamentTabId =>
    TOURNAMENT_TAB_IDS.includes(value as TournamentTabId) ? value as TournamentTabId : 'overview';

export default function TournamentDetails() {
    const { id } = useParams<{ id: string }>();
    const { user, profile } = useAuth();
    const { showToast } = useNotification();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [isJoined, setIsJoined] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TournamentTabId>(() => getTournamentTab(searchParams.get('tab')));
    const [isResultModalOpen, setIsResultModalOpen] = useState(false);
    const [participants, setParticipants] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [relatedTournaments, setRelatedTournaments] = useState<Tournament[]>([]);
    const [metaError, setMetaError] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [showRegistrationModal, setShowRegistrationModal] = useState(false);
    const [teamMembers, setTeamMembers] = useState<any[]>([]);
    const [showPassword, setShowPassword] = useState(false);
    const [roomCreds, setRoomCreds] = useState<{ roomId?: string; roomPass?: string } | null>(null);
    const [hostProfile, setHostProfile] = useState<UserProfile | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showDisputeModal, setShowDisputeModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const [eventCollection, setEventCollection] = useState<'tournaments' | 'scrims'>('tournaments');

    const isHostOrAdmin = Boolean(
        (user && tournament && (
            tournament.hostUid === user.uid ||
            (tournament as any).orgId === user.uid ||
            (tournament as any).hostId === user.uid ||
            (tournament as any).userId === user.uid ||
            (tournament as any).createdBy === user.uid
        )) ||
        profile?.role === 'admin' ||
        user?.role === 'admin'
    );

    useEffect(() => {
        if (!id) return;
        setLoading(true);

        let unsubScrims: (() => void) | null = null;

        // 1. Core Tournament Listener (Real-time & Self-healing with fallback to 'scrims')
        const unsubTournament = onSnapshot(doc(db, 'tournaments', id), (snapshot) => {
            if (snapshot.exists()) {
                const tData = { id: snapshot.id, ...snapshot.data() } as Tournament;
                setTournament(tData);
                setEventCollection('tournaments');
                setLoading(false);
            } else {
                // Fallback to legacy 'scrims' collection
                unsubScrims = onSnapshot(doc(db, 'scrims', id), (scrimSnap) => {
                    if (scrimSnap.exists()) {
                        const sData = { id: scrimSnap.id, ...scrimSnap.data(), matchType: 'scrims' } as Tournament;
                        setTournament(sData);
                        setEventCollection('scrims');
                        setLoading(false);
                    } else {
                        showToast("Event not found", "error");
                        navigate('/tournaments');
                    }
                }, () => {
                    showToast("Event not found", "error");
                    navigate('/tournaments');
                });
            }
        }, (error) => {
            console.error("Tournament lookup failed:", error);
            // Self-healing: if listener fails, try one-time fetch as fallback
            getDoc(doc(db, 'tournaments', id)).then(snap => {
                if (snap.exists()) {
                    setTournament({ id: snap.id, ...snap.data() } as Tournament);
                    setEventCollection('tournaments');
                } else {
                    getDoc(doc(db, 'scrims', id)).then(scrimSnap => {
                        if (scrimSnap.exists()) {
                            setTournament({ id: scrimSnap.id, ...scrimSnap.data(), matchType: 'scrims' } as Tournament);
                            setEventCollection('scrims');
                        }
                    });
                }
            }).finally(() => setLoading(false));
        });

        // 3. Related Tournaments & Host Profile (One-time fetch is okay)
        const fetchMeta = async () => {
            try {
                let docSnap = await getDoc(doc(db, 'tournaments', id));
                if (!docSnap.exists()) {
                    docSnap = await getDoc(doc(db, 'scrims', id));
                }
                if (docSnap.exists()) {
                    const tData = docSnap.data() as Tournament;
                    
                    // Host Profile
                    if (tData.hostUid) {
                        const hostRef = doc(db, 'users_public', tData.hostUid);
                        const hostSnap = await getDoc(hostRef);
                        if (hostSnap.exists()) {
                            setHostProfile({ uid: hostSnap.id, ...hostSnap.data() } as UserProfile);
                        }
                    }

                    // Related Tournaments
                    if (tData.game) {
                        const relSnap = await getDocs(query(
                            collection(db, 'tournaments'),
                            where('status', '==', 'upcoming'),
                            where('game', '==', tData.game)
                        ));
                        setRelatedTournaments(relSnap.docs.map(d => ({ id: d.id, ...d.data() } as Tournament)).filter(t => t.id !== id).slice(0, 3));
                    }
                }
            } catch (err) {
                console.warn("Meta data fetch failed", err);
                setMetaError("Failed to load some tournament details.");
            }
        };
        fetchMeta();

        return () => {
            unsubTournament();
            if (unsubScrims) unsubScrims();
        };
    }, [id, navigate, showToast]);

    // Participants roster subscription — full roster is only readable by the
    // tournament host or an admin (BUG-037). Non-hosts get their own
    // registration only, so the full list is not subscribed for them.
    useEffect(() => {
        if (!id) return;
        const isHostOrAdmin = tournament?.hostUid === user?.uid || user?.role === 'admin';
        if (!isHostOrAdmin) return;
        const unsubParticipants = onSnapshot(query(collection(db, 'participants'), where('tournamentId', '==', id)), (snapshot) => {
            setParticipants(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        }, (err) => console.warn('Participants subscription failed:', err));
        return () => unsubParticipants();
    }, [id, tournament, user]);

    // Independent effect for join status (depends on user/profile which might resolve later)
    useEffect(() => {
        if (!user || !id) {
            setIsJoined(false);
            return;
        }

        const unsubJoin = onSnapshot(query(
            collection(db, 'participants'),
            where('tournamentId', '==', id),
            where('userId', '==', user.uid)
        ), async (snapshot) => {
            let joined = !snapshot.empty;
            // Team-registration fallback (BUG-037): the team query may be
            // filtered to self for non-hosts — treat a failure as "not joined"
            // rather than throwing into the listener.
            if (!joined && profile?.teamId) {
                try {
                    const teamSnap = await getDocs(query(
                        collection(db, 'participants'),
                        where('tournamentId', '==', id),
                        where('teamId', '==', profile.teamId)
                    ));
                    if (!teamSnap.empty) joined = true;
                } catch (err) {
                    console.warn('Team join-status fallback failed:', err);
                }
            }
            setIsJoined(joined);
        }, (err) => console.warn('Join status subscription failed:', err));

        return () => unsubJoin();
    }, [id, user, profile?.teamId]);

    useEffect(() => {
        if (!loading && tournament && searchParams.get('tab') === 'results') {
            setIsResultModalOpen(true);
            setActiveTab('overview');
            // Remove the ?tab=results from URL so refreshing won't keep popping it
            navigate(`/tournaments/${tournament.id}`, { replace: true });
        }
    }, [searchParams, tournament, loading, navigate]);

    useEffect(() => {
        const fetchTeamMembers = async () => {
            if (profile?.teamId) {
                try {
                    const q = query(collection(db, 'team_members'), where('teamId', '==', profile.teamId));
                    const snap = await getDocs(q);
                    const members = snap.docs.map(d => d.data());
                    
                    // Fetch user profiles for these members to get their inGameName
                    const profiles = await Promise.all(members.map(async (m) => {
                        const userDoc = await getDoc(doc(db, 'users_public', m.userId));
                        if (userDoc.exists()) {
                            return { ...m, ...userDoc.data() };
                        }
                        return m;
                    }));
                    
                    // Filter out the current user
                    setTeamMembers(profiles.filter(p => p.userId !== user?.uid));
                } catch (error) {
                    console.error("Error fetching team members:", error);
                }
            }
        };
        fetchTeamMembers();
    }, [profile?.teamId, user?.uid]);

    useEffect(() => {
        if (!tournament?.startTime) return;

        const startDate = toDateSafe(tournament.startTime);
        if (!startDate) {
            return;
        }

        const start = startDate.getTime();

        const timer = setInterval(() => {
            const now = new Date().getTime();
            const diff = start - now;

            if (diff <= 0) {
                setTimeLeft(null);
                clearInterval(timer);
                return;
            }

            setTimeLeft({
                d: Math.floor(diff / (1000 * 60 * 60 * 24)),
                h: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                m: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
                s: Math.floor((diff % (1000 * 60)) / 1000)
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [tournament?.startTime]);

    const filteredParticipants = participants.filter(p => 
        (p.username && p.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.inGameId && p.inGameId.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.teamName && p.teamName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.teammates && Array.isArray(p.teammates) && p.teammates.some((tm: string) => typeof tm === 'string' && tm.toLowerCase().includes(searchTerm.toLowerCase())))
    );

    const handleActivateFunding = async () => {
        if (!tournament || !id) return;
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) {
                showToast("Please sign in to activate tournament", "error");
                return;
            }
            let success = false;
            try {
                const res = await fetch(`/api/tournaments/${id}/activate`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok && data.success) {
                    success = true;
                }
            } catch {
                // API unreachable fallback
            }

            if (!success) {
                await updateDoc(doc(db, 'tournaments', id), {
                    status: 'upcoming',
                    fundingStatus: 'RESERVED',
                    stage: 'registration',
                    updatedAt: serverTimestamp(),
                });
                success = true;
            }

            if (success) {
                showToast("Tournament activated and prize funds locked in escrow!", "success");
                const docSnap = await getDoc(doc(db, 'tournaments', id));
                if (docSnap.exists()) {
                    setTournament({ id: docSnap.id, ...docSnap.data() } as Tournament);
                }
            }
        } catch (err: any) {
            showToast(err.message || "Failed to activate tournament", "error");
        }
    };

    const handleJoinClick = () => {
        if (!user) {
            showToast("Please login to join!", "warning");
            return;
        }
        if (!tournament || !profile) return;

        if ((tournament.status as string) === 'pending_funding' || ((tournament.prizePool || 0) > 0 && tournament.fundingStatus === 'PENDING_FUNDING')) {
            showToast("Tournament is currently awaiting organizer prize funding. Registration is locked until funds are secured.", "warning");
            return;
        }

        // Requirement: In-game ID is compulsory for all games
        if (!profile.inGameId) {
            showToast("In-Game ID is required for all tournaments!", "warning");
            navigate('/profile');
            return;
        }

        // Requirement: In-game Name is compulsory for all games
        if (!profile.inGameName) {
            showToast("In-Game Name is required for all tournaments!", "warning");
            navigate('/profile');
            return;
        }

        // Requirement: Team Name is compulsory for solo tournaments (duo/squad use the JoinTournamentModal which has fallbacks)
        if (tournament.teamType === 'solo' && !profile.teamName) {
            showToast("Team Name is required for solo tournaments!", "warning");
            navigate('/profile');
            return;
        }

        if (tournament.teamType === 'duo' || tournament.teamType === 'squad') {
            setShowJoinModal(true);
        } else {
            setShowRegistrationModal(true);
        }
    };

    const handleJoinSuccess = () => {
        setIsJoined(true);
    };

    const handleLeaveTournament = async () => {
        if (!user || !tournament || !isJoined) return;
        if (tournament.status !== 'upcoming') {
            showToast("You cannot leave a tournament that has already started.", "error");
            return;
        }
        if (!window.confirm('Are you sure you want to leave this tournament? Your entry fee will be refunded.')) return;

        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error('Authentication required');

            const res = await fetch('/api/wallet/leave-tournament', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ tournamentId: tournament.id }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to leave tournament');

            setIsJoined(false);
            await NotificationService.create(
                user.uid,
                'Tournament Left',
                `You have left ${tournament.title}. Your entry fee has been refunded.`,
                'info',
                `/tournaments/${tournament.id}`
            );
            showToast('Left Tournament Successfully!', 'success');
        } catch (e: any) {
            showToast(e.message, 'error');
        }
    };

    const handleShare = () => {
        if (navigator.share) {
            navigator.share({
                title: tournament.title,
                text: `Join ${tournament.title} on our platform!`,
                url: window.location.href,
            });
        } else {
            navigator.clipboard.writeText(window.location.href);
            showToast("Link copied to clipboard!", "success");
        }
    };

    const handleDeleteTournament = async () => {
        if (!id || isDeleting || !tournament) return;
        setIsDeleting(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error("Authentication required");

            let res = await fetch(`/api/tournaments/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) {
                res = await fetch(`/api/scrims/${id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            }
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || 'Failed to delete');
            }

            const isScrim = tournament.matchType === 'scrims' || (tournament as any).isScrim === true;
            showToast(
                isScrim ? 'Scrim deleted successfully' : 'Tournament deleted successfully',
                'success'
            );
            setShowDeleteModal(false);
            if (isScrim) {
                navigate('/organizer?tab=scrims');
            } else {
                navigate('/organizer?tab=tournaments');
            }
        } catch (err: any) {
            showToast(err.message || 'Failed to delete tournament', 'error');
        } finally {
            setIsDeleting(false);
        }
    };

    // Fetch room credentials from secure subcollection (not the public tournament doc)
    useEffect(() => {
        if (!tournament || !isJoined || !user) return;
        if (tournament.status !== 'live' && tournament.status !== 'upcoming') return;
        fetchRoomCredentials(tournament.id, undefined, eventCollection).then(creds => {
            if (creds) setRoomCreds(creds);
        });
    }, [tournament?.id, tournament?.status, isJoined, user, eventCollection]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="loader mb-4"></div>
                <p className="text-brand-500 text-sm animate-pulse font-mono">ESTABLISHING UPLINK...</p>
            </div>
        );
    }

    if (!tournament) return <p className="text-center mt-10">Tournament not found.</p>;

    const bannerUrl = tournament.bannerUrl || DEFAULT_BANNER;
    const bannerStyle = { backgroundImage: `url('${bannerUrl}')`, backgroundSize: 'cover', backgroundPosition: 'center' };
    const showRoom = tournament.matchType === 'scrims' && isJoined && (tournament.status === 'live' || (roomCreds?.roomId && tournament.status === 'upcoming'));
    const ytId = getYoutubeId(tournament.ytLink);

    return (
        <div className="animate-fade-in w-full max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6 overflow-x-hidden">
            {tournament && (
                <Seo
                    title={`${tournament.title} | ${formatGameName(tournament.game)} Tournament Nepal | NexPlay`}
                    description={`Join ${tournament.title} on NexPlay. View tournament details, registration, prize pool, schedule, and results for this ${formatGameName(tournament.game)} esports competition in Nepal.`}
                    canonicalPath={`/tournaments/${id}`}
                    jsonLd={{
                        "@context": "https://schema.org",
                        "@type": "SportsEvent",
                        "sport": formatGameName(tournament.game),
                        name: tournament.title,
                        description: `${formatGameName(tournament.game)} tournament on NexPlay — Nepal esports platform.`,
                        startDate: tournament.startTime?.toDate?.()?.toISOString(),
                        endDate: tournament.startTime?.toDate?.()?.toISOString(),
                        eventStatus: tournament.status === 'completed' ? "https://schema.org/EventCompleted" : "https://schema.org/EventScheduled",
                        eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
                        url: `https://www.nexplayorg.app/tournaments/${id}`,
                        organizer: {
                            "@type": "Organization",
                            name: tournament.hostName || "NexPlay",
                            url: "https://www.nexplayorg.app",
                        },
                        location: {
                            "@type": "VirtualLocation",
                            name: "NexPlay Online",
                            url: `https://www.nexplayorg.app/tournaments/${id}`,
                        },
                        offers: {
                            "@type": "Offer",
                            price: tournament.entryFee ? String(tournament.entryFee) : "0",
                            priceCurrency: "NPR",
                            availability: "https://schema.org/InStock",
                            url: `https://www.nexplayorg.app/tournaments/${id}`,
                        },
                    }}
                />
            )}
            {/* Hero Section */}
            <div className="relative h-48 sm:h-72 md:h-[400px] lg:h-[500px] rounded-2xl sm:rounded-[2rem] overflow-hidden mb-6 sm:mb-12 shadow-2xl group border border-gray-800 w-full">
                <div className="absolute inset-0 bg-dark transition-transform duration-700 group-hover:scale-105" style={{...bannerStyle, opacity: 0.6}}></div>
                <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/60 to-transparent"></div>
                
                <div className="absolute top-3 left-3 sm:top-8 sm:left-8 flex flex-wrap gap-1.5 sm:gap-3 z-10 max-w-[calc(100%-4rem)]">
                    <span className="bg-white/10 backdrop-blur-md text-white text-xs sm:text-xs font-black px-2.5 sm:px-4 py-1 sm:py-2 rounded-full uppercase tracking-widest border border-white/10 shadow-xl truncate">
                        {formatGameName(tournament.game)}
                    </span>
                    <span className={`backdrop-blur-md text-white text-xs sm:text-xs font-black px-2.5 sm:px-4 py-1 sm:py-2 rounded-full uppercase tracking-widest shadow-xl border ${
                        tournament.status === 'live' ? 'bg-red-600/90 border-red-500/30' : 
                        tournament.status === 'completed' ? 'bg-blue-600/90 border-blue-500/30' : 
                        'bg-green-600/90 border-green-500/30'
                    }`}>
                        {tournament.status}
                    </span>
                    {tournament.ytLink && tournament.status === 'live' && (
                        <span className="bg-red-600 animate-pulse text-white text-xs sm:text-xs font-black px-2.5 sm:px-4 py-1 sm:py-2 rounded-full uppercase tracking-widest shadow-xl flex items-center gap-1.5 sm:gap-2">
                            <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current shrink-0" /> LIVE STREAM
                        </span>
                    )}
                </div>

                <div className="absolute top-3 right-3 sm:top-8 sm:right-8 flex items-center gap-2 sm:gap-3 z-20">
                    <button type="button" 
                        onClick={handleShare}
                        aria-label="Share Tournament"
                        className="p-2.5 sm:p-4 bg-white/5 backdrop-blur-md hover:bg-white/10 text-white rounded-full transition-colors border border-white/10 active:scale-95 shadow-xl"
                        title="Share"
                    >
                        <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    {user && (
                        <button type="button"
                            onClick={() => setShowDisputeModal(true)}
                            aria-label="Report Dispute"
                            className="p-2.5 sm:p-4 bg-red-500/10 backdrop-blur-md hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-full transition-colors border border-red-500/30 active:scale-95 shadow-xl flex items-center justify-center"
                            title="Report Dispute / Issue"
                        >
                            <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                    )}
                    {isHostOrAdmin && (
                        <>
                            <button
                                type="button"
                                onClick={() => {
                                    if (tournament.matchType === 'scrims' || (tournament as any).isScrim === true) {
                                        navigate(`/organizer/scrim/${tournament.id}`);
                                    } else {
                                        navigate(`/tournament-admin/${tournament.id}`);
                                    }
                                }}
                                aria-label="Manage Event"
                                className="p-2.5 sm:p-4 bg-white/10 backdrop-blur-md hover:bg-white/20 text-white rounded-full transition-colors border border-white/10 active:scale-95 shadow-xl flex items-center justify-center"
                                title="Manage / Edit Details"
                            >
                                <Settings2 className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowDeleteModal(true)}
                                aria-label="Delete Event"
                                className="p-2.5 sm:p-4 bg-red-600/30 backdrop-blur-md hover:bg-red-600/50 text-red-300 hover:text-white rounded-full transition-colors border border-red-500/40 active:scale-95 shadow-xl flex items-center justify-center"
                                title={tournament.matchType === 'scrims' || (tournament as any).isScrim === true ? "Delete Scrim" : "Delete Tournament"}
                            >
                                <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                        </>
                    )}
                </div>

                <div className="absolute bottom-3 left-3 right-3 sm:bottom-8 sm:left-8 sm:right-8 lg:bottom-12 lg:left-12 lg:right-12 z-10">
                    <motion.h1 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-xl sm:text-3xl md:text-5xl lg:text-7xl font-black text-white mb-2 sm:mb-4 lg:mb-6 tracking-tighter leading-tight sm:leading-none break-words [overflow-wrap:anywhere] line-clamp-2 sm:line-clamp-none"
                    >
                        {tournament.title}
                    </motion.h1>
                    <div className="text-gray-300 font-bold text-xs sm:text-sm mb-2 sm:mb-4 lg:mb-6 uppercase tracking-widest flex items-center gap-2 truncate">
                        Organized by: {tournament.hostUid ? <ProfileLink to={`/organization/${tournament.hostUid}`} name={tournament.hostName || 'Official Host'} /> : <span className="text-gray-500">Official Host</span>}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 sm:gap-6 lg:gap-8 text-gray-200 font-bold text-xs sm:text-xs md:text-sm uppercase tracking-widest">
                        <div className="flex items-center gap-1.5 sm:gap-3">
                            <Calendar className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-brand-500 shrink-0" />
                            <span className="truncate">{formatDate(tournament.startTime)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-3">
                            <MapPin className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-brand-500 shrink-0" />
                            <span className="truncate">{tournament.map || 'TBD'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-3">
                            <Users className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-brand-500 shrink-0" />
                            <span className="truncate">{tournament.teamType} • {tournament.type}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
                {/* Main Content */}
                <div className="lg:col-span-8 space-y-6 sm:space-y-8 min-w-0">
                    {/* Tabs Navigation */}
                    <div className="flex p-1.5 sm:p-2 bg-card/50 rounded-2xl sm:rounded-full border border-gray-800 sticky top-16 sm:top-24 z-10 backdrop-blur-xl overflow-x-auto custom-scrollbar gap-2 max-w-full">
                        {[
                            { id: 'overview', label: 'Overview', icon: Info },
                            { id: 'description', label: 'Description', icon: Info },
                            { id: 'participants', label: 'Players', icon: Users },
                            { id: 'roadmap', label: 'Roadmap', icon: Calendar },
                            { id: 'groups', label: 'Match Groups', icon: Trophy },
                            tournament.status === 'completed' ? { id: 'results', label: 'Results', icon: Trophy } : null,
                            (tournament as any).tournamentMode === 'PER_KILL_REWARD' && (tournament as any).killRewards?.length > 0 ? { id: 'killrewards', label: 'Kill Rewards', icon: Target } : null
                        ].filter((tab): tab is {id: string, label: string, icon: any} => tab !== null).map((tab) => (
                            <button type="button" 
                                key={tab.id}
                                onClick={() => {
                                    if (tab.id === 'results') {
                                        setIsResultModalOpen(true);
                                    } else {
                                        setActiveTab(tab.id as any);
                                    }
                                }}
                                className={`flex-1 min-w-max flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-3 rounded-xl sm:rounded-full text-xs sm:text-xs font-black transition-colors uppercase tracking-wider whitespace-nowrap ${
                                    (activeTab === tab.id && tab.id !== 'results') 
                                    ? 'bg-brand-500 text-white shadow-xl shadow-brand-500/20' 
                                    : 'text-gray-500 hover:text-white hover:bg-surface/50'
                                }`}
                            >
                                <tab.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <AnimatePresence mode="wait">
                        {activeTab === 'overview' && (
                            <motion.div 
                                key="overview"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-6 sm:space-y-8"
                            >
                                {ytId && (
                                    <div className="rounded-2xl sm:rounded-3xl overflow-hidden border border-gray-800 shadow-2xl aspect-video bg-black w-full">
                                        <iframe 
                                            src={`https://www.youtube.com/embed/${ytId}`} 
                                            frameBorder="0" 
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                            allowFullScreen 
                                            className="w-full h-full"
                                        ></iframe>
                                    </div>
                                )}
                                {tournament.ytLink && (
                                    <div className="flex justify-center">
                                        <a 
                                            href={sanitizeUrl(tournament.ytLink)} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 text-brand-500 hover:text-brand-400 font-bold text-xs sm:text-sm transition"
                                        >
                                            <Play className="w-4 h-4 fill-current" /> Visit YouTube Channel
                                        </a>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                                    {[
                                        { label: 'Prize Pool', value: formatCurrency(tournament.prizePool), icon: Trophy, color: 'text-yellow-500' },
                                        { label: 'Entry Fee', value: tournament.entryFee > 0 ? formatCurrency(tournament.entryFee) : 'FREE', icon: Medal, color: 'text-brand-500' },
                                        { label: 'Slots', value: `${getFilledSlotCount(tournament)}/${getSlotCount(tournament)}`, icon: Users, color: 'text-blue-500' },
                                        { label: 'Game Mode', value: tournament.type, icon: Play, color: 'text-red-500' },
                                    ].map((stat, i) => (
                                        <div key={i} className="bg-card/50 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-gray-800 hover:border-gray-700 transition-colors hover:bg-surface/50 min-w-0">
                                            <stat.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${stat.color} mb-2 sm:mb-4`} />
                                            <div className="text-[10px] sm:text-xs text-gray-500 uppercase font-black tracking-widest mb-1 truncate">{stat.label}</div>
                                            <div className="text-white font-black text-sm sm:text-xl truncate">{stat.value}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Scoring Info — show participants how points work */}
                                <ScoringInfoCard tournament={tournament} />

                                {showRoom && (
                                    <div className="bg-brand-500/10 border border-brand-500/20 p-4 sm:p-8 rounded-2xl sm:rounded-3xl relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform">
                                            <Trophy className="w-32 h-32 text-brand-500" />
                                        </div>
                                        <div className="relative z-10">
                                            <div className="flex items-center gap-2 mb-4 sm:mb-6">
                                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                                                <span className="text-emerald-400 text-xs font-black uppercase tracking-widest">Match Room Live</span>
                                            </div>
                                            
                                            <h3 className="text-lg sm:text-2xl font-black text-white mb-4 sm:mb-6 tracking-tight">Room Information</h3>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="bg-card/80 p-4 rounded-2xl border border-gray-800">
                                                    <div className="text-xs text-gray-500 uppercase font-black tracking-widest mb-1">Room ID</div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-lg sm:text-xl font-mono font-bold text-white tracking-wider">{roomCreds?.roomId || 'Waiting...'}</span>
                                                        <button type="button" onClick={() => {
                                                            navigator.clipboard.writeText(roomCreds?.roomId || '');
                                                            showToast("Copied!", "success");
                                                        }} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                                                            <ExternalLink className="w-5 h-5 text-gray-500" />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="bg-card/80 p-4 rounded-2xl border border-gray-800">
                                                    <div className="text-xs text-gray-500 uppercase font-black tracking-widest mb-1">Password</div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-lg sm:text-xl font-mono font-bold text-white tracking-wider">
                                                            {showPassword ? (roomCreds?.roomPass || 'None') : '••••••••'}
                                                        </span>
                                                        <div className="flex items-center gap-1">
                                                            <button type="button" 
                                                                onClick={() => setShowPassword(!showPassword)} 
                                                                className="p-2 hover:bg-white/10 rounded-xl transition-colors relative z-20"
                                                            >
                                                                {showPassword ? <EyeOff className="w-5 h-5 text-gray-500" /> : <Eye className="w-5 h-5 text-gray-500" />}
                                                            </button>
                                                            <button type="button" onClick={() => {
                                                                navigator.clipboard.writeText(roomCreds?.roomPass || '');
                                                                showToast("Copied!", "success");
                                                            }} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                                                                <ExternalLink className="w-5 h-5 text-gray-500" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {activeTab === 'description' && (
                            <motion.div 
                                key="description"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-6 sm:space-y-8"
                            >
                                <div className="bg-card/50 p-4 sm:p-8 rounded-2xl sm:rounded-3xl border border-gray-800">
                                    <h3 className="text-white font-black text-xs uppercase tracking-widest mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
                                        <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-brand-500 shrink-0" /> Organization
                                    </h3>
                                    {hostProfile ? (
                                        <div className="flex items-center gap-3 sm:gap-4">
                                            <div className="w-12 h-12 sm:w-16 sm:h-16 shrink-0 rounded-2xl bg-dark border border-gray-700 overflow-hidden flex items-center justify-center">
                                                {hostProfile.profilePicUrl ? (
                                                    <img src={hostProfile.profilePicUrl || undefined} alt={hostProfile.username} className="w-full h-full object-cover" loading="lazy" />
                                                ) : (
                                                    <Building2 className="w-6 h-6 sm:w-8 sm:h-8 text-gray-600" />
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-white font-black text-base sm:text-lg truncate">
                                                    <ProfileLink to={`/organization/${tournament.hostUid}`} name={hostProfile.username} />
                                                </div>
                                                <p className="text-gray-400 text-xs sm:text-sm mt-1 line-clamp-2 [overflow-wrap:anywhere]">{hostProfile.bio || 'No bio available.'}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <ProfileLink to={`/organization/${tournament.hostUid}`} name={tournament.hostName || 'Official Host'} />
                                    )}
                                </div>
                                {tournament.prizeDistribution && tournament.prizeDistribution.length > 0 && (
                                    <div className="mb-6 sm:mb-8">
                                        <PrizeBoard 
                                            prizes={tournament.prizeDistribution} 
                                            currency={tournament.currency} 
                                            totalPrizePool={tournament.prizePool}
                                        />
                                    </div>
                                )}
                                <div className="bg-card/50 p-4 sm:p-8 rounded-2xl sm:rounded-3xl border border-gray-800">
                                    <h3 className="text-white font-black text-xs uppercase tracking-widest mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
                                        <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-brand-500 shrink-0" /> Rules & Regulations
                                    </h3>
                                    <div className="prose prose-invert max-w-none">
                                        <div className="text-gray-400 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-medium [overflow-wrap:anywhere]">
                                            {tournament.rules || 'No specific rules provided. Play fair and respect other players.'}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'participants' && (
                            <motion.div 
                                key="participants"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-4"
                            >
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                                    <h3 className="text-white font-black text-lg sm:text-xl uppercase tracking-tighter">Registered Players</h3>
                                    <div className="relative w-full sm:w-64">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                        <input 
                                            type="text" 
                                            placeholder="Search player or ID..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full bg-surface border border-gray-800 rounded-xl py-2 pl-10 pr-4 text-xs sm:text-sm text-white focus:border-brand-500 focus-visible:outline-none transition"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredParticipants.length > 0 ? filteredParticipants.map((p, i) => (
                                        <div key={i} className="bg-surface p-4 sm:p-5 rounded-2xl border border-gray-800 flex flex-col justify-between gap-4 group hover:border-brand-500/30 transition-colors shadow-lg hover:shadow-brand-500/5 min-w-0">
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 bg-brand-600/10 rounded-2xl flex items-center justify-center text-brand-500 font-black border border-brand-500/20 text-sm sm:text-base">
                                                    {i + 1}
                                                </div>
                                                <div className="flex flex-col gap-2 min-w-0 flex-1">
                                                    <div className="text-white font-black text-base sm:text-lg leading-tight truncate">
                                                        <ProfileLink to={`/profile/${p.userId}`} name={p.username} />
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        <div className="flex items-center gap-1 bg-dark px-2 py-1 rounded-lg border border-gray-800 max-w-full">
                                                            <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest shrink-0">UID:</span>
                                                            <span className="text-xs text-brand-400 font-mono font-bold truncate">{p.inGameId}</span>
                                                        </div>
                                                        {p.inGameName && (
                                                            <div className="flex items-center gap-1 bg-dark px-2 py-1 rounded-lg border border-gray-800 max-w-full">
                                                                <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest shrink-0">IGN:</span>
                                                                <span className="text-xs text-brand-400 font-mono font-bold truncate">{p.inGameName}</span>
                                                            </div>
                                                        )}
                                                        {p.teammates && p.teammates.map((tm: string, idx: number) => (
                                                            <div key={idx} className="flex items-center gap-1 bg-dark px-2 py-1 rounded-lg border border-gray-800 max-w-full">
                                                                <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest shrink-0">T{idx + 1}:</span>
                                                                <span className="text-xs text-brand-400 font-mono font-bold truncate">{tm}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="bg-dark p-3 rounded-xl border border-gray-800">
                                                <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">Team Name</div>
                                                <div className={`inline-block px-3 py-1 rounded-lg text-xs font-black uppercase tracking-tight truncate max-w-full ${p.teamName ? 'bg-brand-600/20 text-brand-400 border border-brand-500/20' : 'bg-surface text-gray-500'}`}>
                                                    {p.teamId ? <ProfileLink to={`/team/${p.teamId}`} name={p.teamName || 'TEAM'} /> : (p.teamName || 'SOLO PLAYER')}
                                                </div>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="col-span-full py-12 text-center bg-surface rounded-3xl border border-gray-800 border-dashed">
                                            <Users className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                                            <p className="text-gray-500 font-bold text-sm sm:text-base">No participants yet. Be the first to join!</p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'roadmap' && (
                            <motion.div 
                                key="roadmap"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                            >
                                <TournamentRoadmap tournament={tournament} />
                            </motion.div>
                        )}
                        {activeTab === 'groups' && (
                            <motion.div
                                key="groups"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                            >
                                {(tournament as any).tournamentMode === 'PER_KILL_REWARD' ? (
                                    <div className="space-y-6">
                                        <PerKillLeaderboard tournament={tournament} />
                                        <GroupStandingsView tournament={tournament} participants={participants} />
                                    </div>
                                ) : (
                                    <GroupStandingsView tournament={tournament} participants={participants} />
                                )}
                            </motion.div>
                        )}
                        {activeTab === 'killrewards' && (
                            <motion.div
                                key="killrewards"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                            >
                                <PerKillResultView tournament={tournament} />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {metaError && (
                        <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg text-xs text-yellow-400 font-medium">
                            {metaError}
                        </div>
                    )}

                    {/* Related Tournaments */}
                    {relatedTournaments.length > 0 && (
                        <div className="space-y-6 pt-8 border-t border-gray-800/50">
                            <div className="flex justify-between items-center">
                                <button type="button" onClick={() => navigate('/tournaments')} className="text-xs font-black text-brand-500 uppercase tracking-widest hover:text-brand-400 transition-colors flex items-center gap-1">
                                    View All <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {relatedTournaments.map((t) => (
                                    <div 
                                        key={t.id} 
                                        onClick={() => navigate(`/tournaments/${t.id}`)}
                                        className="bg-surface rounded-2xl border border-gray-800 overflow-hidden cursor-pointer group hover:border-brand-500/50 transition-colors"
                                    >
                                        <div className="h-24 overflow-hidden relative">
                                            <img 
                                                src={t.bannerUrl || DEFAULT_BANNER || undefined} 
                                                alt={t.title}
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" loading="lazy"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-gray-950 to-transparent"></div>
                                        </div>
                                        <div className="p-4">
                                            <h4 className="text-white font-black text-sm truncate mb-1">{t.title}</h4>
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-brand-500 font-black uppercase">{formatCurrency(t.prizePool)}</span>
                                                <span className="text-xs text-gray-500 font-bold">{formatDate(t.startTime)}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Join Card */}
                    <div className="bg-surface p-4 sm:p-8 rounded-2xl sm:rounded-3xl border border-gray-800 shadow-2xl lg:sticky lg:top-24">
                        {timeLeft && (
                            <div className="mb-6 sm:mb-8 text-center">
                                <div className="text-xs text-gray-500 uppercase font-black tracking-widest mb-3 flex items-center justify-center gap-2">
                                    <Clock className="w-3.5 h-3.5" /> Starts In
                                </div>
                                <div className="flex justify-center gap-2 sm:gap-3">
                                    {[
                                        { label: 'D', value: timeLeft.d },
                                        { label: 'H', value: timeLeft.h },
                                        { label: 'M', value: timeLeft.m },
                                        { label: 'S', value: timeLeft.s },
                                    ].map((t, i) => (
                                        <div key={i} className="flex flex-col items-center">
                                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-dark rounded-xl border border-gray-800 flex items-center justify-center text-base sm:text-xl font-black text-white shadow-inner">
                                                {t.value.toString().padStart(2, '0')}
                                            </div>
                                            <span className="text-[10px] sm:text-xs text-gray-600 font-black mt-1">{t.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                            <div className="flex justify-between items-center p-3 sm:p-4 bg-dark rounded-2xl border border-gray-800">
                                <span className="text-xs text-gray-500 font-black uppercase tracking-widest">Entry Fee</span>
                                <span className="text-lg sm:text-xl font-black text-white">
                                    {tournament.entryFee > 0 ? formatCurrency(tournament.entryFee) : 'FREE'}
                                </span>
                            </div>
                            <div className="p-3 sm:p-4 bg-dark rounded-2xl border border-gray-800">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs text-gray-500 font-black uppercase tracking-widest">Slots Filled</span>
                                    <span className="text-xs text-white font-black">{getFilledSlotCount(tournament)} / {getSlotCount(tournament)}</span>
                                </div>
                                <div className="w-full bg-card rounded-full h-2.5 overflow-hidden">
                                    <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(getFilledSlotCount(tournament) / (getSlotCount(tournament) || 1)) * 100}%` }}
                                        className="bg-brand-600 h-full rounded-full shadow-[0_0_10px_rgba(var(--brand-primary-rgb),0.5)]"
                                    ></motion.div>
                                </div>
                            </div>
                        </div>

                        {tournament.status === 'completed' ? (
                            <button type="button" 
                                onClick={() => setIsResultModalOpen(true)}
                                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white py-4 sm:py-5 rounded-2xl text-xs sm:text-sm font-black uppercase tracking-widest shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-colors active:scale-95 flex items-center justify-center gap-3 group"
                            >
                                <Trophy className="w-5 h-5 sm:w-6 sm:h-6 group-hover:scale-110 transition-transform" /> View Results
                            </button>
                        ) : !user ? (
                            <button type="button" 
                                onClick={() => navigate('/profile')}
                                className="w-full bg-surface hover:bg-surface text-white py-4 sm:py-5 rounded-2xl text-xs sm:text-sm font-black uppercase tracking-widest transition-colors active:scale-95"
                            >
                                Login to Join
                            </button>
                        ) : isJoined ? (
                            <div className="space-y-3">
                                {/* Registration status badge */}
                                {(() => {
                                    const myParticipant = participants.find(p => p.userId === user?.uid);
                                    const status = myParticipant?.status;
                                    if (!status || status === 'approved') return (
                                        <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-2xl">
                                            <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                                            <span className="text-xs font-black text-green-400 uppercase tracking-widest">Registration Confirmed</span>
                                        </div>
                                    );
                                    if (status === 'pending') return (
                                        <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl">
                                            <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0" />
                                            <span className="text-xs font-black text-yellow-400 uppercase tracking-widest">Awaiting Approval</span>
                                        </div>
                                    );
                                    if (status === 'rejected') return (
                                        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-2xl">
                                            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                                            <span className="text-xs font-black text-red-400 uppercase tracking-widest">Registration Rejected</span>
                                        </div>
                                    );
                                    return null;
                                })()}
                                <div className="grid grid-cols-2 gap-2">
                                    <button type="button" 
                                        onClick={() => setActiveTab('overview')}
                                        className="bg-dark hover:bg-surface text-gray-400 py-3 rounded-xl text-xs font-black uppercase tracking-widest border border-gray-800 transition-colors"
                                    >
                                        Room Access
                                    </button>
                                    <button type="button" 
                                        onClick={() => window.open('https://discord.gg', '_blank')}
                                        className="bg-brand-600/10 hover:bg-brand-600/20 text-brand-500 py-3 rounded-xl text-xs font-black uppercase tracking-widest border border-brand-500/20 transition-colors"
                                    >
                                        Join Discord
                                    </button>
                                </div>
                                {tournament.status === 'upcoming' && (
                                    <div className="space-y-3">
                                        <button type="button" 
                                            onClick={handleLeaveTournament}
                                            className="w-full bg-red-600/10 hover:bg-red-600/20 text-red-500 py-4 rounded-xl text-xs font-black uppercase tracking-widest border border-red-500/20 transition-colors"
                                        >
                                            Leave Tournament
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (tournament.status === 'pending_funding' || ((tournament.prizePool || 0) > 0 && tournament.fundingStatus === 'PENDING_FUNDING')) ? (
                            tournament.hostUid === profile?.uid ? (
                                <div className="space-y-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-center">
                                    <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto" />
                                    <div>
                                        <div className="text-xs font-black text-amber-300 uppercase tracking-wider">Funding Required: Rs. {(tournament.prizePool || 0).toLocaleString()}</div>
                                        <p className="text-[11px] text-gray-400 mt-1">Available Org Wallet: Rs. {((profile?.orgWalletBalance || 0) + (profile?.balance || 0)).toLocaleString()}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleActivateFunding}
                                        className="w-full bg-amber-600 hover:bg-amber-500 text-white py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition shadow-lg shadow-amber-600/20 flex items-center justify-center gap-2"
                                    >
                                        <Lock className="w-4 h-4" />
                                        Activate & Reserve Prize Funds
                                    </button>
                                </div>
                            ) : (
                                <div className="p-4 bg-slate-900/60 border border-amber-500/20 rounded-2xl text-center space-y-2">
                                    <Clock className="w-6 h-6 text-amber-400 mx-auto" />
                                    <div className="text-xs font-black text-amber-300 uppercase tracking-wider">Awaiting Organizer Funding</div>
                                    <p className="text-[11px] text-gray-400">Registration will open once the tournament prize funds are secured in escrow by the organizer.</p>
                                    <button type="button" disabled className="w-full bg-amber-500/10 text-amber-400/60 py-3 rounded-xl text-xs font-black uppercase tracking-widest cursor-not-allowed border border-amber-500/20">
                                        Registration Locked
                                    </button>
                                </div>
                            )
                        ) : getFilledSlotCount(tournament) >= getSlotCount(tournament) ? (
                            <button type="button" disabled className="w-full bg-red-900/20 text-red-500 border border-red-900/50 py-4 sm:py-5 rounded-2xl text-xs sm:text-sm font-black uppercase tracking-widest cursor-not-allowed">
                                Tournament Full
                            </button>
                        ) : tournament.status !== 'upcoming' ? (
                            <button type="button" disabled className="w-full bg-card text-gray-600 py-4 sm:py-5 rounded-2xl text-xs sm:text-sm font-black uppercase tracking-widest cursor-not-allowed border border-gray-800">
                                Registration Closed
                            </button>
                        ) : (
                            <button type="button" 
                                onClick={handleJoinClick}
                                className="w-full bg-brand-600 hover:bg-brand-500 text-white py-4 sm:py-5 rounded-2xl text-xs sm:text-sm font-black uppercase tracking-widest shadow-xl shadow-brand-600/20 transition-colors active:scale-95 flex items-center justify-center gap-3 group"
                            >
                                Join Tournament <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {showJoinModal && tournament && profile && (
                <JoinTournamentModal 
                    isOpen={showJoinModal}
                    onClose={() => setShowJoinModal(false)}
                    tournament={tournament}
                    profile={profile}
                    teamMembers={teamMembers}
                    onSuccess={handleJoinSuccess}
                />
            )}

            {showRegistrationModal && tournament && profile && (
                <RegistrationModal 
                    isOpen={showRegistrationModal}
                    onClose={() => setShowRegistrationModal(false)}
                    tournament={tournament}
                    profile={profile}
                    onSuccess={handleJoinSuccess}
                />
            )}

            {(tournament as any).tournamentMode === 'PER_KILL_REWARD' ? (
                <TournamentResultModal
                    isOpen={isResultModalOpen}
                    onClose={() => setIsResultModalOpen(false)}
                    tournament={tournament}
                />
            ) : (
                <TournamentResultModal
                    isOpen={isResultModalOpen}
                    onClose={() => setIsResultModalOpen(false)}
                    tournament={tournament}
                />
            )}

            {/* Host / Admin Delete Confirmation Modal */}
            {showDeleteModal && tournament && (
                <Modal
                    isOpen={showDeleteModal}
                    onClose={() => setShowDeleteModal(false)}
                    title={tournament.matchType === 'scrims' || (tournament as any).isScrim === true ? "Delete Scrim" : "Delete Tournament"}
                >
                    <div className="p-6 text-center">
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Trash2 className="w-8 h-8 text-red-500" />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">
                            Permanently delete "{tournament.title}"?
                        </h3>
                        <p className="text-sm text-gray-400 mb-6">
                            This action cannot be undone. All match credentials, participant registrations, and bracket records will be permanently removed.
                        </p>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowDeleteModal(false)}
                                disabled={isDeleting}
                                className="flex-1 bg-card hover:bg-surface text-white py-3 rounded-lg font-medium text-sm border border-gray-800 transition-colors min-h-[44px]"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteTournament}
                                disabled={isDeleting}
                                className="flex-1 bg-red-600 hover:bg-red-500 text-white py-3 rounded-lg font-medium text-sm transition-colors min-h-[44px] flex items-center justify-center gap-2"
                            >
                                {isDeleting ? (
                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Trash2 className="w-4 h-4" />
                                )}
                                <span>{isDeleting ? "Deleting..." : "Confirm Delete"}</span>
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Tournament / Scrim Player Dispute Modal */}
            {tournament && (
                <TournamentDisputeModal
                    isOpen={showDisputeModal}
                    onClose={() => setShowDisputeModal(false)}
                    tournament={tournament}
                    showToast={showToast}
                />
            )}
        </div>
    );
}
