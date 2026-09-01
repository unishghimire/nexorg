import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../shared/context/AuthContext';

const ProfileCompletionGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, profile, loading, authError } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    // ponytail: 5s timeout — if profile never loads (Firestore issue), stop blocking.
    // Ceiling: user with truly missing profile doc won't get redirected to complete-profile.
    // Upgrade: server-side profile creation on first login.
    const [profileTimeout, setProfileTimeout] = useState(false);

    // Auth pages (/login, /register) must mount immediately so they can call
    // getRedirectResult after a Google OAuth redirect. Blocking them behind a
    // spinner prevents the redirect result from being processed, leaving the
    // user stuck on the login page after Google sign-in.
    const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

    useEffect(() => {
        if (!loading && user && profile) {
            const isProfileIncomplete = !profile.inGameId || !profile.inGameName;
            const isNotOnCompleteProfilePage = location.pathname !== '/complete-profile';
            
            if (isProfileIncomplete && isNotOnCompleteProfilePage) {
                navigate('/complete-profile', { replace: true });
            }
        }
    }, [user, profile, loading, location.pathname, navigate]);

    useEffect(() => {
        if (user && !profile && !loading) {
            const timer = setTimeout(() => setProfileTimeout(true), 5000);
            return () => clearTimeout(timer);
        }
        setProfileTimeout(false);
    }, [user, profile, loading]);

    // Only block if loading AND not timed out. When authError is set the profile
    // could not be loaded — don't block (e.g. the login page shows a retry there).
    // Skip blocking entirely on /login and /register (see isAuthPage comment above).
    if (!isAuthPage && (loading || (user && !profile && !authError && !profileTimeout))) {
        return (
            <div className="min-h-[100dvh] bg-dark flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand-500"></div>
            </div>
        );
    }

    return <>{children}</>;
};

export default ProfileCompletionGuard;
