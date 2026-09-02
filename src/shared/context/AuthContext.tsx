import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { doc, onSnapshot, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut, getRedirectResult, User as FirebaseUser } from 'firebase/auth';
import { db, auth } from '../config/firebase';
import { UserProfile } from '../types/types';
import { ensureUserDocument, ensurePublicProfile } from '../services/userProfileService';
import { useUserPresence } from '../hooks/useUserPresence';

export interface AuthUser {
    uid: string;
    email: string;
    username: string;
    role: string;
}

interface AuthContextType {
    user: AuthUser | null;
    profile: UserProfile | null;
    loading: boolean;
    profileLoading: boolean;
    authError: string | null;
    retryAuth: () => void;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    profile: null,
    loading: true,
    profileLoading: false,
    authError: null,
    retryAuth: () => {},
    logout: async () => {}
});

export const useAuth = () => useContext(AuthContext);

// ponytail: 8s timeout — if onAuthStateChanged never fires (network issue, Firebase down),
// unblock the UI and render as logged-out. Prevents infinite loading screen.
const AUTH_TIMEOUT_MS = 8000;
// Bounded profile initialization. The authenticated session is kept regardless of
// the outcome; a failure sets authError so the UI can offer retry instead of
// silently logging the user out.
const PROFILE_TIMEOUT_MS = 15000;

// Derive a username that always satisfies the users create rule:
// isValidUserProfile() requires a string with 3 <= size <= 30. Google
// display names can be empty, shorter than 3 chars, or longer than 30 —
// any of those makes the auto-provision create fail the rule (which used
// to silently log the user out, and now surfaces as authError).
const deriveUsername = (firebaseUser: FirebaseUser): string => {
    const candidate = (firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '').trim().replace(/\s+/g, ' ');
    if (candidate.length >= 3) {
        return candidate.slice(0, 30);
    }
    const suffix = (firebaseUser.uid || 'user').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6);
    return `Player${suffix}`;
};

const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
    new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timed out')), ms);
        promise.then(
            (value) => { clearTimeout(timer); resolve(value); },
            (error) => { clearTimeout(timer); reject(error); }
        );
    });

// Custom claims are the single source of truth for role (BUG-030). Read the role
// claim from the ID token; returns null when no claim is set yet (migration window).
const getClaimRole = async (firebaseUser: FirebaseUser, forceRefresh = false): Promise<string | null> => {
    try {
        const idTokenResult = await withTimeout(firebaseUser.getIdTokenResult(forceRefresh), 5000);
        const role = (idTokenResult as any).claims?.role;
        return typeof role === 'string' && role ? role : null;
    } catch {
        return null;
    }
};

// ponytail: super-admin email allowlist — grants admin without custom claims setup.
// Ceiling: if this email is compromised, they have full admin. Upgrade path: set
// custom claims via /api/admin/bootstrap once ADMIN_BOOTSTRAP_KEY env var is configured,
// then remove this allowlist.
export const SUPER_ADMIN_EMAILS = ['nexplayorg@gmail.com', 'nex.unishghimire@gmail.com', 'admin@nexplay.gg'];

