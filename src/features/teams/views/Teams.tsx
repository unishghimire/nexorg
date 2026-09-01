import Seo from '../../../shared/components/Seo';
import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, serverTimestamp, where, doc, orderBy, limit, writeBatch } from 'firebase/firestore';
import { db } from '../../../shared/config/firebase';
import { useAuth } from '../../../shared/context/AuthContext';
import { useNotification } from '../../../shared/context/NotificationContext';
import { Team } from '../../../shared/types/types';
import { Users, Plus, Search, ArrowRight, Image as ImageIcon, CheckCircle2, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useInvisibleImage } from '../../../shared/hooks/useInvisibleImage';
import { MediaCategory } from '../../../shared/services/mediaService';
import { DEFAULT_TEAM_LOGO, NEXPLAY_LOGO, PRESET_TEAM_LOGOS } from '../../../shared/constants/constants';
import Modal from '../../../shared/components/Modal';

const Teams: React.FC = () => {
    const { user } = useAuth();
    const { showToast } = useNotification();
    const navigate = useNavigate();
    
    const [teams, setTeams] = useState<Team[]>([]);
    const [myTeams, setMyTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    
    const [isCreating, setIsCreating] = useState(false);
    const [newTeamName, setNewTeamName] = useState('');
    const [newTeamDesc, setNewTeamDesc] = useState('');
    const [newTeamLogo, setNewTeamLogo] = useState('');
    const [creating, setCreating] = useState(false);
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);
    const [showPresetModal, setShowPresetModal] = useState(false);

    const { handlePaste, handleDrop, handleDragOver, processAndUpload } = useInvisibleImage({
        onUploadStart: () => {
            setIsUploadingLogo(true);
        },
        onUploadEnd: () => setIsUploadingLogo(false),
        onUploadSuccess: (url) => {
            setNewTeamLogo(url);
        },
        onError: (err) => {
            showToast(err, 'error');
        }
    });

    useEffect(() => {
        fetchTeams();
    }, [user]);

    const fetchTeams = async () => {
        setLoading(true);
        setFetchError(null);
        try {
            let allTeams: Team[] = [];
            try {
                const q = query(collection(db, 'teams'), limit(200));
                const snap = await getDocs(q);
                allTeams = snap.docs.map(d => ({ id: d.id, ...d.data() } as Team));
                allTeams.sort((a, b) => {
                    const aTime = (a.createdAt as any)?.toMillis ? (a.createdAt as any).toMillis() : new Date((a.createdAt as any) || 0).getTime();
                    const bTime = (b.createdAt as any)?.toMillis ? (b.createdAt as any).toMillis() : new Date((b.createdAt as any) || 0).getTime();
                    return bTime - aTime;
                });
            } catch (queryErr) {
                console.warn("Teams query fallback:", queryErr);
            }
            setTeams(allTeams);

            if (user) {
                // Fetch my teams
                const memberQ = query(collection(db, 'team_members'), where('userId', '==', user.uid));
                const memberSnap = await getDocs(memberQ);
                const myTeamIds = memberSnap.docs.map(d => d.data().teamId);
                
                setMyTeams(allTeams.filter(t => myTeamIds.includes(t.id) || t.ownerId === user.uid));
            }
        } catch (error: any) {
            console.error("Error fetching teams:", error);
            setFetchError(error?.message || "Something went wrong while loading teams.");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTeam = async () => {
        if (!user || !newTeamName.trim()) return;

        if (myTeams.length >= 1) {
            showToast('You can only be in one team at a time.', 'error');
            return;
        }

        setCreating(true);
        try {
            // Use a pre-generated ref so team and member writes are atomic via writeBatch.
            // Sequential addDoc calls could leave an orphaned team with no admin member
            // on partial failure (BUG-052).
            const teamRef = doc(collection(db, 'teams'));
            const memberRef = doc(collection(db, 'team_members'));
            const userRef = doc(db, 'users', user.uid);
            const publicUserRef = doc(db, 'users_public', user.uid);

            const batch = writeBatch(db);

            batch.set(teamRef, {
                name: newTeamName,
                description: newTeamDesc,
                logoUrl: newTeamLogo,
                ownerId: user.uid,
                createdAt: serverTimestamp()
            });

            // Add creator as admin member — satisfies canJoinTeam() admin self-join path
            batch.set(memberRef, {
                teamId: teamRef.id,
                userId: user.uid,
                role: 'admin',
                joinedAt: serverTimestamp()
            });

            // Auto-fill team name and ID in profile
            batch.update(userRef, {
                teamName: newTeamName,
                teamId: teamRef.id
            });
            batch.set(publicUserRef, {
                teamName: newTeamName,
                teamId: teamRef.id
            }, { merge: true });

            await batch.commit();


            showToast('Team created successfully!', 'success');
            setIsCreating(false);
            setNewTeamName('');
            setNewTeamDesc('');
            setNewTeamLogo('');
            fetchTeams();
            navigate(`/team/${teamRef.id}`);
        } catch (error: any) {
            console.error("Error creating team:", error);
            showToast('Failed to create team', 'error');
        } finally {
            setCreating(false);
        }
    };

    const filteredTeams = teams.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <>
        <Seo
            title="Esports Teams | NexPlay — Nepal"
            description="Discover esports teams in Nepal on NexPlay. View team profiles, rosters, and achievements."
            canonicalPath="/teams"
            jsonLd={{
                "@context": "https://schema.org",
                "@type": "ItemList",
                "name": "Esports Teams in Nepal",
                "description": "Discover esports teams in Nepal on NexPlay.",
                "url": `https://www.nexplayorg.app/teams`
            }}
        />
        <div className="animate-fade-in max-w-5xl mx-auto p-4 md:p-8">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6 border-b border-gray-800 pb-8">
                <div>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white uppercase tracking-tighter mb-2">Teams</h1>
                    <p className="text-gray-400 font-bold">Discover and join teams, or create your own.</p>
                </div>
                {user && (
                    <button type="button" 
                        onClick={() => {
                            if (myTeams.length >= 1) {
                                showToast('You can only be in one team at a time.', 'error');
                                return;
                            }
                            setIsCreating(true);
                        }}
                        className="bg-brand-500 hover:bg-brand-400 text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest transition flex items-center gap-2 shadow-lg"
                    >
                        <Plus className="w-5 h-5" /> Create Team
                    </button>
                )}
            </header>

            {isCreating && (
                <div className="bg-card/50 p-5 sm:p-8 rounded-2xl sm:rounded-3xl border border-gray-800 shadow-2xl mb-6 sm:mb-12 animate-fade-in">
                    <h3 className="text-xl font-black text-white uppercase tracking-widest mb-8">Create New Team</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <div>
                                <label className="text-xs text-gray-500 uppercase font-black tracking-widest mb-2 block">Team Name *</label>
                                <input 
                                    type="text" 
                                    value={newTeamName} 
                                    onChange={(e) => setNewTeamName(e.target.value)}
                                    className="w-full bg-black border border-gray-800 rounded-2xl px-5 py-4 text-white focus:border-brand-500 focus-visible:outline-none transition font-bold"
                                    placeholder="e.g. Cloud9"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 uppercase font-black tracking-widest mb-2 block">Description</label>
                                <textarea 
                                    value={newTeamDesc} 
                                    onChange={(e) => setNewTeamDesc(e.target.value)}
                                    className="w-full bg-black border border-gray-800 rounded-2xl px-5 py-4 text-white focus:border-brand-500 focus-visible:outline-none transition h-32 resize-none text-sm font-bold"
                                    placeholder="What is your team about?"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 uppercase font-black tracking-widest mb-2 block">Team Logo (Drag/Paste/Click to Select)</label>
                            <div className="flex flex-col items-start gap-4">
                                <div 
                                    onPaste={handlePaste}
                                    onDrop={handleDrop}
                                    onDragOver={handleDragOver}
                                    onClick={() => document.getElementById('team-logo-file-input')?.click()}
                                    className={`relative w-40 h-40 rounded-3xl border-2 border-dashed transition-colors flex flex-center justify-center overflow-hidden group cursor-pointer ${isUploadingLogo ? 'border-brand-500 bg-brand-500/10' : 'border-gray-800 hover:border-brand-500 bg-black'}`}
                                >
                                    <input 
                                        id="team-logo-file-input"
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                            if (e.target.files?.[0]) {
                                                processAndUpload(e.target.files[0]);
                                            }
                                        }}
                                    />
                                    {isUploadingLogo ? (
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                                            <span className="text-[10px] text-brand-400 font-bold uppercase">Uploading...</span>
                                        </div>
                                    ) : (
                                        <>
                                            <img 
                                                src={newTeamLogo || DEFAULT_TEAM_LOGO || undefined} 
                                                alt="Team Logo Preview" 
                                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition"
                                                onError={(e) => (e.currentTarget.src = NEXPLAY_LOGO)}
                                                referrerPolicy="no-referrer" loading="lazy" />
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition">
                                                <Plus className="w-8 h-8 text-white" />
                                            </div>
                                        </>
                                    )}
                                </div>
                                <button
                                    onClick={() => setShowPresetModal(true)}
                                    className="text-[10px] font-black uppercase tracking-widest text-brand-400 hover:text-brand-300 transition bg-brand-500/10 px-3 py-1.5 rounded-full border border-brand-500/20 flex items-center gap-1"
                                >
                                    <ImageIcon className="w-3 h-3" /> Choose Preset
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                        <button type="button" 
                            onClick={() => setIsCreating(false)}
                            className="px-6 py-3 rounded-xl font-bold text-gray-400 hover:text-white transition"
                        >
                            Cancel
                        </button>
                        <button type="button" 
                            onClick={handleCreateTeam}
                            disabled={creating || !newTeamName.trim()}
                            className="bg-brand-600 hover:bg-brand-500 disabled:bg-surface text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest transition shadow-lg flex items-center gap-2"
                        >
                            {creating ? 'Creating...' : 'Create Team'}
                        </button>
                    </div>
                </div>
            )}

            <Modal isOpen={showPresetModal} onClose={() => setShowPresetModal(false)} title="Choose Preset Team Logo">
                <div className="p-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                        {PRESET_TEAM_LOGOS.map((url, index) => (
                            <button
                                key={index}
                                onClick={() => {
                                    setNewTeamLogo(url);
                                    setShowPresetModal(false);
                                }}
                                className="relative group rounded-2xl overflow-hidden border-2 border-gray-800 hover:border-brand-500 transition-colors aspect-square bg-dark"
                            >
                                <img src={url} alt={`Preset ${index + 1}`} className="w-full h-full object-cover p-2" loading="lazy" />
                                <div className="absolute inset-0 bg-brand-500/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <CheckCircle2 className="w-8 h-8 text-brand-400 drop-shadow-lg" />
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </Modal>

            {user && myTeams.length > 0 && (
                <div className="mb-16">
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-8 border-b border-gray-800 pb-4">My Teams</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {myTeams.map(team => (
                            <Link to={`/team/${team.id}`} key={team.id} className="bg-card/50 rounded-2xl sm:rounded-3xl border border-gray-800 p-5 sm:p-8 hover:border-brand-500/50 transition group hover:bg-card">
                                <div className="flex items-center gap-6 mb-6">
                                    <div className="w-20 h-20 rounded-2xl bg-black border border-gray-800 overflow-hidden flex items-center justify-center shrink-0">
                                        <img 
                                            src={team.logoUrl || DEFAULT_TEAM_LOGO || undefined} 
                                            alt={team.name} 
                                            className="w-full h-full object-cover" 
                                            referrerPolicy="no-referrer" loading="lazy" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-white group-hover:text-brand-400 transition truncate">{team.name}</h3>
                                        {team.ownerId === user.uid && (
                                            <span className="inline-block text-[10px] bg-brand-500/10 text-brand-400 px-3 py-1 rounded-full uppercase font-black tracking-widest border border-brand-500/20 mt-2">Owner</span>
                                        )}
                                    </div>
                                </div>
                                <p className="text-sm text-gray-400 line-clamp-2">{team.description || 'No description provided.'}</p>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            <div>
                <div className="flex flex-col sm:flex-row justify-between sm:items-end border-b border-gray-800 pb-6 mb-10 gap-6">
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter">All Teams</h2>
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <input 
                            type="text" 
                            aria-label="Search teams"
                            value={searchTerm}
                            onChange={(e) => {
                                const val = e.target.value;
                                setSearchTerm(val);
                            }}
                            placeholder="Search teams..."
                            className="w-full bg-card/50 border border-gray-800 rounded-2xl pl-12 pr-4 py-3 text-sm text-white focus:border-brand-500 focus-visible:outline-none font-bold"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : fetchError ? (
                    <div role="alert" className="text-center py-20 bg-card/50 rounded-3xl border border-red-500/30">
                        <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                        <p className="text-red-300 font-black uppercase tracking-widest mb-2">Unable to Load Teams</p>
                        <p className="text-gray-400 font-bold max-w-sm mx-auto mb-8">{fetchError}</p>
                        <button
                            onClick={fetchTeams}
                            className="px-6 py-3 bg-brand-500 hover:bg-brand-600 text-black font-black uppercase tracking-widest rounded-xl transition"
                        >
                            Try Again
                        </button>
                    </div>
                ) : filteredTeams.length === 0 ? (
                    <div className="text-center py-20 bg-card/50 rounded-3xl border border-gray-800">
                        <Users className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                        <p className="text-gray-400 font-black uppercase tracking-widest">No teams found.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredTeams.map(team => (
                            <Link to={`/team/${team.id}`} key={team.id} className="bg-card/50 rounded-2xl sm:rounded-3xl border border-gray-800 p-5 sm:p-8 hover:border-brand-500/50 transition group hover:bg-card flex flex-col h-full">
                                <div className="flex items-center gap-6 mb-6">
                                    <div className="w-20 h-20 rounded-2xl bg-black border border-gray-800 overflow-hidden flex items-center justify-center shrink-0">
                                        <img 
                                            src={team.logoUrl || DEFAULT_TEAM_LOGO || undefined} 
                                            alt={team.name} 
                                            className="w-full h-full object-cover" 
                                            referrerPolicy="no-referrer" loading="lazy" />
                                    </div>
                                    <h3 className="text-xl font-black text-white group-hover:text-brand-400 transition line-clamp-1">{team.name}</h3>
                                </div>
                                <p className="text-sm text-gray-400 line-clamp-2 mb-8 flex-grow">{team.description || 'No description provided.'}</p>
                                <div className="flex items-center text-brand-300 text-sm font-black uppercase tracking-widest group-hover:translate-x-1 transition-transform mt-auto">
                                    View Team <ArrowRight className="w-5 h-5 ml-2" />
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
        </>
    );
};

export default Teams;
