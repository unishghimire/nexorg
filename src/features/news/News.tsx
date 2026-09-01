import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../shared/config/firebase';
import { OrgPost } from '../../shared/types/types';
import Seo from '../../shared/components/Seo';
import { formatDate } from '../../shared/utils/utils';
import { Calendar, ArrowLeft, Newspaper } from 'lucide-react';

const News: React.FC = () => {
    const [posts, setPosts] = useState<OrgPost[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchNews = useCallback(async () => {
        try {
            // ponytail: client-side sort — no composite index needed for createdAt orderBy
            const snap = await getDocs(collection(db, 'org_posts'));
            const all = snap.docs
                .map(d => ({ id: d.id, ...d.data() } as OrgPost))
                .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
            setPosts(all);
        } catch (e) {
            console.error('News fetch error:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchNews(); }, [fetchNews]);

    if (loading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-xs text-gray-500 font-black uppercase tracking-widest">Loading News...</p>
            </div>
        );
    }

    return (
        <>
            <Seo
                title="Esports News Nepal — Latest Tournament Updates | NexPlay"
                description="Latest Nepal esports news, tournament announcements, match results, and community updates from NexPlay."
                canonicalPath="/news"
                jsonLd={{
                    "@context": "https://schema.org",
                    "@type": "Blog",
                    "name": "NexPlay Esports News",
                    "description": "Latest Nepal esports news, tournament announcements, match results, and community updates from NexPlay.",
                    "url": `https://www.nexplayorg.app/news`
                }}
            />
            <div className="max-w-4xl mx-auto px-4 pb-20">
                <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter text-white mb-2 flex items-center gap-3">
                    <Newspaper className="w-8 h-8 text-brand-500" /> Esports News
                </h1>
                <p className="text-gray-400 text-sm mb-8">Tournament recaps, announcements, and community updates.</p>

                {posts.length === 0 ? (
                    <div className="text-center py-20">
                        <Newspaper className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                        <p className="text-gray-500 font-bold">No news yet. Check back soon!</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {posts.map(post => (
                            <Link
                                key={post.id}
                                to={`/post/${post.id}`}
                                className="block bg-card rounded-2xl border border-gray-800 overflow-hidden shadow-xl hover:border-brand-500/50 transition group"
                            >
                                {post.imageUrl && (
                                    <div className="w-full h-48 sm:h-56 relative overflow-hidden">
                                        <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                                    </div>
                                )}
                                <div className={`p-6 ${post.imageUrl ? '-mt-16 relative z-10' : ''}`}>
                                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">
                                        <span className="bg-brand-500/20 text-brand-400 px-2 py-1 rounded truncate max-w-full">{post.orgName}</span>
                                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(post.createdAt)}</span>
                                    </div>
                                    <h2 className="text-xl sm:text-2xl font-black text-white group-hover:text-brand-400 transition mb-2">{post.title}</h2>
                                    <p className="text-gray-400 text-sm leading-relaxed line-clamp-2">{post.content}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}

                <Link to="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition font-bold text-sm mt-10">
                    <ArrowLeft className="w-4 h-4" /> Back to Home
                </Link>
            </div>
        </>
    );
};

export default News;
