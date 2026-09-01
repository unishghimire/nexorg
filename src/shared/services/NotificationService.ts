import { collection, addDoc, serverTimestamp, query, where, orderBy, limit, onSnapshot, doc, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Notification } from '../types/types';

export const NotificationService = {
    // Create a new notification for a user
    create: async (userId: string, title: string, message: string, type: 'info' | 'success' | 'warning' | 'alert' = 'info', link?: string) => {
        try {
            await addDoc(collection(db, 'notifications'), {
                userId,
                title,
                message,
                type,
                read: false,
                link,
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

    // Notify all participants of a tournament
    notifyParticipants: async (tournamentId: string, title: string, message: string, type: 'info' | 'success' | 'warning' | 'alert' = 'info', link?: string) => {
        try {
            const q = query(collection(db, 'participants'), where('tournamentId', '==', tournamentId));
            const snap = await getDocs(q);
            const promises = snap.docs.map(d => {
                const p = d.data();
                return addDoc(collection(db, 'notifications'), {
                    userId: p.userId,
                    title,
                    message,
                    type,
                    read: false,
                    link,
                    timestamp: serverTimestamp()
                });
            });
            await Promise.all(promises);
        } catch (error) {
            console.error("Error notifying participants:", error);
        }
    }
};
