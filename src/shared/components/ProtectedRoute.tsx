import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth, isSuperAdminEmail } from '../context/AuthContext';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
    const { user, profile, loading, authError, retryAuth } = useAuth();
    const location = useLocation();
    const [profileTimeout, setProfileTimeout] = useState(false);

    useEffect(() => {
        if (user && !profile && !loading && allowedRoles) {
            const timer = setTimeout(() => setProfileTimeout(true), 5000);
            return () => clearTimeout(timer);
        }
        setProfileTimeout(false);
    }, [user, profile, loading, allowedRoles]);

    if (loading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-xs text-gray-500 font-black uppercase tracking-widest">Verifying session...</p>
            </div>
        );
    }

    // Not authenticated at all — redirect to login
    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // User IS authenticated but profile failed to load — show retry instead of
    // redirecting to /login (which creates a bounce loop: login sees user → redirects back)
    if (authError) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
                <p className="text-red-400 font-bold text-center max-w-sm">{authError}</p>
                <button
                    onClick={retryAuth}
                    className="px-6 py-2 bg-brand-500 hover:bg-brand-400 text-white font-bold rounded-lg transition-colors"
                >
                    Retry
                </button>
            </div>
        );
    }

    const userRole = (user?.role || '').trim().toLowerCase();
    const profileRole = (profile?.role || '').trim().toLowerCase();
    const isSuperAdmin = isSuperAdminEmail(user?.email);
    const isAdmin = isSuperAdmin || userRole === 'admin' || profileRole === 'admin';
    const isOrganizer = userRole === 'organizer' || profileRole === 'organizer';
    const effectiveRole = isAdmin ? 'admin' : (isOrganizer ? 'organizer' : (profileRole || userRole || 'player'));

    const isRoleAllowed = !allowedRoles || allowedRoles.length === 0 || allowedRoles.some(r => {
        const target = r.trim().toLowerCase();
        if (target === 'admin' && isAdmin) return true;
        if (target === 'organizer' && (isAdmin || isOrganizer)) return true;
        return target === effectiveRole;
    });

    // Wait for profile to load before checking roles (unless already verified as admin)
    if (allowedRoles && !profile && !profileTimeout && !isAdmin) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-xs text-gray-500 font-black uppercase tracking-widest">Loading profile...</p>
            </div>
        );
    }

    if (allowedRoles && profileTimeout && !profile && !isAdmin) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 text-2xl font-bold">!</div>
                <h2 className="text-xl font-black uppercase tracking-wider text-white">Profile Loading Timed Out</h2>
                <p className="text-sm text-gray-400 max-w-md">Could not verify host permissions. Please check your network connection and retry.</p>
                <button
                    onClick={retryAuth}
                    className="px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-black uppercase tracking-widest rounded-xl transition"
                >
                    Retry Connection
                </button>
            </div>
        );
    }

    if (allowedRoles && (profile || isAdmin) && !isRoleAllowed) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
                <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 text-2xl font-bold">🚫</div>
                <h2 className="text-xl font-black uppercase tracking-wider text-white">Organizer Access Only</h2>
                <p className="text-sm text-gray-400 max-w-md">
                    Your account (<span className="text-white font-mono">{user.email}</span>) currently has the <span className="text-brand-400 font-bold uppercase">{effectiveRole}</span> role. This portal is strictly for verified tournament organizers and admins.
                </p>
                <div className="flex items-center gap-3 mt-2">
                    <button
                        onClick={() => window.location.href = 'https://nexplay.gg'}
                        className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-xs font-black uppercase tracking-widest rounded-xl transition"
                    >
                        Go to Player Portal
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            <Helmet>
                <meta name="robots" content="noindex, nofollow" />
            </Helmet>
            {children}
        </>
    );
};

export default ProtectedRoute;
