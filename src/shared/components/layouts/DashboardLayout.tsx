import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ChevronLeft } from 'lucide-react';
import { useAuth, isSuperAdminEmail } from '../../context/AuthContext';

interface DashboardLayoutProps {
    children: React.ReactNode;
    title: string;
    description?: string;
    backUrl?: string;
}

// ponytail: this shell used to also render its own sidebar nav, but the only
// consumer (OrganizerPanel) has its own 7-tab sidebar — that produced two
// competing sidebars. Kept this component to just page chrome (title/back +
// scroll container) since that's all any consumer actually needs.
export default function DashboardLayout({ children, title, description, backUrl }: DashboardLayoutProps) {
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
        <div className="flex flex-col min-h-[70vh] lg:min-h-[90vh] bg-black rounded-2xl sm:rounded-[2rem] border border-gray-800 overflow-hidden shadow-2xl relative">
            <main className="flex-1 flex flex-col min-w-0 bg-black overflow-y-auto custom-scrollbar">
                <header className="px-4 sm:px-6 py-5 md:px-10 md:py-8 border-b border-gray-800 bg-black/80 sticky top-0 backdrop-blur-md z-10">
                    {backUrl && (
                        <button type="button" onClick={() => navigate(backUrl)} className="text-brand-500 text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:text-brand-400 mb-4 transition-colors touch-target">
                            <ChevronLeft className="w-4 h-4" /> Back
                        </button>
                    )}
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tighter uppercase">{title}</h1>
                    {description && <p className="text-xs sm:text-sm text-gray-500 font-bold mt-2 tracking-widest uppercase">{description}</p>}
                </header>

                <div className="p-4 sm:p-6 md:p-10 flex-1 min-w-0">
                    {children}
                </div>
            </main>
        </div>
    );
}
