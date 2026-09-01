import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { Notification } from '../../types/types';
import { useNotifications } from '../../hooks/useNotifications';
import { useClickOutside } from '../../hooks/useClickOutside';

/**
 * Notification bell + dropdown panel. Self-contained: manages its own
 * open/close state, subscriptions, and click-outside dismissal.
 */
const NotificationDropdown: React.FC = () => {
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();
    const ref = useRef<HTMLDivElement>(null);

    useClickOutside(ref, () => { if (isOpen) setIsOpen(false); });

    // Close on Escape
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    const handleClick = async (n: Notification) => {
        await markAsRead(n.id);
        if (n.link) navigate(n.link);
        setIsOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent, n: Notification) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick(n);
        }
    };

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
                aria-haspopup="true"
                aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
                className="text-gray-400 hover:text-white transition-colors relative w-11 h-11 rounded-full hover:bg-white/5 flex items-center justify-center shrink-0"
            >
                <Bell className="w-5 h-5" aria-hidden="true" />
                {unreadCount > 0 && (
                    <span
                        className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center border-2 border-dark"
                        aria-label={`${unreadCount} unread notifications`}
                    >
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="fixed top-16 left-4 right-4 sm:absolute sm:top-auto sm:left-auto sm:right-0 sm:mt-2 sm:w-80 bg-card border border-gray-700 rounded-xl shadow-2xl overflow-hidden animate-fade-in z-[60]" role="menu">
                    <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-card/50">
                        <h4 className="text-sm font-black tracking-wider uppercase text-white">Notifications</h4>
                        <button type="button" onClick={markAllAsRead} className="text-[10px] uppercase font-bold tracking-widest text-brand-400 hover:text-brand-300 transition-colors min-h-[44px] flex items-center px-2">
                            Mark all as read
                        </button>
                    </div>
                    <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
                        {notifications.length > 0 ? (
                            notifications.map(n => (
                                <button
                                    key={n.id}
                                    type="button"
                                    onClick={() => handleClick(n)}
                                    onKeyDown={(e) => handleKeyDown(e, n)}
                                    className={`w-full text-left p-4 border-b border-gray-800/50 cursor-pointer hover:bg-white/5 transition-colors ${!n.read ? 'bg-brand-900/5' : ''}`}
                                >
                                    <div className="flex justify-between items-start mb-1 gap-2">
                                        <span className={`text-xs font-bold leading-tight ${n.type === 'alert' ? 'text-red-400' : n.type === 'success' ? 'text-green-400' : 'text-brand-400'}`}>
                                            {n.title}
                                        </span>
                                        {!n.read && <span className="w-2 h-2 bg-brand-500 rounded-full shrink-0 mt-0.5" aria-hidden="true"></span>}
                                    </div>
                                    <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">{n.message}</p>
                                </button>
                            ))
                        ) : (
                            <div className="p-8 text-center text-gray-500 text-sm font-medium">No notifications</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationDropdown;
