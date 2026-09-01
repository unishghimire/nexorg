import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, serverTimestamp, orderBy, query } from 'firebase/firestore';
import { db } from '../../../../shared/config/firebase';
import { useAuth } from '../../../../shared/context/AuthContext';
import { useNotification } from '../../../../shared/context/NotificationContext';
import { useInvisibleImage } from '../../../../shared/hooks/useInvisibleImage';
import { MediaCategory } from '../../../../shared/services/mediaService';
import { OrgPost } from '../../../../shared/types/types';
import { Plus, Trash2, Newspaper, Camera } from 'lucide-react';
import { formatDate } from '../../../../shared/utils/utils';
import ConfirmModal from '../../../../shared/components/ConfirmModal';
import Modal from '../../../../shared/components/Modal';
import Seo from '../../../../shared/components/Seo';
import { AdminPanelTabProps } from './types';

const NewsTab: React.FC<AdminPanelTabProps> = ({ showToast }) => {
    const { user } = useAuth();
    const [posts, setPosts] = useState<OrgPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<OrgPost | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    const { handlePaste, handleDrop, handleDragOver, processAndUpload } = useInvisibleImage({
        onUploadStart: () => setIsUploading(true),
        onUploadEnd: () => setIsUploading(false),
        onUploadSuccess: (url) => setImageUrl(url),
        folder: 'news',
        category: MediaCategory.NEWS_IMAGE,
    });

    const fetchPosts = useCallback(async () => {
        try {
            // ponytail: client-side sort instead of composite index — org_posts has no index for createdAt orderBy
            const snap = await getDocs(collection(db, 'org_posts'));
            const all = snap.docs
                .map(d => ({ id: d.id, ...d.data() } as OrgPost))
                .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
            setPosts(all);
        } catch (e) {
            console.error('News fetch error:', e);
            showToast?.('Failed to load news', 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => { fetchPosts(); }, [fetchPosts]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !title.trim() || !content.trim()) return;
        setIsCreating(true);
        try {
            const newPost = {
                orgId: user.uid,
                orgName: 'NexPlay',
                orgAvatar: '',
                title: title.trim(),
                content: content.trim(),
                imageUrl: imageUrl.trim(),
                createdAt: serverTimestamp(),
            };
            const docRef = await addDoc(collection(db, 'org_posts'), newPost);
            setPosts(prev => [{ id: docRef.id, ...newPost, createdAt: { toMillis: () => Date.now() } } as OrgPost, ...prev]);
            showToast?.('News published!', 'success');
            setShowCreate(false);
            setTitle(''); setContent(''); setImageUrl('');
        } catch (err) {
            console.error('News create error:', err);
            showToast?.('Failed to publish news', 'error');
        } finally {
            setIsCreating(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await deleteDoc(doc(db, 'org_posts', deleteTarget.id));
            setPosts(prev => prev.filter(p => p.id !== deleteTarget.id));
            showToast?.('News deleted', 'info');
        } catch (err) {
            console.error('News delete error:', err);
            showToast?.('Failed to delete', 'error');
        } finally {
            setDeleteTarget(null);
        }
    };

    return (
        <>
            <Seo title="News Management — Admin | NexPlay" description="Manage news posts and announcements." noindex />
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                    <Newspaper className="w-6 h-6 text-brand-500" /> News Management
                </h2>
                <button type="button"
                    onClick={() => setShowCreate(true)}
                    className="bg-brand-500 hover:bg-brand-400 text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" /> New Post
                </button>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-3" />
                    <p className="text-xs text-gray-500 font-black uppercase tracking-widest">Loading News...</p>
                </div>
            ) : posts.length === 0 ? (
                <div className="text-center py-20">
                    <Newspaper className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                    <p className="text-gray-500 font-bold">No news posts yet. Create one to get started.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {posts.map(post => (
                        <div key={post.id} className="bg-dark p-5 rounded-2xl border border-gray-800 hover:border-gray-700 transition group flex gap-4 items-start">
                            {post.imageUrl && (
                                <img src={post.imageUrl} alt={post.title} className="w-20 h-20 rounded-xl object-cover shrink-0" loading="lazy" />
                            )}
                            <div className="flex-1 min-w-0">
                                <h3 className="text-lg font-black text-white group-hover:text-brand-400 transition truncate">{post.title}</h3>
                                <p className="text-gray-400 text-sm leading-relaxed line-clamp-2 mb-2">{post.content}</p>
                                <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                                    {post.orgName} • {formatDate(post.createdAt)}
                                </div>
                            </div>
                            <button type="button"
                                onClick={() => setDeleteTarget(post)}
                                className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white p-2.5 rounded-lg transition shrink-0"
                                aria-label="Delete post"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Create News Modal */}
            <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create News Post">
                <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:focus-visible:outline-none focus:border-brand-500 transition font-bold"
                            placeholder="News Headline"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Content</label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:focus-visible:outline-none focus:border-brand-500 transition h-32 resize-none text-sm"
                            placeholder="Write your news article here..."
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Cover Image</label>
                        <div
                            onPaste={handlePaste}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onClick={() => document.getElementById('news-image-input')?.click()}
                            className={`relative w-full aspect-video rounded-2xl border-2 border-dashed transition-colors flex flex-col items-center justify-center overflow-hidden group cursor-pointer mb-3 ${isUploading ? 'border-brand-500 bg-brand-500/10' : 'border-gray-700 hover:border-brand-500 bg-dark'}`}
                        >
                            {isUploading ? (
                                <div className="flex flex-col items-center gap-2">
                                    <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                                    <span className="text-[10px] text-brand-400 font-bold uppercase">Uploading...</span>
                                </div>
                            ) : imageUrl ? (
                                <>
                                    <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                        <Camera className="w-8 h-8 text-white" />
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center gap-2 p-4 text-center">
                                    <Camera className="w-8 h-8 text-gray-500 group-hover:text-brand-500 transition-colors" />
                                    <span className="text-[10px] text-gray-500 font-bold uppercase">Drag & Drop or Click to Upload</span>
                                </div>
                            )}
                        </div>
                        <input id="news-image-input" type="file" accept="image/*" className="hidden"
                            onChange={(e) => { if (e.target.files?.[0]) processAndUpload(e.target.files[0]); }} />
                        <input
                            type="url"
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                            className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:focus-visible:outline-none focus:border-brand-500 transition font-mono text-xs"
                            placeholder="Or paste direct image URL here..."
                        />
                    </div>
                    <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-800">
                        <button type="button" onClick={() => setShowCreate(false)}
                            className="px-6 py-3 rounded-xl font-bold text-gray-400 hover:text-white transition">Cancel</button>
                        <button type="submit" disabled={isCreating || !title.trim() || !content.trim()}
                            className="bg-brand-600 hover:bg-brand-500 text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest transition shadow-lg disabled:opacity-50">
                            {isCreating ? 'Publishing...' : 'Publish News'}
                        </button>
                    </div>
                </form>
            </Modal>

            <ConfirmModal
                isOpen={!!deleteTarget}
                onCancel={() => setDeleteTarget(null)}
                onConfirm={handleDelete}
                title="Delete News Post"
                message="Are you sure you want to delete this news post? This action cannot be undone."
                isDestructive={true}
            />
        </>
    );
};

export default NewsTab;
