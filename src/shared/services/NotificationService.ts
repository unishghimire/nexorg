import { collection, addDoc, serverTimestamp, query, where, orderBy, limit, onSnapshot, doc, updateDoc, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Notification } from '../types/types';

export interface NotificationCreateOptions {
    userId: string;
    title: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'alert';
    link?: string;
    actionUrl?: string;
}

export const NotificationService = {
    // Create a new notification for a user (supports both positional and object signatures)
    create: async (
        userIdOrOptions: string | NotificationCreateOptions,
        title?: string,
        message?: string,
        type: 'info' | 'success' | 'warning' | 'alert' = 'info',
        link?: string
    ) => {
        try {
            let targetUid: string;
            let targetTitle: string;
            let targetMessage: string;
            let targetType: 'info' | 'success' | 'warning' | 'alert' = 'info';
            let targetLink: string | undefined;

            if (typeof userIdOrOptions === 'object') {
                targetUid = userIdOrOptions.userId;
                targetTitle = userIdOrOptions.title;
                targetMessage = userIdOrOptions.message;
                targetType = userIdOrOptions.type || 'info';
                targetLink = userIdOrOptions.link || userIdOrOptions.actionUrl;
            } else {
                targetUid = userIdOrOptions;
                targetTitle = title || '';
                targetMessage = message || '';
                targetType = type;
                targetLink = link;
            }

            if (!targetUid) return;

            await addDoc(collection(db, 'notifications'), {
                userId: targetUid,
                title: targetTitle,
                message: targetMessage,
                type: targetType,
                read: false,
                link: targetLink || null,
                timestamp: serverTimestamp()
            });
        } catch (error) {
            console.error("Error creating notification:", error);
        }
    },

    // Mark a notification as read
    markAsRead: async (notificationId: string) => {
        try {
            const ref = doc(db, 'notifications', notificationId);
            await updateDoc(ref, { read: true });
        } catch (error) {
            console.error("Error marking notification as read:", error);
        }
    },

    // Mark all notifications as read for a user
    markAllAsRead: async (userId: string) => {
        try {
            const q = query(collection(db, 'notifications'), where('userId', '==', userId), where('read', '==', false));
            const snap = await getDocs(q);
            const promises = snap.docs.map(d => updateDoc(d.ref, { read: true }));
            await Promise.all(promises);
        } catch (error) {
            console.error("Error marking all notifications as read:", error);
        }
    },

    // Listen for unread notifications for a user
    onUnreadCount: (userId: string, callback: (count: number) => void) => {
        if (!userId) return () => {};
        try {
            const q = query(collection(db, 'notifications'), where('userId', '==', userId), where('read', '==', false));
            return onSnapshot(q, (snapshot) => {
                callback(snapshot.size);
            }, (error) => {
                console.warn("Permission restricted for unread count, returning 0");
                callback(0);
            });
        } catch (e) {
            console.warn("Could not fetch unread count:", e);
            callback(0);
            return () => {};
        }
    },

    // Listen for all notifications for a user (bounded to the latest 50)
    onNotifications: (userId: string, callback: (notifications: Notification[]) => void) => {
        if (!userId) return () => {};
        try {
            const q = query(
                collection(db, 'notifications'),
                where('userId', '==', userId),
                orderBy('timestamp', 'desc'),
                limit(50)
            );
            return onSnapshot(q, (snapshot) => {
                let notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
                callback(notifications);
            }, (error) => {
                console.warn("Permission restricted for notifications, returning empty");
                callback([]);
            });
        } catch (e) {
            console.warn("Could not fetch notifications:", e);
            callback([]);
            return () => {};
        }
    },

    // Notify all participants of a tournament or scrim
    notifyParticipants: async (eventId: string, title: string, message: string, type: 'info' | 'success' | 'warning' | 'alert' = 'info', link?: string) => {
        if (!eventId?.trim()) return;
        try {
            const cleanId = eventId.trim();
            const recipientUids = new Set<string>();

            // 1. Query participants by tournamentId and scrimId in parallel
            const tQ = query(collection(db, 'participants'), where('tournamentId', '==', cleanId));
            const sQ = query(collection(db, 'participants'), where('scrimId', '==', cleanId));

            const [tSnap, sSnap] = await Promise.all([
                getDocs(tQ).catch(() => ({ docs: [] })),
                getDocs(sQ).catch(() => ({ docs: [] })),
            ]);

            tSnap.docs.forEach((d: any) => {
                const data = d.data();
                const uid = data?.userId || data?.captainUid;
                if (uid) recipientUids.add(uid);
            });
            sSnap.docs.forEach((d: any) => {
                const data = d.data();
                const uid = data?.userId || data?.captainUid;
                if (uid) recipientUids.add(uid);
            });

            // 2. Check event document itself (tournaments or scrims) for slots array with player/captain UIDs
            try {
                const [tournDoc, scrimDoc] = await Promise.all([
                    getDoc(doc(db, 'tournaments', cleanId)).catch(() => null),
                    getDoc(doc(db, 'scrims', cleanId)).catch(() => null),
                ]);

                const eventData = (tournDoc?.exists() ? tournDoc.data() : null) || (scrimDoc?.exists() ? scrimDoc.data() : null);
                if (eventData && Array.isArray(eventData.slots)) {
                    eventData.slots.forEach((slot: any) => {
                        if (slot && (slot.status === 'filled' || slot.teamName || slot.userId || slot.captainUid)) {
                            const uid = slot.userId || slot.captainUid;
                            if (uid) recipientUids.add(uid);
                        }
                    });
                }
            } catch (e) {
                console.warn('Could not inspect event doc for participant slots:', e);
            }

            if (recipientUids.size === 0) return;

            const promises = Array.from(recipientUids).map(uid =>
                addDoc(collection(db, 'notifications'), {
                    userId: uid,
                    title,
                    message,
                    type,
                    read: false,
                    link: link || null,
                    timestamp: serverTimestamp()
                }).catch(() => null)
            );
            await Promise.all(promises);
        } catch (error) {
            console.error("Error notifying participants:", error);
        }
    }
};