export const isSuperAdminEmail = (email?: string | null): boolean => {
    if (!email) return false;
    const normalized = email.trim().toLowerCase();
    return SUPER_ADMIN_EMAILS.some(e => e.trim().toLowerCase() === normalized);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [profileLoading, setProfileLoading] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);
    const firebaseUserRef = useRef<FirebaseUser | null>(null);
    const initInFlightRef = useRef(false);

    // Sync live user presence to Firebase Realtime Database
    useUserPresence();

    const logout = async () => {
        if (user) {
            try {
                await updateDoc(doc(db, 'users', user.uid), {
                    status: 'offline',
                    lastActive: serverTimestamp()
                });
            } catch (e) {
                // Failed to update status on logout
            }
        }
        await signOut(auth);
        firebaseUserRef.current = null;
        setAuthError(null);
        setUser(null);
        setProfile(null);
    };

    const initProfile = useCallback(async () => {
        const firebaseUser = firebaseUserRef.current;
        if (!firebaseUser || initInFlightRef.current) return;
        initInFlightRef.current = true;
        setAuthError(null);
        setProfileLoading(true);
        try {
            const userRef = doc(db, 'users', firebaseUser.uid);
            let nextProfile: UserProfile | null = null;

            await withTimeout((async () => {
                const userSnap = await getDoc(userRef);

                if (!userSnap.exists()) {
                    // Create user document if it doesn't exist (e.g., first Google Sign-In)
                    const username = deriveUsername(firebaseUser);
                    await ensureUserDocument({ uid: firebaseUser.uid, email: firebaseUser.email || '', username });
                    await ensurePublicProfile({ uid: firebaseUser.uid, username });

                    const refreshedSnap = await getDoc(userRef);
                    nextProfile = refreshedSnap.exists()
                        ? refreshedSnap.data() as UserProfile
                        : { uid: firebaseUser.uid, email: firebaseUser.email || '', username, role: 'player' } as UserProfile;
                } else {
                    nextProfile = userSnap.data() as UserProfile;
                }
            })(), PROFILE_TIMEOUT_MS);

            // Only apply the result if the session is still the one we resolved for
            // (guards against a logout racing the in-flight initialization).
            if (firebaseUserRef.current?.uid === firebaseUser.uid && nextProfile) {
                // Super-admin email gets admin role on profile
                const isSuperAdminInit = isSuperAdminEmail(firebaseUser.email);
                const resolvedRole = isSuperAdminInit ? 'admin' : (nextProfile.role || 'player');
                setProfile(isSuperAdminInit ? { ...nextProfile, role: 'admin' } : nextProfile);
                setUser(prev => prev ? { ...prev, username: nextProfile.username, role: resolvedRole } : prev);
            }
        } catch (error: any) {
            console.error('Auth: profile initialization failed:', error);
            const isDebug = import.meta.env?.VITE_DEBUG_AUTH === 'true';
            const code = typeof error?.code === 'string' ? error.code : '';
            const detailedMsg = isDebug ? JSON.stringify(error, null, 2) : '';
            setAuthError(
                code
                    ? `Could not load your profile (${code}). Check your connection and try again.`
                    : detailedMsg || 'Could not load your profile. Check your connection and try again.'
            );
        } finally {
            setProfileLoading(false);
            initInFlightRef.current = false;
        }
    }, []);

    useEffect(() => {
        let settled = false;
        let disposed = false;

        const markDone = () => {
            if (!settled) {
                settled = true;
                setLoading(false);
            }
        };

        // Process any pending redirect result immediately on mount, so the
        // auth state is restored even if the Login/Register component hasn't
        // mounted yet (e.g., ProfileCompletionGuard could block them).
        // onAuthStateChanged will fire with the user once the result is processed.
        getRedirectResult(auth).catch((err) => {
            if (!disposed) {
                console.error('Auth: getRedirectResult error:', err?.code, err);
            }
        });

        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            if (disposed) return;
            firebaseUserRef.current = firebaseUser;

            if (firebaseUser) {
                // Keep the authenticated user even if the profile cannot be loaded;
                // authError carries the failure so the UI can offer a retry.
                const isSuperAdmin = isSuperAdminEmail(firebaseUser.email);
                setUser({ uid: firebaseUser.uid, email: firebaseUser.email || '', username: deriveUsername(firebaseUser), role: isSuperAdmin ? 'admin' : 'player' });
                setAuthError(null);
                markDone();
                void initProfile();
                // Pull the role claim from the ID token (claims are the source of truth).
                void getClaimRole(firebaseUser, false).then((claimRole) => {
                    if (firebaseUserRef.current?.uid === firebaseUser.uid) {
                        const isSuperAdmin = isSuperAdminEmail(firebaseUser.email);
                        const effectiveRole = isSuperAdmin ? 'admin' : (claimRole || undefined);
                        if (effectiveRole) setUser(prev => prev ? { ...prev, role: effectiveRole } : prev);
                    }
                });
            } else {
                firebaseUserRef.current = null;
                setUser(null);
                setProfile(null);
                setAuthError(null);
                markDone();
            }
        });

        // Timeout fallback — if onAuthStateChanged never fires, unblock the UI
        const timeoutId = setTimeout(() => {
            console.warn('Auth: Firebase auth timed out after 8s, rendering as logged-out');
            markDone();
        }, AUTH_TIMEOUT_MS);

        return () => {
            disposed = true;
            unsubscribe();
            clearTimeout(timeoutId);
        };
    }, [initProfile]);

    const statusRef = React.useRef<string | undefined>(profile?.status);
    useEffect(() => {
        statusRef.current = profile?.status;
    }, [profile?.status]);

    useEffect(() => {
        if (user) {
            const userRef = doc(db, 'users', user.uid);
            const unsubscribeProfile = onSnapshot(userRef, (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.data() as UserProfile;
                    // Super-admin email gets admin role on profile too, so dropdown/routes see it
                    const isSuperAdmin = isSuperAdminEmail(user.email);
                    setProfile(isSuperAdmin ? { ...data, role: 'admin' } : data);
                    // Update user role if it changes in profile — super-admin email always wins
                    setUser(prev => {
                        if (!prev) return prev;
                        const isSuper = isSuperAdminEmail(prev.email);
                        const effectiveRole = isSuper ? 'admin' : (data.role || prev.role || 'player');
                        return prev.role !== effectiveRole ? { ...prev, role: effectiveRole } : prev;
                    });
                }
            }, (error) => {
                // Error in user profile snapshot
            });

            // Presence Management — debounced to avoid excessive Firestore writes
            // ponytail: was writing on every visibilitychange event; now debounced 5s
            let presenceTimer: ReturnType<typeof setTimeout> | null = null;
            const updatePresence = async (status: 'online' | 'idle' | 'offline' | 'dnd') => {
                if (statusRef.current === 'dnd' && status !== 'offline') return;

                if (presenceTimer) clearTimeout(presenceTimer);
                presenceTimer = setTimeout(async () => {
                    try {
                        await updateDoc(userRef, {
                            status,
                            lastActive: serverTimestamp()
                        });
                    } catch (e) {
                        // Presence update failed — non-critical
                    }
                }, 5000);
            };

            // Immediate online on mount, but skip the debounce for initial
            updateDoc(userRef, { status: 'online', lastActive: serverTimestamp() }).catch(() => {});

            const handleVisibilityChange = () => {
                if (document.visibilityState === 'visible') {
                    updatePresence('online');
                } else {
                    updatePresence('idle');
                }
            };

            const handleBeforeUnload = () => {
                // Can't debounce beforeunload — fire immediately
                if (presenceTimer) clearTimeout(presenceTimer);
                updateDoc(userRef, { status: 'offline', lastActive: serverTimestamp() }).catch(() => {});
            };

            document.addEventListener('visibilitychange', handleVisibilityChange);
            window.addEventListener('beforeunload', handleBeforeUnload);

            return () => {
                unsubscribeProfile();
                document.removeEventListener('visibilitychange', handleVisibilityChange);
                window.removeEventListener('beforeunload', handleBeforeUnload);
            };
        }
    }, [user?.uid]);

    // When the profile role changes (admin promoted/demoted a user), force-refresh the
    // ID token so the custom-claims role is picked up (BUG-030). Claims win over the
    // doc role when present; the doc role remains a display fallback during migration.
    useEffect(() => {
        const fu = firebaseUserRef.current;
        if (!fu) return;
        let cancelled = false;
        void getClaimRole(fu, true).then((claimRole) => {
            if (cancelled || firebaseUserRef.current?.uid !== fu.uid) return;
            // Super-admin email always wins over claims
            const isSuperAdmin = isSuperAdminEmail(fu.email);
            const effectiveRole = isSuperAdmin ? 'admin' : (claimRole || undefined);
            if (effectiveRole) setUser(prev => prev ? { ...prev, role: effectiveRole } : prev);
        });
        return () => { cancelled = true; };
    }, [profile?.role]);

    return (
        <AuthContext.Provider value={{ user, profile, loading, profileLoading, authError, retryAuth: () => void initProfile(), logout }}>
            {children}
        </AuthContext.Provider>
    );
};
