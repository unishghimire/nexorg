import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ChevronLeft } from 'lucide-react';
import { useAuth, isSuperAdminEmail } from '../../context/AuthContext';

interface DashboardLayoutProps {
    children: React.ReactNode;
    title: string;
    description?: string;
    backUrl?: string;
    badge?: string;
    actions?: React.ReactNode;
}

export default function DashboardLayout({ children, title, description, backUrl, badge, actions }: DashboardLayoutProps) {
    const { user, profile } = useAuth();
    const navigate = useNavigate();

    const userRole = (user?.role || '').trim().toLowerCase();
    const profileRole = (profile?.role || '').trim().toLowerCase();
    const isAdmin = isSuperAdminEmail(user?.email) || userRole === 'admin' || profileRole === 'admin';
    const isAuthorized = isAdmin || userRole === 'organizer' || profileRole === 'organizer';

    if (!isAuthorized) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                    <Shield className="w-10 h-10 text-red-500" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Access Denied</h2>
                <p className="text-gray-400 max-w-md text-sm sm:text-base">You do not have the necessary permissions to access the Organizer Dashboard.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-[75vh] lg:min-h-[88vh] bg-dark/95 rounded-2xl sm:rounded-3xl border border-gray-800/80 overflow-hidden shadow-2xl relative">
            <main className="flex-1 flex flex-col min-w-0 bg-dark overflow-y-auto custom-scrollbar">
                <header className="px-4 sm:px-6 py-3.5 md:py-4 border-b border-gray-800/80 bg-dark/90 sticky top-0 backdrop-blur-xl z-20">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="min-w-0">
                            {backUrl && (
                                <button
                                    type="button"
                                    onClick={() => navigate(backUrl)}
                                    className="text-brand-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 hover:text-brand-300 mb-1.5 transition-colors"
                                >
                                    <ChevronLeft className="w-3.5 h-3.5" /> Back
                                </button>
                            )}
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h1 className="text-lg sm:text-xl font-black text-white tracking-tight uppercase">{title}</h1>
                                {badge && (
                                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-400 border border-brand-500/30">
                                        {badge}
                                    </span>
                                )}
                            </div>
                            {description && (
                                <p className="text-xs text-gray-400 font-medium mt-0.5 truncate max-w-2xl">{description}</p>
                            )}
                        </div>

                        {actions && (
                            <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                                {actions}
                            </div>
                        )}
                    </div>
                </header>

                <div className="p-3 sm:p-5 lg:p-6 flex-1 min-w-0">
                    {children}
                </div>
            </main>
        </div>
    );
}
