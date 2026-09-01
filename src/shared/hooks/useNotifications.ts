import { useState, useEffect } from 'react';
import { NotificationService } from '../services/NotificationService';
import { Notification } from '../types/types';
import { useAuth } from '../context/AuthContext';

/**
 * Manages notification list + unread count subscriptions for the current user.
 */
export function useNotifications() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (!user) return;
        const unsubNotifications = NotificationService.onNotifications(user.uid, setNotifications);
        const unsubCount = NotificationService.onUnreadCount(user.uid, setUnreadCount);
        return () => {
            unsubNotifications();
            unsubCount();
        };
    }, [user]);

    const markAsRead = async (id: string) => {
        await NotificationService.markAsRead(id);
    };

    const markAllAsRead = async () => {
        if (user) await NotificationService.markAllAsRead(user.uid);
    };

    return { notifications, unreadCount, markAsRead, markAllAsRead };
}
