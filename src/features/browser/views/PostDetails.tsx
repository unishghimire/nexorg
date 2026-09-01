import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../shared/config/firebase';
import { useAuth } from '../../../shared/context/AuthContext';
import { useNotification } from '../../../shared/context/NotificationContext';
import { OrgPost } from '../../../shared/types/types';
import Seo from '../../../shared/components/Seo';
import { ArrowLeft, Calendar, Trash2 } from 'lucide-react';
import { formatDate } from '../../../shared/utils/utils';
import ConfirmModal from '../../../shared/components/ConfirmModal';

const PostDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const { showToast } = useNotification();
    const navigate = useNavigate();

    const [post, setPost] = useState<OrgPost | null>(null);
    const [loading, setLoading] = useState(true);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [, setIsDeleting] = useState(false);

    useEffect(() => {
        const fetchPost = async () => {
            if (!id) return;
            try {
                const docRef = doc(db, 'org_posts', id);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setPost({ id: docSnap.id, ...docSnap.data() } as OrgPost);
                } else {
                    showToast('Post not found', 'error');
                }
            } catch (error) {
                console.error("Error fetching post:", error);
                showToast('Failed to load post', 'error');
            } finally {
                setLoading(false);
            }
        };
        fetchPost();
    }, [id]);

    const handleDelete = async () => {
        if (!id || !post) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(db, 'org_posts', id));
            showToast('Post deleted successfully', 'success');
            navigate(`/user/${post.orgId}`);
        } catch (error) {
            console.error("Error deleting post:", error);
            showToast('Failed to delete post', 'error');
        } finally {
            setIsDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-xs text-gray-500 font-black uppercase tracking-widest">Loading Post...</p>
            </div>
        );
    }

    if (!post) {
        return (
            <div className="text-center py-20">
                <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-4">Post Not Found</h2>
                <Link to="/" className="text-brand-500 hover:text-brand-400 font-bold flex items-center justify-center gap-2">
                    <ArrowLeft className="w-4 h-4" /> Back to Home
                </Link>
            </div>
        );
    }

    const isOwner = user?.uid === post.orgId;

    return (
        <div className="max-w-3xl mx-auto animate-fade-in pb-20">
            <Seo
                title={`${post.title} | NexPlay`}
                description={post.content?.substring(0, 150) || 'NexPlay article'}
                canonicalPath={`/post/${id}`}
                ogType="article"
                jsonLd={{
                    "@context": "https://schema.org",
                    "@type": "Article",
                    headline: post.title,
                    description: post.content?.substring(0, 150),
                    author: { "@type": "Organization", name: "NexPlay" },
                    publisher: { "@type": "Organization", name: "NexPlay" },
                    url: `https://www.nexplayorg.app/post/${id}`,
                }}
            />

            <Link to={`/user/${post.orgId}`} className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition mb-6 font-bold text-sm">
                <ArrowLeft className="w-4 h-4" /> Back to Profile
            </Link>

            <div className="bg-card rounded-2xl border border-gray-800 overflow-hidden shadow-2xl">
                {post.imageUrl && (
                    <div className="w-full h-64 md:h-96 relative">
                        <img src={post.imageUrl || undefined} alt={post.title} className="w-full h-full object-cover" loading="lazy" />
                        <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent"></div>
                    </div>
                )}
                
                <div className={`p-8 ${post.imageUrl ? '-mt-20 relative z-10' : ''}`}>
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                        <Link to={`/user/${post.orgId}`} className="flex items-center gap-3 group">
                            <div className="w-10 h-10 rounded-full bg-dark border-2 border-gray-700 overflow-hidden group-hover:border-brand-500 transition">
                                {post.orgAvatar ? (
                                    <img src={post.orgAvatar || undefined} alt={post.orgName} className="w-full h-full object-cover" loading="lazy" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-brand-600 text-white font-black">
                                        {post.orgName[0].toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <div>
                                <div className="text-sm font-black text-white group-hover:text-brand-400 transition">{post.orgName}</div>
                                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-1">
                                    <Calendar className="w-3 h-3" /> {formatDate(post.createdAt)}
                                </div>
                            </div>
                        </Link>

                        {isOwner && (
                            <button type="button" 
                                onClick={() => setShowDeleteConfirm(true)}
                                className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white px-3 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition flex items-center gap-2 border border-red-500/20"
                            >
                                <Trash2 className="w-4 h-4" /> Delete Post
                            </button>
                        )}
                    </div>

                    <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-6 break-words">{post.title}</h1>
                    
                    <div className="prose prose-invert max-w-none">
                        <p className="text-gray-300 leading-relaxed whitespace-pre-wrap text-lg">
                            {post.content}
                        </p>
                    </div>
                </div>
            </div>

            <ConfirmModal
                isOpen={showDeleteConfirm}
                onCancel={() => setShowDeleteConfirm(false)}
                onConfirm={handleDelete}
                title="Delete Post"
                message="Are you sure you want to delete this post? This action cannot be undone."
                isDestructive={true}
            />
        </div>
    );
};

export default PostDetails;
