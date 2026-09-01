import Seo from '../../../shared/components/Seo';
import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, where, addDoc, deleteDoc, doc, limit } from 'firebase/firestore';
import { db } from '../../../shared/config/firebase';
import { useAuth } from '../../../shared/context/AuthContext';
import { useNotification } from '../../../shared/context/NotificationContext';
import { Search, UserPlus, UserMinus, Building2, ChevronRight, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';

const OrgBrowser: React.FC = () => {
    const { user } = useAuth();
    const { showToast } = useNotification();
    const [orgs, setOrgs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [following, setFollowing] = useState<Set<string>>(new Set());
    const [togglingId, setTogglingId] = useState<string | null>(null);

    useEffect(() => {
        fetchOrgs();
        if (user) fetchFollowing();
    }, [user]);

    const fetchOrgs = async () => {
        setLoading(true);
        try {
            const snap = await getDocs(query(collection(db, 'users_public'), where('role', 'in', ['organizer', 'admin']), limit(200)));
            const orgsData = snap.docs
                .map(d => ({ uid: d.id, ...(d.data() as any) }))
                .filter((d: any) => d.role === 'organizer' || d.role === 'admin' || (d.orgName && d.orgName.trim() !== ''));
            setOrgs(orgsData);
        } catch (error: any) {
            console.error('FetchOrganizersFailed:', error);
            try {
                const fallbackSnap = await getDocs(query(collection(db, 'users_public'), limit(200)));
                const fallbackData = fallbackSnap.docs
                    .map(d => ({ uid: d.id, ...(d.data() as any) }))
                    .filter((d: any) => d.role === 'organizer' || d.role === 'admin' || (d.orgName && d.orgName.trim() !== ''));
                setOrgs(fallbackData);
            } catch (fbErr) {
                console.error('FallbackFetchOrganizersFailed:', fbErr);
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchFollowing = async () => {
        if (!user) return;
        try {
            const snap = await getDocs(query(collection(db, 'follows'), where('followerId', '==', user.uid)));
            setFollowing(new Set(snap.docs.map(d => d.data().followingId)));
        } catch (error: any) {
            console.error('FetchFollowingListFailed:', error);
        }
    };

    const handleToggleFollow = async (orgId: string) => {
        if (!user) {
            showToast('Please login to follow', 'warning');
            return;
        }

        setTogglingId(orgId);
        const isCurrentlyFollowing = following.has(orgId);
        try {
            if (isCurrentlyFollowing) {
                const snap = await getDocs(query(
                    collection(db, 'follows'),
                    where('followerId', '==', user.uid),
                    where('followingId', '==', orgId)
                ));
                if (!snap.empty) {
                    await deleteDoc(doc(db, 'follows', snap.docs[0].id));
                    setFollowing(prev => { const next = new Set(prev); next.delete(orgId); return next; });
                    showToast('Unfollowed', 'success');
                }
            } else {
                await addDoc(collection(db, 'follows'), {
                    followerId: user.uid,
                    followingId: orgId,
                    createdAt: new Date()
                });
                setFollowing(prev => new Set(prev).add(orgId));
                showToast('Following', 'success');
            }        } catch (error: any) {
            console.error('FollowToggleFailed:', error);
            showToast('Action failed. Try again.', 'error');
        } finally {
            setTogglingId(null);
        }
    };

    const filteredOrgs = orgs.filter(o =>
        (o.username?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (o.orgName?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const featured = filteredOrgs.slice(0, 3);
    const rest = filteredOrgs.slice(3);

    return (
        <>
        <Seo
            title="Esports Organizers in Nepal | NexPlay"
            description="Browse esports tournament organizers in Nepal on NexPlay."
            canonicalPath="/organizations"
            jsonLd={{
                "@context": "https://schema.org",
                "@type": "ItemList",
                "name": "Esports Organizers in Nepal",
                "description": "Browse esports tournament organizers in Nepal on NexPlay.",
                "url": `https://www.nexplayorg.app/organizations`
            }}
        />
        <div className="max-w-6xl mx-auto animate-fade-in pb-20">
            {/* Header */}
            <div className="mb-12 border-b border-gray-800 pb-10">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div>
                        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white uppercase tracking-tighter leading-none mb-2 flex items-center gap-4">
                            <Building2 className="w-8 h-8 text-brand-500" />
                            Organizations
                        </h1>
                        <p className="text-gray-400 font-bold max-w-lg">
                            Discover and follow tournament organizers to stay ahead of competitions.
                        </p>
                    </div>
                    <div className="flex items-center gap-3 bg-card/50 px-6 py-3 rounded-2xl border border-gray-800">
                        <Users className="w-5 h-5 text-brand-500" />
                        <span className="text-white font-black tracking-widest uppercase text-sm">{orgs.length} Organizers</span>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="relative mb-12 bg-card/50 p-6 rounded-3xl border border-gray-800">
                <Search className="absolute left-10 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                    type="text"
                    aria-label="Search organizations"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name or organization..."
                    className="w-full bg-black border border-gray-800 rounded-2xl py-4 pl-12 pr-6 text-white focus:border-brand-500 focus-visible:outline-none transition-colors shadow-xl font-bold"
                />
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="bg-card/50 h-48 rounded-3xl animate-pulse border border-gray-800" />
                    ))}
                </div>
            ) : filteredOrgs.length === 0 ? (
                <div className="bg-card/50 p-16 rounded-3xl border border-gray-800 text-center">
                    <Building2 className="w-16 h-16 text-gray-700 mx-auto mb-6" />
                    <h3 className="text-2xl font-black text-white uppercase mb-2">No Organizations Found</h3>
                    <p className="text-gray-500 font-bold max-w-sm mx-auto mb-8">
                        {searchTerm ? `No results for "${searchTerm}". Try a different search.` : 'No organizers have registered yet. Check back soon.'}
                    </p>
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="text-brand-500 font-black uppercase tracking-widest hover:text-brand-400 transition-colors"
                        >
                            Clear Search
                        </button>
                    )}
                </div>
            ) : (
                <>
                    {/* Featured strip — top 3 */}
                    {!searchTerm && featured.length > 0 && (
                        <section className="mb-16">
                            <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-6 flex items-center gap-3">
                                <span className="inline-block w-6 h-px bg-brand-500"></span>
                                Featured Organizations
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {featured.map((org, i) => (
                                    <motion.div
                                        key={org.uid}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.08 }}
                                        className="relative bg-card/50 rounded-[2rem] border border-brand-500/20 overflow-hidden group hover:border-brand-500/50 transition-colors shadow-xl"
                                    >
                                        {/* Banner strip */}
                                        <div className="h-20 bg-gradient-to-r from-brand-900/60 via-brand-800/30 to-black relative">
                                            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
                                        </div>

                                        <div className="px-6 pb-6 -mt-8 relative">
                                            <div className="flex items-end justify-between mb-4">
                                                <div className="w-16 h-16 rounded-2xl border-4 border-gray-950 bg-black overflow-hidden shadow-xl">
                                                    <img
                                                        src={org.profilePicUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${org.username}`}
                                                        alt={org.username}
                                                        className="w-full h-full object-cover" loading="lazy" />
                                                </div>
                                                <span className="bg-brand-500/10 text-brand-400 border border-brand-500/20 px-3 py-1 rounded-full text-xs uppercase font-black tracking-widest">
                                                    Organizer
                                                </span>
                                            </div>

                                            <h3 className="text-lg font-black text-white uppercase tracking-tight truncate mb-1 group-hover:text-brand-400 transition">
                                                {org.orgName || org.username}
                                            </h3>
                                            <p className="text-xs text-gray-500 font-bold mb-6 truncate">@{org.username}</p>

                                            <div className="flex gap-2">
                                                <Link
                                                    to={`/profile/${org.uid}`}
                                                    className="flex-1 bg-surface hover:bg-surface text-white py-2.5 rounded-xl text-center font-black text-xs uppercase tracking-widest transition flex items-center justify-center gap-2"
                                                >
                                                    Profile <ChevronRight className="w-3 h-3" />
                                                </Link>
                                                {user && user.uid !== org.uid && (
                                                    <button
                                                        onClick={() => handleToggleFollow(org.uid)}
                                                        disabled={togglingId === org.uid}
                                                        className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition flex items-center gap-2 ${
                                                            following.has(org.uid)
                                                                ? 'bg-surface text-gray-400 hover:bg-red-500/10 hover:text-red-400 border border-gray-700 hover:border-red-500/30'
                                                                : 'bg-brand-500/10 text-brand-400 border border-brand-500/20 hover:bg-brand-500 hover:text-white'
                                                        } disabled:opacity-50`}
                                                        aria-label={following.has(org.uid) ? 'Unfollow' : 'Follow'}
                                                    >
                                                        {togglingId === org.uid ? (
                                                            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                        ) : following.has(org.uid) ? (
                                                            <UserMinus className="w-4 h-4" />
                                                        ) : (
                                                            <UserPlus className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Full list */}
                    <section>
                        <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-6 flex items-center gap-3">
                            <span className="inline-block w-6 h-px bg-surface"></span>
                            {searchTerm ? `Results for "${searchTerm}"` : 'All Organizations'}
                        </h2>
                        <div className="space-y-3">
                            {(searchTerm ? filteredOrgs : rest).map((org, index) => (
                                <motion.div
                                    key={org.uid}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.04 }}
                                    className="bg-card/50 rounded-3xl border border-gray-800 p-6 flex items-center justify-between gap-6 hover:border-gray-700 hover:bg-card transition-colors group"
                                >
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className="w-14 h-14 rounded-2xl bg-black border border-gray-800 overflow-hidden shrink-0">
                                            <img
                                                src={org.profilePicUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${org.username}`}
                                                alt={org.username}
                                                className="w-full h-full object-cover" loading="lazy" />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-base font-black text-white uppercase tracking-tight truncate group-hover:text-brand-400 transition">
                                                {org.orgName || org.username}
                                            </h3>
                                            <p className="text-xs text-gray-500 font-bold truncate">@{org.username}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0">
                                        <Link
                                            to={`/profile/${org.uid}`}
                                            className="flex items-center gap-2 bg-surface hover:bg-surface text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition"
                                        >
                                            View <ChevronRight className="w-3 h-3" />
                                        </Link>
                                        {user && user.uid !== org.uid && (
                                            <button
                                                onClick={() => handleToggleFollow(org.uid)}
                                                disabled={togglingId === org.uid}
                                                className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition flex items-center gap-2 ${
                                                    following.has(org.uid)
                                                        ? 'bg-surface text-gray-400 hover:bg-red-500/10 hover:text-red-400 border border-gray-700 hover:border-red-500/30'
                                                        : 'bg-brand-500/10 text-brand-400 border border-brand-500/20 hover:bg-brand-500 hover:text-white'
                                                } disabled:opacity-50`}
                                                aria-label={following.has(org.uid) ? 'Unfollow' : 'Follow'}
                                            >
                                                {togglingId === org.uid ? (
                                                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                ) : following.has(org.uid) ? (
                                                    <><UserMinus className="w-4 h-4" /><span className="hidden sm:inline">Unfollow</span></>
                                                ) : (
                                                    <><UserPlus className="w-4 h-4" /><span className="hidden sm:inline">Follow</span></>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </section>
                </>
            )}
        </div>
        </>
    );
};

export default OrgBrowser;
