import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, orderBy, limit, setDoc, serverTimestamp, getDoc, writeBatch, Timestamp } from 'firebase/firestore';
import { db, auth } from '../../../shared/config/firebase';
import { useAuth } from '../../../shared/context/AuthContext';
import { Transaction, UserProfile, Slide, PromoCode, Game, PaymentMethod, PaymentCategory, SiteSettings, DiscordWebhooksConfig, OrgApplication, Tournament, TournamentEarning } from '../../../shared/types/types';
import { GameScoringConfig } from '../../../shared/types/scoring';
import { DEFAULT_BANNER, NEXPLAY_LOGO } from '../../../shared/constants/constants';
import { ImageUploader } from '../../../shared/components/ImageUploader';
import { formatCurrency, formatDate, formatGameName, toDateSafe } from '../../../shared/utils/utils';
import { NotificationService } from '../../../shared/services/NotificationService';
import { useInvisibleImage } from '../../../shared/hooks/useInvisibleImage';
import { MediaCategory, deleteImage } from '../../../shared/services/mediaService';

export function useAdminData(showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void) {
    const { profile } = useAuth();
    const [activeTab, setActiveTab] = useState('tab-dashboard');
    const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>([]);
    const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
    const [allTournaments, setAllTournaments] = useState<Tournament[]>([]);
    const [orgApplications, setOrgApplications] = useState<OrgApplication[]>([]);
    const [organizers, setOrganizers] = useState<UserProfile[]>([]);
    const [orgTournaments, setOrgTournaments] = useState<Tournament[]>([]);
    const [selectedOrgId, setSelectedOrgId] = useState<string>('');
    const [slides, setSlides] = useState<Slide[]>([]);
    const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [games, setGames] = useState<Game[]>([]);
    const [paymentCategories, setPaymentCategories] = useState<PaymentCategory[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [stats, setStats] = useState({ totalBalance: 0, todayDep: 0, todayWith: 0 });

    // Game Form State
    const [isGameModalOpen, setIsGameModalOpen] = useState(false);
    const [editingGame, setEditingGame] = useState<Game | null>(null);
    const [gameName, setGameName] = useState('');
    const [gameLogo, setGameLogo] = useState('');
    const [gameModes, setGameModes] = useState('');
    const [isPublished, setIsPublished] = useState(true);
    const [uploading, setUploading] = useState(false);

    // Scoring Config State
    const [scoringModalGame, setScoringModalGame] = useState<Game | null>(null);
    const [isScoringModalOpen, setIsScoringModalOpen] = useState(false);

    // Payment Category Form State
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<PaymentCategory | null>(null);
    const [categoryName, setCategoryName] = useState('');
    const [categoryDescription, setCategoryDescription] = useState('');
    const [categoryActive, setCategoryActive] = useState(true);

    // Payment Method Form State
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [editingPayment, setEditingPayment] = useState<PaymentMethod | null>(null);
    const [paymentCategoryId, setPaymentCategoryId] = useState('');
    const [paymentName, setPaymentName] = useState('');
    const [paymentQr, setPaymentQr] = useState('');
    const [paymentInstructions, setPaymentInstructions] = useState('');
    const [paymentType, setPaymentType] = useState('eSewa');
    const [paymentActive, setPaymentActive] = useState(true);
    const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);

    // Promo Form State
    const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
    const [editingPromo, setEditingPromo] = useState<PromoCode | null>(null);
    const [promoCode, setPromoCode] = useState('');
    const [promoAmount, setPromoAmount] = useState('');
    const [promoMaxUses, setPromoMaxUses] = useState('');
    const [promoActive, setPromoActive] = useState(true);

    // Slide Form State
    const [isSlideModalOpen, setIsSlideModalOpen] = useState(false);
    const [editingSlide, setEditingSlide] = useState<Slide | null>(null);
    const [slideTitle, setSlideTitle] = useState('');
    const [slideDescription, setSlideDescription] = useState('');
    const [slideImage, setSlideImage] = useState('');
    const [slideLink, setSlideLink] = useState('');
    const [slideBtnText, setSlideBtnText] = useState('View More');
    const [slideIsActive, setSlideIsActive] = useState(true);

    // Settings State
    const [minWithdrawal, setMinWithdrawal] = useState('');
    const [supportEmail, setSupportEmail] = useState('');
    const [supportPhone, setSupportPhone] = useState('');
    const [notice, setNotice] = useState('');
    const [isNoticeActive, setIsNoticeActive] = useState(false);
    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [orgFormDescription, setOrgFormDescription] = useState('');
    const [discordWebhookTournaments, setDiscordWebhookTournaments] = useState('');
    const [autoDiscordTournamentAnnouncements, setAutoDiscordTournamentAnnouncements] = useState(true);
    const [discordWebhooks, setDiscordWebhooks] = useState<DiscordWebhooksConfig>({
        tournaments: {
            announcement: '',
            registration: '',
            group: '',
            matchSchedule: '',
            result: '',
            champion: '',
        },
        scrims: {
            announcement: '',
            registration: '',
            group: '',
            matchSchedule: '',
            result: '',
            champion: '',
        },
        autoAnnounce: {
            tournaments: true,
            scrims: true,
        },
    });
    const [allDisputes, setAllDisputes] = useState<any[]>([]);

    // New UX State
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [activityLogs, setActivityLogs] = useState<any[]>([]);
    const [txDateFrom, setTxDateFrom] = useState('');
    const [txDateTo, setTxDateTo] = useState('');

    // Media Library States
    const [mediaItems, setMediaItems] = useState<any[]>([]);
    const [mediaLoading, setMediaLoading] = useState(false);
    const [mediaFilter, setMediaFilter] = useState("ALL");
    const [mediaSearch, setMediaSearch] = useState("");
    const [directUploadUrl, setDirectUploadUrl] = useState("");
    const [selectedMediaCategory, setSelectedMediaCategory] = useState<MediaCategory>(MediaCategory.OTHER);

    const fetchMedia = async () => {
        setMediaLoading(true);
        try {
            const q = query(collection(db, "media"), orderBy("createdAt", "desc"));
            const snap = await getDocs(q);
            const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMediaItems(items);
        } catch (err) {
            console.error("Error fetching media library records:", err);
        } finally {
            setMediaLoading(false);
        }
    };

    const handleDeleteMedia = async (mediaId: string, url: string, publicId?: string) => {
        setConfirmModal({
            isOpen: true,
            title: "Delete Image Reference",
            message: `Are you sure you want to delete this image reference? This action will permanently remove it from Cloudinary and the catalog library. URL: ${url}`,
            isDestructive: true,
            onConfirm: async () => {
                const actualPublicId = publicId || url;
                const success = await deleteImage(mediaId, actualPublicId);
                if (success) {
                    showToast("Media asset deleted successfully from Cloudinary and catalog!", "success");
                    await fetchMedia();
                } else {
                    showToast("Failed to delete media reference.", "error");
                }
                closeConfirmModal();
            }
        });
    };

    useEffect(() => {
        if (activeTab === "tab-media") {
            fetchMedia();
        }
    }, [activeTab]);

    const { handlePaste: handlePasteSlide, handleDrop: handleDropSlide, handleDragOver: handleDragOverSlide, processAndUpload: processAndUploadSlide } = useInvisibleImage({
        onUploadStart: () => setUploading(true),
        onUploadEnd: () => setUploading(false),
        onUploadSuccess: (url) => setSlideImage(url),
        onError: (err) => showToast(err, 'error'),
        category: MediaCategory.OVERLAY_GRAPHIC });

    const { handlePaste: handlePasteGame, handleDrop: handleDropGame, handleDragOver: handleDragOverGame, processAndUpload: processAndUploadGame } = useInvisibleImage({
        onUploadStart: () => setUploading(true),
        onUploadEnd: () => setUploading(false),
        onUploadSuccess: (url) => setGameLogo(url),
        onError: (err) => showToast(err, 'error'),
        category: MediaCategory.OTHER });

    const { handlePaste: handlePastePayment, handleDrop: handleDropPayment, handleDragOver: handleDragOverPayment, processAndUpload: processAndUploadPayment } = useInvisibleImage({
        onUploadStart: () => setUploading(true),
        onUploadEnd: () => setUploading(false),
        onUploadSuccess: (url) => setPaymentQr(url),
        onError: (err) => showToast(err, 'error'),
        category: MediaCategory.OTHER });

    // Transaction Review State
    const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');

    // User Management State
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [adjustmentAmount, setAdjustmentAmount] = useState('');
    const [adjustmentType, setAdjustmentType] = useState<'add' | 'subtract'>('add');

    // Organizer Edit State
    const [isOrgEditModalOpen, setIsOrgEditModalOpen] = useState(false);
    const [editingOrg, setEditingOrg] = useState<UserProfile | null>(null);
    const [orgEmail, setOrgEmail] = useState('');
    const [orgDiscord, setOrgDiscord] = useState('');
    const [orgYoutube, setOrgYoutube] = useState('');
    const [orgWhatsapp, setOrgWhatsapp] = useState('');
    const [orgNameEdit, setOrgNameEdit] = useState('');

    // Transaction Filter State
    const [txFilterStatus, setTxFilterStatus] = useState<'all' | 'pending' | 'success' | 'rejected' | 'refunded'>('all');
    const [txFilterType, setTxFilterType] = useState<'all' | 'deposit' | 'withdrawal' | 'prize' | 'refund' | 'entry_fee'>('all');
    const [txFilterTournament, setTxFilterTournament] = useState<string>('all');
    const [txSearchUser, setTxSearchUser] = useState('');
    const [tournamentEarnings, setTournamentEarnings] = useState<TournamentEarning[]>([]);

    // Confirm Modal State
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
        onConfirm: () => {} });

    const closeConfirmModal = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));

    const getRelativeTime = (timestamp: any) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
        
        if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
        return `${Math.floor(diffInSeconds / 86400)} days ago`;
    };

    const logAdminAction = async (action: string, details: string) => {
        if (!profile) return;
        try {
            await setDoc(doc(collection(db, 'activityLogs')), {
                adminId: profile.uid,
                adminEmail: profile.email,
                action,
                details,
                timestamp: serverTimestamp()
            });
        } catch (error) {
            console.error("Failed to log admin action:", error);
        }
    };

    useEffect(() => {
        if (profile?.role !== 'admin') return;

        const fetchData = async () => {
            // ponytail: Promise.allSettled — each query is independent.
            // One failed collection (missing index, permissions) no longer blocks the rest.
            const results = await Promise.allSettled([
                // 0: pending transactions
                getDocs(query(collection(db, 'transactions'), where('status', '==', 'pending'))),
                // 1: all recent transactions
                getDocs(query(collection(db, 'transactions'), orderBy('timestamp', 'desc'), limit(100))),
                // 2: all tournaments
                getDocs(query(collection(db, 'tournaments'), orderBy('createdAt', 'desc'), limit(500))),
                // 3: slides
                getDocs(query(collection(db, 'slides'), orderBy('createdAt', 'desc'), limit(200))),
                // 4: promo codes
                getDocs(query(collection(db, 'promocodes'), orderBy('createdAt', 'desc'), limit(200))),
                // 5: games
                getDocs(query(collection(db, 'games'), orderBy('createdAt', 'desc'), limit(200))),
                // 6: payment categories
                getDocs(query(collection(db, 'paymentCategories'), limit(200))),
                // 7: payment methods
                getDocs(query(collection(db, 'paymentMethods'), limit(200))),
                // 8: org applications
                getDocs(query(collection(db, 'orgApplications'), where('status', '==', 'pending'))),
                // 9: organizers + admins
                getDocs(query(collection(db, 'users'), where('role', 'in', ['organizer', 'admin']))),
                // 10: users (up to 500)
                getDocs(query(collection(db, 'users'), limit(500))),
                // 11: activity logs
                getDocs(query(collection(db, 'activityLogs'), orderBy('timestamp', 'desc'), limit(10))),
                // 12: tournament earnings
                getDocs(query(collection(db, 'tournamentEarnings'), orderBy('createdAt', 'desc'), limit(300))),
                // 14: site settings
                getDoc(doc(db, 'settings', 'site')),
                // 15: today's transactions for stats
                getDocs(query(collection(db, 'transactions'), where('timestamp', '>=', new Date(new Date().setHours(0, 0, 0, 0))), limit(200))),
            ]);

            // Apply results — each one checked independently
            if (results[0].status === 'fulfilled')
                setPendingTransactions(results[0].value.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
            if (results[1].status === 'fulfilled')
                setAllTransactions(results[1].value.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
            if (results[2].status === 'fulfilled')
                setAllTournaments(
                    results[2].value.docs
                        .map(d => ({ id: d.id, ...d.data() } as Tournament))
                        .filter(t => (t as any).matchType !== 'scrims' && (t as any).isScrim !== true && (t as any).type !== 'scrim' && (t as any).type !== 'scrims')
                );
            if (results[3].status === 'fulfilled')
                setSlides(results[3].value.docs.map(d => ({ id: d.id, ...d.data() } as Slide)));
            if (results[4].status === 'fulfilled')
                setPromoCodes(results[4].value.docs.map(d => ({ id: d.id, ...d.data() } as PromoCode)));
            if (results[5].status === 'fulfilled')
                setGames(results[5].value.docs.map(d => ({ id: d.id, ...d.data() } as Game)));
            if (results[6].status === 'fulfilled') {
                const loadedCats = results[6].value.docs.map(d => ({ id: d.id, ...d.data() } as PaymentCategory));
                loadedCats.sort((a, b) => (toDateSafe(b.createdAt)?.getTime() || 0) - (toDateSafe(a.createdAt)?.getTime() || 0));
                setPaymentCategories(loadedCats);
            }
            if (results[7].status === 'fulfilled') {
                const loadedMethods = results[7].value.docs.map(d => ({ id: d.id, ...d.data() } as PaymentMethod));
                loadedMethods.sort((a, b) => (toDateSafe(b.createdAt)?.getTime() || 0) - (toDateSafe(a.createdAt)?.getTime() || 0));
                setPaymentMethods(loadedMethods);
            }
            if (results[8].status === 'fulfilled') {
                let orgApps = results[8].value.docs.map(d => ({ id: d.id, ...d.data() } as OrgApplication));
                orgApps.sort((a, b) => {
                    const aTime = toDateSafe(a.timestamp)?.getTime() || 0;
                    const bTime = toDateSafe(b.timestamp)?.getTime() || 0;
                    return bTime - aTime;
                });
                setOrgApplications(orgApps);
            }
            if (results[9].status === 'fulfilled')
                setOrganizers(results[9].value.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
            if (results[10].status === 'fulfilled') {
                const usersSnap = results[10].value;
                const usersData = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
                usersData.sort((a, b) => {
                    const aTime = toDateSafe(a.createdAt || (a as any).joinedAt || (a as any).timestamp)?.getTime() || 0;
                    const bTime = toDateSafe(b.createdAt || (b as any).joinedAt || (b as any).timestamp)?.getTime() || 0;
                    return bTime - aTime;
                });
                setUsers(usersData);
            }
            if (results[11].status === 'fulfilled')
                setActivityLogs(results[11].value.docs.map(d => ({ id: d.id, ...d.data() })));
            if (results[12].status === 'fulfilled')
                setTournamentEarnings(results[12].value.docs.map(d => ({ id: d.id, ...d.data() } as TournamentEarning)));
            if (results[13].status === 'fulfilled' && results[13].value.exists()) {
                const data = results[13].value.data() as SiteSettings;
                setSiteSettings(data);
                setMinWithdrawal(data.minWithdrawal?.toString() || '');
                setSupportEmail(data.supportEmail || '');
                setSupportPhone(data.supportPhone || '');
                setNotice(data.notice || '');
                setIsNoticeActive(data.isNoticeActive || false);
                setMaintenanceMode(data.maintenanceMode || false);
                setOrgFormDescription(data.orgFormDescription || '');
                setDiscordWebhookTournaments(data.discordWebhookTournaments || '');
                setAutoDiscordTournamentAnnouncements(data.autoDiscordTournamentAnnouncements ?? true);
                if (data.discordWebhooks) {
                    setDiscordWebhooks({
                        tournaments: {
                            announcement: data.discordWebhooks.tournaments?.announcement || data.discordWebhookTournaments || '',
                            registration: data.discordWebhooks.tournaments?.registration || '',
                            group: data.discordWebhooks.tournaments?.group || '',
                            matchSchedule: data.discordWebhooks.tournaments?.matchSchedule || '',
                            result: data.discordWebhooks.tournaments?.result || '',
                            champion: data.discordWebhooks.tournaments?.champion || '',
                        },
                        scrims: {
                            announcement: data.discordWebhooks.scrims?.announcement || data.discordWebhookScrims || '',
                            registration: data.discordWebhooks.scrims?.registration || '',
                            group: data.discordWebhooks.scrims?.group || '',
                            matchSchedule: data.discordWebhooks.scrims?.matchSchedule || '',
                            result: data.discordWebhooks.scrims?.result || '',
                            champion: data.discordWebhooks.scrims?.champion || '',
                        },
                        autoAnnounce: {
                            tournaments: data.discordWebhooks.autoAnnounce?.tournaments ?? data.autoDiscordTournamentAnnouncements ?? true,
                            scrims: data.discordWebhooks.autoAnnounce?.scrims ?? true,
                        },
                    });
                } else if (data.discordWebhookTournaments) {
                    setDiscordWebhooks(prev => ({
                        ...prev,
                        tournaments: {
                            ...prev.tournaments,
                            announcement: data.discordWebhookTournaments || '',
                        }
                    }));
                }
            }

            // Calculate stats
            let totalBal = 0;
            if (results[10].status === 'fulfilled') {
                results[10].value.forEach(d => totalBal += (d.data().balance || 0));
            }
            let dep = 0, withdr = 0;
            if (results[14].status === 'fulfilled') {
                results[14].value.forEach(d => {
                    const data = d.data();
                    if (data.status === 'success') {
                        if (data.type === 'deposit') dep += data.amount;
                        if (data.type === 'withdrawal') withdr += Math.abs(data.amount);
                    }
                });
            }
            setStats({ totalBalance: totalBal, todayDep: dep, todayWith: withdr });

            // Load filters from local storage
            const savedTxStatus = localStorage.getItem('txFilterStatus');
            const savedTxType = localStorage.getItem('txFilterType');
            const savedTxFrom = localStorage.getItem('txDateFrom');
            const savedTxTo = localStorage.getItem('txDateTo');
            if (savedTxStatus) setTxFilterStatus(savedTxStatus as any);
            if (savedTxType) setTxFilterType(savedTxType as any);
            if (savedTxFrom) setTxDateFrom(savedTxFrom);
            if (savedTxTo) setTxDateTo(savedTxTo);

            // Log any failures for debugging
            const failures = results
                .map((r, i) => ({ index: i, result: r }))
                .filter(item => item.result.status === 'rejected');

            if (failures.length > 0) {
                console.warn("[AdminPanel] Some queries failed:", failures);
            }

            // Fetch all disputes
            try {
                const dSnap = await getDocs(query(collection(db, 'disputes'), limit(200)));
                const dList = dSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                dList.sort((a: any, b: any) => {
                    const aTime = toDateSafe(a.createdAt || a.filedAt)?.getTime() || 0;
                    const bTime = toDateSafe(b.createdAt || b.filedAt)?.getTime() || 0;
                    return bTime - aTime;
                });
                setAllDisputes(dList);
            } catch (err) {
                console.error("Error fetching admin disputes:", err);
            }

            if (failures.length > 0) {
                console.warn(`Admin data: ${failures.length} of ${results.length} queries failed`, failures.map(f => ({
                    queryIndex: f.index,
                    reason: (f.result as PromiseRejectedResult).reason
                })));

                // Check if failures are permission errors; if so, trigger background claim sync
                const isPermissionError = failures.some(f => {
                    const errStr = String((f.result as PromiseRejectedResult).reason || '');
                    return errStr.includes('permission-denied') || errStr.includes('Permission');
                });

                if (isPermissionError) {
                    auth.currentUser?.getIdToken(true).catch(() => {});
                }

                if (failures.length === results.length) {
                    showToast('Failed to load admin data. Please refresh or check admin permissions.', 'error');
                } else {
                    showToast(`Some admin data failed to load (${failures.length} errors)`, 'warning');
                }
            }
        };

        fetchData();
    }, [profile?.uid, profile?.role]);

    useEffect(() => {
        setSelectedTx(null);
    }, [activeTab]);

    // Server-side money operations (BUG-031) — deposit approval, refunds,
    // rejection, balance adjustments, and earnings release all run on the
    // server with atomic transactions + server-authored audit records.
    const adminPost = async (path: string, body: object) => {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error('Authentication required');
        const response = await fetch(path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(body) });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'Request failed');
        return result;
    };

    const handleApproveTx = async (tx: Transaction) => {
        try {
            await adminPost('/api/admin/transactions/approve', { transactionId: tx.id });

            // Send Notification
            await NotificationService.create(
                tx.userId,
                'Transaction Approved',
                `Your ${tx.type} of ${formatCurrency(tx.amount)} has been approved.`,
                'success',
                '/profile'
            );

            showToast('Transaction Approved', 'success');
            setPendingTransactions(prev => prev.filter(t => t.id !== tx.id));
            setAllTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, status: 'success', confirmedByUsername: profile?.username } : t));
            
            if (selectedTx && selectedTx.id === tx.id) {
                setSelectedTx({ ...selectedTx, status: 'success', confirmedByUsername: profile?.username });
            }
        } catch (error: any) {
            // Error approving transaction
            showToast(error.message || 'Failed to approve transaction', 'error');
        }
    };

    const handleRefundTx = async (tx: Transaction) => {
        if (tx.status === 'refunded') return;
        
        setConfirmModal({
            isOpen: true,
            title: 'Confirm Refund',
            message: `Are you sure you want to refund ${formatCurrency(Math.abs(tx.amount))} to ${tx.username}? This will add the amount back to their wallet balance.`,
            onConfirm: async () => {
                try {
                    await adminPost('/api/admin/transactions/refund', { transactionId: tx.id });

                    // Send Notification
                    await NotificationService.create(
                        tx.userId,
                        'Transaction Refunded',
                        `Your transaction of ${formatCurrency(Math.abs(tx.amount))} has been manually refunded by an admin.`,
                        'info',
                        '/profile'
                    );

                    showToast('Transaction Refunded', 'success');
                    setAllTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, status: 'refunded' } : t));
                    setSelectedTx(null);
                } catch (error: any) {
                    // Error refunding transaction
                    showToast(error.message || 'Failed to refund transaction', 'error');
                }
            }
        });
    };

    const executeRejectTx = async (tx: Transaction, reason: string) => {
        try {
            await adminPost('/api/admin/transactions/reject', { transactionId: tx.id, reason: reason || 'Rejected by admin' });

            // Send Notification
            await NotificationService.create(
                tx.userId,
                'Transaction Rejected',
                `Your ${tx.type} of ${formatCurrency(Math.abs(tx.amount))} was rejected. Reason: ${reason || 'Rejected by admin'}`,
                'alert',
                '/profile'
            );

            showToast('Transaction Rejected', 'success');
            setPendingTransactions(prev => prev.filter(t => t.id !== tx.id));
            setAllTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, status: 'rejected', rejectionReason: reason || 'Rejected by admin' } : t));
            if (selectedTx && selectedTx.id === tx.id) {
                setSelectedTx({ ...selectedTx, status: 'rejected', rejectionReason: reason || 'Rejected by admin' });
            }
            setSelectedTx(null);
            setRejectionReason('');
        } catch (error: any) {
            // Error rejecting transaction
            showToast(error.message || 'Failed to reject transaction', 'error');
        }
    };

    const handleRejectTx = (tx: Transaction, reason?: string) => {
        const finalReason = reason || rejectionReason;
        if (!finalReason) {
            setConfirmModal({
                isOpen: true,
                title: `Reject ${tx.type === 'deposit' ? 'Deposit' : 'Withdrawal'}?`,
                message: `Are you sure you want to reject this ${tx.type} of ${formatCurrency(Math.abs(tx.amount))} for ${tx.username || 'this user'}?${tx.type === 'withdrawal' ? ' The withdrawn funds will be refunded to their wallet.' : ''}`,
                isDestructive: true,
                onConfirm: () => executeRejectTx(tx, 'Rejected by admin')
            });
            return;
        }
        executeRejectTx(tx, finalReason);
    };

    const handleAdjustBalance = async () => {
        if (!selectedUser || !adjustmentAmount) return;
        const amount = parseFloat(adjustmentAmount);
        if (isNaN(amount) || amount <= 0) return showToast('Invalid amount', 'error');

        try {
            const finalAmount = adjustmentType === 'add' ? amount : -amount;
            // Server-side balance adjustment (BUG-031) — atomic transaction +
            // ledger entry + audit record on the server.
            await adminPost('/api/admin/balance/adjust', {
                userId: selectedUser.uid,
                amount,
                type: adjustmentType,
                desc: `Admin Adjustment: ${adjustmentType === 'add' ? 'Added' : 'Subtracted'} ${amount}` });

            showToast('Balance Adjusted', 'success');
            setUsers(prev => prev.map(u => u.uid === selectedUser.uid ? { ...u, balance: u.balance + finalAmount } : u));
            setSelectedUser(null);
            setAdjustmentAmount('');
        } catch (error) {
            // Error adjusting balance
            showToast(error.message || 'Failed to adjust balance', 'error');
        }
    };

    const handleApproveOrg = async (app: OrgApplication) => {
        try {
            const batch = writeBatch(db);
            const appRef = doc(db, 'orgApplications', app.id);
            const userRef = doc(db, 'users', app.userId);
            const publicUserRef = doc(db, 'users_public', app.userId);

            batch.update(userRef, { 
                role: 'organizer',
                orgStatus: 'approved',
                orgName: app.orgName,
                isOrganizer: true
            });
            batch.update(appRef, { status: 'approved' });
            batch.set(publicUserRef, {
                role: 'organizer',
                orgName: app.orgName,
                updatedAt: serverTimestamp() }, { merge: true });
            
            await batch.commit();

            // Sync custom claims to Firebase Auth
            try {
                const token = await auth.currentUser?.getIdToken();
                if (token) {
                    await fetch('/api/admin/set-claims', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ uid: app.userId, role: 'organizer' }) });
                }
            } catch (claimsErr) {
                console.error('Failed to sync custom claims for org approval:', claimsErr);
            }

            await NotificationService.create(
                app.userId,
                'Organizer Application Approved',
                `Congratulations! Your application for ${app.orgName} has been approved. You can now host tournaments.`,
                'success',
                '/organizer-panel'
            );

            showToast('Application Approved', 'success');
            setOrgApplications(prev => prev.filter(a => a.id !== app.id));
        } catch (error) {
            console.error("Error approving org:", error);
            showToast('Failed to approve application', 'error');
        }
    };

    const handleCancelTournament = async (tournament: Tournament) => {
        setConfirmModal({
            isOpen: true,
            title: 'Cancel Tournament',
            message: `Are you sure you want to cancel "${tournament.title}"? All registered players will be automatically refunded. This action cannot be undone.`,
            isDestructive: true,
            onConfirm: async () => {
                try {
                    const token = await auth.currentUser?.getIdToken();
                    if (!token) throw new Error('Authentication required');
                    let cursor: string | null = null;
                    do {
                        const response = await fetch('/api/wallet/cancel-tournament', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                            body: JSON.stringify({ tournamentId: tournament.id, ...(cursor ? { lastParticipantId: cursor } : {}) }) });
                        const result = await response.json();
                        if (!response.ok || !result.success) throw new Error(result.message || 'Failed to cancel tournament');
                        cursor = result.hasMore ? result.nextParticipantId : null;
                    } while (cursor);
                    showToast('Tournament cancelled and refunds processed', 'success');
                    
                    // Refresh tournaments if needed
                    if (selectedOrgId) {
                        fetchOrgTournaments(selectedOrgId);
                    }
                } catch (error) {
                    console.error("Error cancelling tournament:", error);
                    showToast('Failed to cancel tournament', 'error');
                } finally {
                    closeConfirmModal();
                }
            }
        });
    };

    const handleRejectOrg = async (app: OrgApplication) => {
        try {
            const batch = writeBatch(db);
            const appRef = doc(db, 'orgApplications', app.id);
            const userRef = doc(db, 'users', app.userId);

            batch.update(userRef, { orgStatus: 'rejected' });
            batch.update(appRef, { status: 'rejected' });
            
            await batch.commit();

            // Sync custom claims to Firebase Auth
            try {
                const token = await auth.currentUser?.getIdToken();
                if (token) {
                    await fetch('/api/admin/set-claims', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ uid: app.userId, role: 'player' }),
                    });
                }
            } catch (claimsErr) {
                console.error('Failed to sync custom claims for org approval:', claimsErr);
            }

            await NotificationService.create(
                app.userId,
                'Organizer Application Rejected',
                `We regret to inform you that your application for ${app.orgName} was rejected.`,
                'alert',
                '/contact'
            );

            showToast('Application Rejected', 'success');
            setOrgApplications(prev => prev.filter(a => a.id !== app.id));
        } catch (error) {
            console.error("Error rejecting org:", error);
            showToast('Failed to reject application', 'error');
        }
    };

    const fetchOrgTournaments = async (orgId: string) => {
        if (!orgId) return;
        setSelectedOrgId(orgId);
        try {
            const q = query(collection(db, 'tournaments'), where('hostUid', '==', orgId));
            const snap = await getDocs(q);
            let tours = snap.docs
                .map(d => ({ id: d.id, ...(d.data() as any) } as Tournament))
                .filter(t => (t as any).matchType !== 'scrims' && (t as any).isScrim !== true && (t as any).type !== 'scrim' && (t as any).type !== 'scrims');
            tours.sort((a,b) => {
                const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                return bTime - aTime;
            });
            setOrgTournaments(tours);
        } catch (error) {
            console.error("Error fetching org tournaments:", error);
            showToast('Failed to fetch tournaments', 'error');
        }
    };

    const handleSaveCategory = async () => {
        if (!categoryName.trim()) return showToast('Please provide a category name', 'warning');
        
        try {
            const catData: any = {
                name: categoryName.trim(),
                description: categoryDescription.trim(),
                isActive: categoryActive,
            };

            if (editingCategory) {
                if (editingCategory.createdAt) {
                    catData.createdAt = editingCategory.createdAt;
                }
                catData.updatedAt = serverTimestamp();
                await updateDoc(doc(db, 'paymentCategories', editingCategory.id), catData);
                setPaymentCategories(prev => prev.map(c => c.id === editingCategory.id ? { ...c, ...catData } : c));
                showToast('Payment Category Updated', 'success');
            } else {
                catData.createdAt = serverTimestamp();
                const newRef = doc(collection(db, 'paymentCategories'));
                await setDoc(newRef, catData);
                setPaymentCategories(prev => [{ id: newRef.id, ...catData, createdAt: new Date().toISOString() }, ...prev]);
                showToast('Payment Category Added', 'success');
            }
            
            setIsCategoryModalOpen(false);
            setEditingCategory(null);
            setCategoryName('');
            setCategoryDescription('');
            setCategoryActive(true);
        } catch (error) {
            console.error("Error saving payment category:", error);
            showToast('Failed to save payment category', 'error');
        }
    };

    const handleDeleteCategory = async (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Category',
            message: 'Are you sure you want to delete this category?',
            isDestructive: true,
            onConfirm: async () => {
                try {
                    await deleteDoc(doc(db, 'paymentCategories', id));
                    setPaymentCategories(prev => prev.filter(c => c.id !== id));
                    showToast('Category Deleted', 'success');
                    logAdminAction('Deleted Payment Category', `Category ID: ${id}`);
                } catch (error) {
                    console.error("Error deleting category:", error);
                    showToast('Failed to delete category', 'error');
                } finally {
                    closeConfirmModal();
                }
            }
        });
    };

    const handleSavePayment = async () => {
        if (!paymentCategoryId) return showToast('Please select or create a payment category first', 'warning');
        if (!paymentName.trim()) return showToast('Please enter a payment method name', 'warning');
        if (!paymentQr.trim()) return showToast('Please upload a QR code image or enter a QR URL', 'warning');
        if (!paymentInstructions.trim()) return showToast('Please provide payment instructions (account name, number, etc.)', 'warning');
        
        try {
            const payData: any = {
                name: paymentName.trim(),
                categoryId: paymentCategoryId,
                qrUrl: paymentQr.trim(),
                instructions: paymentInstructions.trim(),
                type: paymentType || 'Wallet',
                isActive: paymentActive,
            };

            if (editingPayment) {
                if (editingPayment.createdAt) {
                    payData.createdAt = editingPayment.createdAt;
                }
                payData.updatedAt = serverTimestamp();
                await updateDoc(doc(db, 'paymentMethods', editingPayment.id), payData);
                setPaymentMethods(prev => prev.map(p => p.id === editingPayment.id ? { ...p, ...payData } : p));
                showToast('Payment Method Updated', 'success');
            } else {
                payData.createdAt = serverTimestamp();
                const newRef = doc(collection(db, 'paymentMethods'));
                await setDoc(newRef, payData);
                setPaymentMethods(prev => [{ id: newRef.id, ...payData, createdAt: new Date().toISOString() }, ...prev]);
                showToast('Payment Method Added', 'success');
            }
            
            setIsPaymentModalOpen(false);
            setEditingPayment(null);
            setPaymentName('');
            setPaymentCategoryId('');
            setPaymentQr('');
            setPaymentInstructions('');
            setPaymentType('eSewa');
            setPaymentActive(true);
        } catch (error) {
            console.error("Error saving payment method:", error);
            showToast('Failed to save payment method', 'error');
        }
    };

    const handleSeedDefaultPayments = async () => {
        try {
            const defaultCats = [
                { id: 'cat_wallets', name: 'Digital Wallets', description: 'eSewa, Khalti, IME Pay instant transfers', isActive: true },
                { id: 'cat_banking', name: 'Mobile Banking & QR', description: 'FonePay QR & ConnectIPS', isActive: true },
                { id: 'cat_bank', name: 'Direct Bank Transfer', description: 'National & Commercial Banks', isActive: true }
            ];
            const defaultMethods = [
                {
                    id: 'method_esewa',
                    categoryId: 'cat_wallets',
                    name: 'eSewa',
                    type: 'Wallet',
                    qrUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=eSewa-Deposit-NexPlay',
                    instructions: 'Send payment to eSewa ID: 9800000000 (NexPlay Official). Copy the transaction ID and upload payment screenshot.',
                    isActive: true
                },
                {
                    id: 'method_khalti',
                    categoryId: 'cat_wallets',
                    name: 'Khalti',
                    type: 'Wallet',
                    qrUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=Khalti-Deposit-NexPlay',
                    instructions: 'Send payment to Khalti ID: 9800000000 (NexPlay Official). Enter transaction code and attach receipt screenshot.',
                    isActive: true
                },
                {
                    id: 'method_fonepay',
                    categoryId: 'cat_banking',
                    name: 'FonePay QR',
                    type: 'QR',
                    qrUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=FonePay-NexPlay-Official',
                    instructions: 'Scan FonePay QR using any Banking App. Enter Transaction Ref and attach confirmation screenshot.',
                    isActive: true
                },
                {
                    id: 'method_bank',
                    categoryId: 'cat_bank',
                    name: 'Bank Transfer',
                    type: 'Bank',
                    qrUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=Bank-NexPlay-Official',
                    instructions: 'Transfer to Global IME / Nabil Bank. A/C: 0123456789 (NexPlay Org). Attach transfer slip screenshot.',
                    isActive: true
                }
            ];

            for (const cat of defaultCats) {
                await setDoc(doc(db, 'paymentCategories', cat.id), { ...cat, createdAt: serverTimestamp() });
            }
            for (const pm of defaultMethods) {
                await setDoc(doc(db, 'paymentMethods', pm.id), { ...pm, createdAt: serverTimestamp() });
            }
            setPaymentCategories(defaultCats.map(c => ({ ...c, createdAt: new Date().toISOString() })));
            setPaymentMethods(defaultMethods.map(m => ({ ...m, createdAt: new Date().toISOString() })));
            showToast('Default payment categories and methods initialized successfully!', 'success');
        } catch (err) {
            console.error('Error initializing default payment options:', err);
            showToast('Failed to initialize default payment options', 'error');
        }
    };

    const executeDeletePayment = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'paymentMethods', id));
            setPaymentMethods(prev => prev.filter(p => p.id !== id));
            showToast('Payment method deleted', 'success');
        } catch (error) {
            console.error("Error deleting payment method:", error);
            showToast('Failed to delete payment method', 'error');
        }
    };

    const handleDeletePayment = (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Payment Method',
            message: 'Are you sure you want to delete this payment method?',
            isDestructive: true,
            onConfirm: () => executeDeletePayment(id)
        });
    };

    const handleSaveGame = async () => {
        if (!gameName || !gameLogo || !gameModes) return showToast('Please fill all fields', 'warning');
        const modesArray = gameModes.split(',').map(m => m.trim()).filter(m => m !== '');
        
        try {
            const gameData = {
                name: gameName,
                logoUrl: gameLogo,
                modes: modesArray,
                isPublished: isPublished,
                createdAt: editingGame ? editingGame.createdAt : serverTimestamp()
            };

            if (editingGame) {
                await updateDoc(doc(db, 'games', editingGame.id), gameData);
                setGames(prev => prev.map(g => g.id === editingGame.id ? { ...g, ...gameData } : g));
                showToast('Game Updated', 'success');
            } else {
                const newGameRef = doc(collection(db, 'games'));
                await setDoc(newGameRef, gameData);
                setGames(prev => [{ id: newGameRef.id, ...gameData }, ...prev]);
                showToast('Game Added', 'success');
            }
            
            setIsGameModalOpen(false);
            setEditingGame(null);
            setGameName('');
            setGameLogo('');
            setGameModes('');
        } catch (error) {
            console.error("Error saving game:", error);
            showToast('Failed to save game', 'error');
        }
    };

    const handleSaveScoring = async (config: GameScoringConfig) => {
        if (!scoringModalGame) return;
        const gameRef = doc(db, 'games', scoringModalGame.id);
        const updateData = {
            scoring: {
                enabled: config.enabled,
                killPoints: config.killPoints,
                placementPoints: config.placementPoints,
                maxPlacement: config.maxPlacement,
                scoringVersion: config.scoringVersion,
                updatedAt: serverTimestamp(),
                updatedBy: auth.currentUser?.uid || '' }
        };
        await updateDoc(gameRef, updateData);
        // Update local state
        setGames(prev => prev.map(g =>
            g.id === scoringModalGame.id
                ? { ...g, scoring: { ...config, ...updateData.scoring } } as Game
                : g
        ));
        showToast('Scoring configuration saved for ' + scoringModalGame.name, 'success');
    };

    const handleSavePromo = async () => {
        if (!promoCode || !promoAmount || !promoMaxUses) return showToast('Please fill all fields', 'warning');
        try {
            const promoData = {
                code: promoCode.toUpperCase(),
                amount: parseFloat(promoAmount),
                maxUses: parseInt(promoMaxUses),
                currentUses: editingPromo ? editingPromo.currentUses : 0,
                isActive: promoActive,
                createdAt: editingPromo ? editingPromo.createdAt : serverTimestamp()
            };

            if (editingPromo) {
                await updateDoc(doc(db, 'promocodes', editingPromo.id), promoData);
                setPromoCodes(prev => prev.map(p => p.id === editingPromo.id ? { ...p, ...promoData } : p));
                showToast('Promo Code Updated', 'success');
            } else {
                const newRef = doc(collection(db, 'promocodes'));
                await setDoc(newRef, promoData);
                setPromoCodes(prev => [{ id: newRef.id, ...promoData }, ...prev]);
                showToast('Promo Code Added', 'success');
            }
            setIsPromoModalOpen(false);
            setEditingPromo(null);
            setPromoCode('');
            setPromoAmount('');
            setPromoMaxUses('');
        } catch (error) {
            console.error("Error saving promo:", error);
            showToast('Failed to save promo code', 'error');
        }
    };

    const executeDeletePromo = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'promocodes', id));
            setPromoCodes(prev => prev.filter(p => p.id !== id));
            showToast('Promo code deleted', 'success');
        } catch (error) {
            console.error("Error deleting promo:", error);
            showToast('Failed to delete promo code', 'error');
        }
    };

    const handleDeletePromo = (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Promo Code',
            message: 'Are you sure you want to delete this promo code?',
            isDestructive: true,
            onConfirm: () => executeDeletePromo(id)
        });
    };

    const handleSaveSlide = async () => {
        if (!slideTitle || !slideImage || !slideLink) return showToast('Please fill all fields', 'warning');
        try {
            const slideData = {
                title: slideTitle,
                description: slideDescription,
                imageUrl: slideImage,
                link: slideLink,
                buttonText: slideBtnText,
                isActive: slideIsActive,
                createdAt: editingSlide ? editingSlide.createdAt : serverTimestamp()
            };

            if (editingSlide) {
                await updateDoc(doc(db, 'slides', editingSlide.id), slideData);
                setSlides(prev => prev.map(s => s.id === editingSlide.id ? { ...s, ...slideData } : s));
                showToast('Slide Updated', 'success');
            } else {
                const newRef = doc(collection(db, 'slides'));
                await setDoc(newRef, slideData);
                setSlides(prev => [{ id: newRef.id, ...slideData }, ...prev]);
                showToast('Slide Added', 'success');
            }
            setIsSlideModalOpen(false);
            setEditingSlide(null);
            setSlideTitle('');
            setSlideDescription('');
            setSlideImage('');
            setSlideLink('');
            setSlideIsActive(true);
        } catch (error) {
            console.error("Error saving slide:", error);
            showToast('Failed to save slide', 'error');
        }
    };

    const executeDeleteSlide = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'slides', id));
            setSlides(prev => prev.filter(s => s.id !== id));
            showToast('Slide deleted', 'success');
        } catch (error) {
            console.error("Error deleting slide:", error);
            showToast('Failed to delete slide', 'error');
        }
    };

    const handleDeleteSlide = (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Slide',
            message: 'Are you sure you want to delete this slide?',
            isDestructive: true,
            onConfirm: () => executeDeleteSlide(id)
        });
    };

    // Tournament Management State
    const [isTournamentModalOpen, setIsTournamentModalOpen] = useState(false);
    const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
    const handleEditTournament = (tournament: Tournament) => {
        setSelectedTournament(tournament);
        setIsTournamentModalOpen(true);
    };

    const handleToggleFeatured = async (t: Tournament) => {
        try {
            const newStatus = !t.isFeatured;
            await updateDoc(doc(db, 'tournaments', t.id), { isFeatured: newStatus });
            setOrgTournaments(prev => prev.map(item => item.id === t.id ? { ...item, isFeatured: newStatus } : item));
            setAllTournaments(prev => prev.map(item => item.id === t.id ? { ...item, isFeatured: newStatus } : item));
            showToast(`Tournament ${newStatus ? 'featured' : 'unfeatured'}`, 'success');
        } catch (error) {
            console.error("Error toggling featured:", error);
            showToast('Failed to update featured status', 'error');
        }
    };

    const handleViewParticipants = (tournament: Tournament) => {
        // Redirect to tournament page or show a modal
        window.open(`/tournaments/${tournament.id}`, '_blank');
    };

    const handleSaveSettings = async () => {
        try {
            const settingsData = {
                minWithdrawal: parseFloat(minWithdrawal),
                supportEmail,
                supportPhone,
                notice,
                isNoticeActive,
                maintenanceMode,
                isOrgFormOpen: siteSettings?.isOrgFormOpen ?? true,
                orgFormDescription,
                discordWebhooks,
                discordWebhookTournaments: (discordWebhooks.tournaments?.announcement || discordWebhookTournaments || '').trim(),
                discordWebhookScrims: (discordWebhooks.scrims?.announcement || '').trim(),
                autoDiscordTournamentAnnouncements: discordWebhooks.autoAnnounce?.tournaments ?? autoDiscordTournamentAnnouncements,
                updatedAt: serverTimestamp()
            };
            await setDoc(doc(db, 'settings', 'site'), settingsData);
            setSiteSettings(settingsData as any);
            showToast('Settings Saved', 'success');
        } catch (error) {
            console.error("Error saving settings:", error);
            showToast('Failed to save settings', 'error');
        }
    };

    const toggleOrgForm = async () => {
        try {
            const currentVal = siteSettings?.isOrgFormOpen ?? true;
            const newValue = !currentVal;
            await setDoc(doc(db, 'settings', 'site'), { isOrgFormOpen: newValue }, { merge: true });
            setSiteSettings(prev => ({ ...(prev || {}), isOrgFormOpen: newValue } as any));
            showToast(`Organizer applications ${newValue ? 'opened' : 'closed'}`, 'success');
        } catch (error) {
            console.error("Error toggling org form:", error);
            showToast('Failed to toggle form', 'error');
        }
    };

    const handleUpdateUserRole = async (uid: string, newRole: 'player' | 'organizer' | 'admin') => {
        try {
            // Update Firestore doc
            await updateDoc(doc(db, 'users', uid), { role: newRole });
            await setDoc(doc(db, 'users_public', uid), { role: newRole, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
            // Sync custom claims to Firebase Auth (server-side admin call)
            try {
                const token = await auth.currentUser?.getIdToken();
                if (token) {
                    await fetch('/api/admin/set-claims', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ uid, role: newRole }) });
                }
            } catch (claimsErr) {
                console.error('Failed to sync custom claims:', claimsErr);
                // ponytail: Firestore doc is source of truth during migration — claims sync is best-effort
            }
            setUsers(prev => prev.map(u => u.uid === uid ? { ...u, role: newRole } : u));
            setOrganizers(prev => {
                const updated = prev.map(u => u.uid === uid ? { ...u, role: newRole } : u);
                if (newRole === 'player') return updated.filter(u => u.uid !== uid);
                return updated;
            });
            showToast(`User role updated to ${newRole}`, 'success');
        } catch (error) {
            console.error("Error updating user role:", error);
            showToast('Failed to update role', 'error');
        }
    };

    const handleSaveOrgDetails = async () => {
        if (!editingOrg) return;
        try {
            const updateData = {
                email: orgEmail,
                discord: orgDiscord,
                youtube: orgYoutube,
                whatsapp: orgWhatsapp,
                orgName: orgNameEdit
            };
            await updateDoc(doc(db, 'users', editingOrg.uid), updateData);
            setOrganizers(prev => prev.map(o => o.uid === editingOrg.uid ? { ...o, ...updateData } : o));
            showToast('Organizer details updated', 'success');
            setIsOrgEditModalOpen(false);
        } catch (error) {
            console.error("Error saving org details:", error);
            showToast('Failed to save details', 'error');
        }
    };

    const handleSuspendOrg = async (uid: string, isSuspended: boolean) => {
        try {
            await updateDoc(doc(db, 'users', uid), { isBanned: isSuspended });
            setOrganizers(prev => prev.map(o => o.uid === uid ? { ...o, isBanned: isSuspended } : o));
            showToast(`Organizer ${isSuspended ? 'suspended' : 'activated'}`, 'success');
        } catch (error) {
            console.error("Error suspending org:", error);
            showToast('Failed to update status', 'error');
        }
    };

    const togglePowerOrganizer = async (org: UserProfile) => {
        try {
            const newStatus = !org.isPowerOrganizer;
            await updateDoc(doc(db, 'users', org.uid), { isPowerOrganizer: newStatus });
            setOrganizers(prev => prev.map(o => o.uid === org.uid ? { ...o, isPowerOrganizer: newStatus } : o));
            showToast(`Organizer power ${newStatus ? 'granted' : 'revoked'}`, 'success');
        } catch (error) {
            console.error("Error toggling power organizer:", error);
            showToast('Failed to update organizer power', 'error');
        }
    };

    const executeDeleteGame = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'games', id));
            setGames(prev => prev.filter(g => g.id !== id));
            showToast('Game Deleted', 'success');
        } catch (error) {
            console.error("Error deleting game:", error);
            showToast('Failed to delete game', 'error');
        }
    };

    const handleDeleteGame = (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Game',
            message: 'Are you sure you want to delete this game?',
            isDestructive: true,
            onConfirm: () => executeDeleteGame(id)
        });
    };

    const openEditGame = (game: Game) => {
        setEditingGame(game);
        setGameName(game.name);
        setGameLogo(game.logoUrl);
        setGameModes(game.modes.join(', '));
        setIsPublished(game.isPublished);
        setIsGameModalOpen(true);
    };

    const handleReleaseEarnings = async (earning: TournamentEarning) => {
        setConfirmModal({
            isOpen: true,
            title: 'Release Earnings',
            message: `Are you sure you want to release ${formatCurrency(earning.orgShare)} to ${earning.orgName}'s wallet?`,
            isDestructive: false,
            onConfirm: async () => {
                try {
                    // Server-side earnings release (BUG-031) — atomic transaction
                    // that guards against double-release and writes the ledger + audit.
                    await adminPost('/api/admin/earnings/release', { earningId: earning.id });
                    
                    await NotificationService.create(
                        earning.orgId,
                        'Earnings Released',
                        `${formatCurrency(earning.orgShare)} has been added to your wallet for tournament: ${earning.tournamentName}`,
                        'success',
                        '/wallet'
                    );
                    
                    setTournamentEarnings(prev => prev.map(e => e.id === earning.id ? { ...e, status: 'released' } : e));
                    showToast('Earnings released successfully', 'success');
                } catch (error: any) {
                    console.error("Error releasing earnings:", error);
                    showToast(error.message || 'Failed to release earnings', 'error');
                } finally {
                    closeConfirmModal();
                }
            }
        });
    };

    if (profile?.role !== 'admin') return {} as any;

        const pendingDepositsCount = pendingTransactions.filter(t => t.type === 'deposit').length;
        const pendingWithdrawalsCount = pendingTransactions.filter(t => t.type === 'withdrawal').length;
        const pendingOrgCount = orgApplications.length;

        const handleResolveDispute = async (disputeId: string, action: 'warn' | 'ban' | 'dismiss') => {
            if (!disputeId) return;
            try {
                const user = auth.currentUser;
                let resolvedViaApi = false;
                if (user) {
                    try {
                        const token = await user.getIdToken();
                        const res = await fetch(`/api/disputes/${disputeId}/resolve`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ action })
                        });
                        const data = await res.json().catch(() => ({}));
                        if (res.ok && data.success) {
                            resolvedViaApi = true;
                        }
                    } catch (apiErr) {
                        console.warn("API resolve dispute failed, falling back to direct Firestore:", apiErr);
                    }
                }

                if (!resolvedViaApi) {
                    const status = action === 'dismiss' ? 'dismissed' : 'resolved';
                    await updateDoc(doc(db, 'disputes', disputeId), {
                        status,
                        resolutionAction: action,
                        resolvedAt: serverTimestamp(),
                        resolvedBy: profile?.uid || auth.currentUser?.uid || 'admin'
                    });
                }

                const newStatus = action === 'dismiss' ? 'dismissed' : 'resolved';
                setAllDisputes(prev => prev.map(d => d.id === disputeId ? {
                    ...d,
                    status: newStatus,
                    resolutionAction: action,
                    resolvedAt: new Date().toISOString()
                } : d));
                showToast(`Dispute ${action === 'dismiss' ? 'dismissed' : `resolved with action: ${action}`}`, 'success');
            } catch (err: any) {
                console.error("Error resolving dispute:", err);
                showToast(err.message || 'Failed to resolve dispute', 'error');
            }
        };

        const fetchDisputes = async () => {
            try {
                const dSnap = await getDocs(query(collection(db, 'disputes'), limit(200)));
                const dList = dSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                dList.sort((a: any, b: any) => {
                    const aTime = toDateSafe(a.createdAt || a.filedAt)?.getTime() || 0;
                    const bTime = toDateSafe(b.createdAt || b.filedAt)?.getTime() || 0;
                    return bTime - aTime;
                });
                setAllDisputes(dList);
            } catch (err) {
                console.error("Error refreshing admin disputes:", err);
            }
        };

        const tabProps = {
            allDisputes,
            fetchDisputes,
            handleResolveDispute,
            paymentQr,
            processAndUploadPayment,
            handleDragOverPayment,
            handleDropPayment,
            handlePastePayment,
            processAndUploadGame,
            handleDragOverGame,
            handleDropGame,
            handlePasteGame,
            processAndUploadSlide,
            handleDragOverSlide,
            handleDropSlide,
            handlePasteSlide,
            setPaymentType,
            setEditingOrg,
            setSelectedUser,
            setSelectedTx,
            setConfirmModal,
            DEFAULT_BANNER,
            ImageUploader,
            MediaCategory,
            NEXPLAY_LOGO,
            activeTab,
            activityLogs,
            allTournaments,
            allTransactions,
            categoryActive,
            categoryDescription,
            categoryName,
            closeConfirmModal,
            editingCategory,
            editingGame,
            editingPayment,
            editingPromo,
            editingSlide,
            executeRejectTx,
            handleRejectTx,
            handleRefundTx,
            fetchMedia,
            fetchOrgTournaments,
            formatCurrency,
            formatDate,
            formatGameName,
            gameLogo,
            gameModes,
            gameName,
            games,
            getRelativeTime,
            handleApproveOrg,
            handleApproveTx,
            handleCancelTournament,
            handleDeleteCategory,
            handleDeleteGame,
            handleDeleteMedia,
            handleDeletePayment,
            handleDeletePromo,
            handleDeleteSlide,
            handleEditTournament,
            handleRejectOrg,
            handleReleaseEarnings,
            handleSaveCategory,
            handleSaveGame,
            handleSaveScoring,
            handleSaveOrgDetails,
            handleSavePayment,
            handleSavePromo,
            handleSaveSettings,
            handleSaveSlide,
            handleSuspendOrg,
            handleToggleFeatured,
            handleUpdateUserRole,
            handleViewParticipants,
            isCategoryModalOpen,
            isGameModalOpen,
            isScoringModalOpen,
            scoringModalGame,
            setScoringModalGame,
            setIsNoticeActive,
            setIsOrgEditModalOpen,
            setIsPaymentModalOpen,
            setIsPromoModalOpen,
            setIsPublished,
            setIsSlideModalOpen,
            maintenanceMode,
            mediaFilter,
            mediaItems,
            mediaLoading,
            mediaSearch,
            minWithdrawal,
            directUploadUrl,
            notice,
            openEditGame,
            orgApplications,
            orgDiscord,
            orgEmail,
            orgFormDescription,
            orgNameEdit,
            orgTournaments,
            orgWhatsapp,
            orgYoutube,
            organizers,
            paymentActive,
            paymentType,
            paymentCategories,
            paymentCategoryId,
            paymentInstructions,
            paymentMethods,
            paymentName,
            handleSeedDefaultPayments,
            pendingTransactions,
            promoActive,
            promoAmount,
            promoCode,
            promoCodes,
            promoMaxUses,
            searchQuery,
            selectedMediaCategory,
            selectedOrgId,
            setCategoryActive,
            setCategoryDescription,
            setCategoryName,
            setEditingCategory,
            setEditingGame,
            setEditingPayment,
            setEditingPromo,
            setEditingSlide,
            setGameLogo,
            setGameModes,
            setGameName,
            setIsCategoryModalOpen,
            setIsGameModalOpen,
            setIsScoringModalOpen,
            setMaintenanceMode,
            setMediaFilter,
            setMediaSearch,
            setMinWithdrawal,
            setDirectUploadUrl,
            setNotice,
            setOrgDiscord,
            setOrgEmail,
            setOrgFormDescription,
            setOrgNameEdit,
            setOrgWhatsapp,
            setOrgYoutube,
            setPaymentActive,
            setPaymentCategoryId,
            setPaymentInstructions,
            setPaymentName,
            setPaymentQr,
            setPromoActive,
            setPromoAmount,
            setPromoCode,
            setPromoMaxUses,
            setSearchQuery,
            setSelectedMediaCategory,
            setSlideBtnText,
            setSlideDescription,
            setSlideImage,
            setSlideIsActive,
            setSlideLink,
            setSlideTitle,
            setSupportEmail,
            setSupportPhone,
            discordWebhooks,
            setDiscordWebhooks,
            discordWebhookTournaments,
            setDiscordWebhookTournaments,
            autoDiscordTournamentAnnouncements,
            setAutoDiscordTournamentAnnouncements,
            showToast,
            siteSettings,
            slideBtnText,
            slideDescription,
            slideImage,
            slideIsActive,
            slideLink,
            slideTitle,
            slides,
            stats,
            supportEmail,
            supportPhone,
            toggleOrgForm,
            togglePowerOrganizer,
            tournamentEarnings,
            uploading,
            users
        };
    return {
        activeTab,
        activityLogs,
        adjustmentAmount,
        adjustmentType,
        allTournaments,
        allTransactions,
        closeConfirmModal,
        confirmModal,
        editingOrg,
        fetchOrgTournaments,
        games,
        getRelativeTime,
        handleAdjustBalance,
        handleApproveTx,
        handleRefundTx,
        handleRejectTx,
        handleUpdateUserRole,
        isOrgEditModalOpen,
        isSidebarOpen,
        isTournamentModalOpen,
        orgNameEdit,
        organizers,
        pendingDepositsCount,
        pendingOrgCount,
        pendingWithdrawalsCount,
        rejectionReason,
        selectedOrgId,
        selectedTournament,
        selectedTx,
        selectedUser,
        setActiveTab,
        setAdjustmentAmount,
        setAdjustmentType,
        setIsSidebarOpen,
        setIsTournamentModalOpen,
        setRejectionReason,
        setSelectedTournament,
        setSelectedTx,
        setSelectedUser,
        setTxFilterStatus,
        setTxFilterTournament,
        setTxFilterType,
        setTxSearchUser,
        tabProps,
        txDateFrom,
        txDateTo,
        txFilterStatus,
        txFilterTournament,
        txFilterType,
        txSearchUser,
        users
    };
}
