import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { collection, query, where, getDocs, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from './AuthContext';
import { Tournament } from '../types/types';
import { NotificationService } from '../services/NotificationService';
import { X } from 'lucide-react';
import { toDateSafe } from '../utils/utils';

interface Toast {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
}

interface NotificationContextType {
    showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const NotificationContext = createContext<NotificationContextType>({
    showToast: () => {},
});

export const useNotification = () => useContext(NotificationContext);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const notifiedTournamentsRef = React.useRef<Set<string>>(new Set());
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 5000);
    }, []);

    useEffect(() => {
        if (!user) return;

        let isMounted = true;
        const notifiedSet = notifiedTournamentsRef.current;
        const unsubList: (() => void)[] = [];
        // Shared tournament IDs ref — populated by setupLiveListeners, reused by checkUpcoming
        // so we avoid fetching participants twice (BUG-045).
        const tourIdsRef: { current: string[] } = { current: [] };

        const setupLiveListeners = async () => {
            try {
                const partSnap = await getDocs(query(
                    collection(db, 'participants'),
                    where('userId', '==', user.uid)
                ));

                if (!isMounted) return;

                const tourIds = Array.from(
                    new Set(partSnap.docs.map(d => d.data().tournamentId).filter(Boolean))
                );
                // Store for reuse by checkUpcoming — avoids a duplicate participant query
                tourIdsRef.current = tourIds;

                if (tourIds.length === 0) return;

                tourIds.forEach((tId) => {
                    let isInitial = true;
                    const unsub = onSnapshot(
                        doc(db, 'tournaments', tId),
                        (docSnap) => {
                            if (docSnap.exists()) {
                                const t = { id: docSnap.id, ...docSnap.data() } as Tournament;
                                if (!isInitial) {
                                    if (t.status === 'live' && !notifiedSet.has(t.id + '_live')) {
                                        notifiedSet.add(t.id + '_live');
                                        showToast(`${t.title} is now LIVE!`, 'success');
                                    }
                                }
                                isInitial = false;
                            }
                        },
                        (error) => {
                            console.warn("Error in tournament snapshot:", error);
                        }
                    );
                    unsubList.push(unsub);
                });
            } catch (error) {
                console.warn("Error setting up tournament listeners:", error);
            }
        };

        setupLiveListeners();

        const checkUpcoming = async () => {
            const now = new Date();
            const thirtyMinsLater = new Date(now.getTime() + 30 * 60000);

            try {
                // Reuse IDs already fetched by setupLiveListeners when available.
                // Fall back to a fresh participant query only on the first interval tick
                // before setupLiveListeners has completed.
                let tourIds = tourIdsRef.current;
                if (tourIds.length === 0) {
                    const partSnap = await getDocs(query(collection(db, 'participants'), where('userId', '==', user.uid)));
                    tourIds = partSnap.docs.map(d => d.data().tournamentId).filter(Boolean);
                    tourIdsRef.current = tourIds;
                }

                // Filter to only IDs not yet notified to avoid unnecessary reads
                const unnotified = tourIds.filter(id => !notifiedSet.has(id + '_upcoming'));
                if (unnotified.length === 0) return;

                // Batch-fetch tournament docs using __name__ in (max 30 per query)
                // instead of N sequential getDoc calls — reduces N reads to ceil(N/30) reads.
                const BATCH_SIZE = 30;
                const snapshots = await Promise.all(
                    Array.from({ length: Math.ceil(unnotified.length / BATCH_SIZE) }, (_, i) => {
                        const batch = unnotified.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
                        return getDocs(query(
                            collection(db, 'tournaments'),
                            where('__name__', 'in', batch)
                        ));
                    })
                );

                for (const snap of snapshots) {
                    for (const tDocSnap of snap.docs) {
                        const t = { id: tDocSnap.id, ...tDocSnap.data() } as Tournament;
                        if (notifiedSet.has(t.id + '_upcoming')) continue;
                        const startTime = toDateSafe(t.startTime);
                        if (!startTime) continue;
                        if (startTime > now && startTime <= thirtyMinsLater && t.status === 'upcoming') {
                            await NotificationService.create(
                                user.uid,
                                'Upcoming Tournament!',
                                `${t.title} is starting in less than 30 minutes. Get ready!`,
                                'warning',
                                `/tournaments/${t.id}`
                            );
                            notifiedSet.add(t.id + '_upcoming');
                            showToast(`${t.title} starts in 30m!`, 'warning');
                        }
                    }
                }
            } catch (err) {
                console.warn("Error checking upcoming tournaments:", err);
            }
        };

        checkUpcoming();
        const interval = setInterval(checkUpcoming, 5 * 60000);

        return () => {
            isMounted = false;
            unsubList.forEach(unsub => unsub());
            clearInterval(interval);
        };
    }, [user?.uid, showToast]);

    return (
        <NotificationContext.Provider value={{ showToast }}>
            {children}
            {/* Toast Container */}
            <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
                {toasts.map(toast => (
                    <div 
                        key={toast.id} 
                        className={`pointer-events-auto w-full max-w-[calc(100vw-2rem)] sm:min-w-[280px] sm:w-auto p-4 rounded-xl shadow-2xl border flex items-center gap-3 animate-slide-in-right ${
                            toast.type === 'success' ? 'bg-green-900/90 border-green-500/50 text-green-100' :
                            toast.type === 'error' ? 'bg-red-900/90 border-red-500/50 text-red-100' :
                            toast.type === 'warning' ? 'bg-yellow-900/90 border-yellow-500/50 text-yellow-100' :
                            'bg-card/90 border-gray-700/50 text-gray-100'
                        }`}
                    >
                        <div className="flex-grow font-bold text-sm">{toast.message}</div>
                        <button type="button" onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} className="opacity-50 hover:opacity-100">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        </NotificationContext.Provider>
    );
};
