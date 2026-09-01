import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../context/AuthContext';

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

    // Wait for profile to load before checking roles
    if (allowedRoles && !profile && !profileTimeout) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-xs text-gray-500 font-black uppercase tracking-widest">Loading profile...</p>
            </div>
        );
    }

    if (allowedRoles && profileTimeout && !profile) {
        return <Navigate to="/dashboard" replace />;
    }

    if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
        return <Navigate to="/dashboard" replace />;
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
