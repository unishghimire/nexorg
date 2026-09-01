import Seo from '../../../shared/components/Seo';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useNotification } from '../../../shared/context/NotificationContext';
import { useAuth } from '../../../shared/context/AuthContext';
import { motion } from 'motion/react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck } from 'lucide-react';
import { signInWithEmailAndPassword, signInWithRedirect, signInWithPopup, getRedirectResult, sendPasswordResetEmail } from 'firebase/auth';
import { auth, googleProvider, appleProvider } from '../../../shared/config/firebase';
import { isSafeInternalPath } from '../../../shared/utils/utils';
import { executeRecaptchaEnterprise } from '../../../shared/utils/recaptchaEnterprise';

const Login: React.FC = () => {
    const { showToast } = useNotification();
    const { user, loading: authLoading, profileLoading, authError, retryAuth } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const getRedirectTarget = () => {
        const from = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from;
        if (from && isSafeInternalPath(from.pathname)) {
            return from.pathname + (from.search || '');
        }
        return '/';
    };

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [isAppleLoading, setIsAppleLoading] = useState(false);
    const [error, setError] = useState('');
    const [captchaValue, setCaptchaValue] = useState<string | null>(null);
    // Captures the ProtectedRoute `from` on mount so a retry after authError lands
    // back on the intended page; overwritten by the handlers on a fresh submit.
    const [redirectTarget, setRedirectTarget] = useState<string>(() => getRedirectTarget());
    const submittingRef = useRef(false);
    const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY?.trim();

    // Redirect once the user is authenticated and auth has resolved.
    // Don't wait for profileLoading or authError — the user IS authenticated,
    // and authError only means the profile doc couldn't be loaded (not that
    // the sign-in failed). ProtectedRoute handles authError with a retry UI.
    useEffect(() => {
        if (user && !authLoading) {
            navigate(redirectTarget, { replace: true });
        }
    }, [user, authLoading, redirectTarget, navigate]);

    // Handle the result of signInWithRedirect (fires after the page reloads from OAuth).
    useEffect(() => {
        let cancelled = false;
        const pendingGoogle = sessionStorage.getItem('google-redirect-pending') === 'true';
        const pendingApple = sessionStorage.getItem('apple-redirect-pending') === 'true';
        if (pendingGoogle) setIsGoogleLoading(true);
        if (pendingApple) setIsAppleLoading(true);

        getRedirectResult(auth)
            .then((result) => {
                if (cancelled) return;
                sessionStorage.removeItem('google-redirect-pending');
                sessionStorage.removeItem('apple-redirect-pending');
                if (result) {
                    showToast('Welcome back!', 'success');
                    setRedirectTarget(getRedirectTarget());
                    // Keep loading — the auth state change will navigate once settled.
                } else {
                    setIsGoogleLoading(false);
                    setIsAppleLoading(false);
                }
            })
            .catch((err: any) => {
                if (cancelled) return;
                sessionStorage.removeItem('google-redirect-pending');
                sessionStorage.removeItem('apple-redirect-pending');
                setIsGoogleLoading(false);
                setIsAppleLoading(false);
                console.error('Redirect result error:', err?.code, err);
                const authErrMap: Record<string, string> = {
                    'auth/unauthorized-domain': 'This domain is not authorised in Firebase. Add it in Firebase Console → Authentication → Authorized Domains.',
                    'auth/operation-not-allowed': 'This sign-in method is not enabled in Firebase Console → Authentication → Sign-in method.',
                    'auth/account-exists-with-different-credential': 'An account already exists with this email using a different sign-in method.',
                    'auth/network-request-failed': 'Network error. Check your connection and try again.',
                    'auth/internal-error': 'An internal error occurred. Please try again.',
                };
                const errMsg = authErrMap[err?.code] || `Social Sign-In failed (${err?.code || 'unknown'}). Please try again.`;
                setError(errMsg);
                showToast(errMsg, 'error');
            });
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // If profile initialization fails, release the loading state so the user can
    // retry instead of staring at an indefinite spinner.
    useEffect(() => {
        if (authError && (isLoading || isGoogleLoading || isAppleLoading)) {
            setIsLoading(false);
            setIsGoogleLoading(false);
            setIsAppleLoading(false);
        }
    }, [authError, isLoading, isGoogleLoading, isAppleLoading]);

    // Safety net: if sign-in succeeded but the auth state never settles (e.g. the
    // Firebase auth callback did not fire), unblock the form after a bounded wait
    // instead of leaving it stuck in loading.
    useEffect(() => {
        if ((!isLoading && !isGoogleLoading && !isAppleLoading) || user || authLoading || authError) return;
        const timer = setTimeout(() => {
            submittingRef.current = false;
            setIsLoading(false);
            setIsGoogleLoading(false);
            setIsAppleLoading(false);
            setError('Sign-in could not be confirmed. Please try again.');
        }, 15000);
        return () => clearTimeout(timer);
    }, [isLoading, isGoogleLoading, isAppleLoading, user, authLoading, authError]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submittingRef.current || user) return;
        submittingRef.current = true;
        setIsLoading(true);

        try {
            // Invisible reCAPTCHA Enterprise background verification token
            if (recaptchaSiteKey) {
                await executeRecaptchaEnterprise('LOGIN');
            }
            await signInWithEmailAndPassword(auth, email, password);
            showToast('Welcome back!', 'success');
            setRedirectTarget(getRedirectTarget());
            // Keep the loading state on success — the redirect effect above navigates
            // once the session is settled, which prevents double-submits.
        } catch (err: any) {
            submittingRef.current = false;
            setIsLoading(false);
            console.error('Login error:', err);
            const firebaseErrMap: Record<string, string> = {
                'auth/invalid-credential': 'Invalid email or password',
                'auth/user-not-found': 'Invalid email or password',
                'auth/wrong-password': 'Invalid email or password',
                'auth/too-many-requests': 'Too many attempts. Try again later.',
                'auth/user-disabled': 'This account has been disabled.',
                'auth/network-request-failed': 'Network error. Check your connection.'
            };
            const errMsg = firebaseErrMap[err.code] || 'Login failed. Please try again.';
            setError(errMsg);
            showToast(errMsg, 'error');
        }
    };

    const handleGoogleSignIn = async () => {
        if (submittingRef.current || user) return;
        setError('');
        submittingRef.current = true;
        setIsGoogleLoading(true);

        try {
            // ponytail: prefer popup (no cross-origin storage needed); fall back to
            // redirect if the popup is blocked or fails.  signInWithRedirect requires
            // third-party storage access on the auth domain, which modern browsers
            // increasingly block — popup avoids that entirely.
            try {
                await signInWithPopup(auth, googleProvider);
                // onAuthStateChanged in AuthContext handles the rest.
            } catch (popupErr: any) {
                if (popupErr?.code === 'auth/popup-blocked' || popupErr?.code === 'auth/cancelled-popup-request') {
                    // Fall back to redirect — set flag for the redirect handler
                    sessionStorage.setItem('google-redirect-pending', 'true');
                    await signInWithRedirect(auth, googleProvider);
                } else {
                    throw popupErr;
                }
            }
        } catch (err: any) {
            submittingRef.current = false;
            setIsGoogleLoading(false);
            // User cancelling the popup is not an error
            if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
                return;
            }
            console.error('Google Sign-In error:', err?.code, err);
            const googleErrMap: Record<string, string> = {
                'auth/unauthorized-domain': 'This domain is not authorised in Firebase. Add it in Firebase Console → Authentication → Authorized Domains.',
                'auth/operation-not-allowed': 'Google Sign-In is not enabled. Enable it in Firebase Console → Authentication → Sign-in method.',
                'auth/network-request-failed': 'Network error. Check your connection and try again.',
                'auth/internal-error': 'An internal error occurred. Please try again.',
                'auth/popup-blocked': 'Popup was blocked by the browser. Please allow popups for this site and try again.',
            };
            const errMsg = googleErrMap[err?.code] || `Google Sign-In failed (${err?.code || 'unknown'}). Please try again.`;
            setError(errMsg);
            showToast(errMsg, 'error');
        }
    };

    const handleAppleSignIn = async () => {
        if (submittingRef.current || user) return;
        setError('');
        submittingRef.current = true;
        setIsAppleLoading(true);

        try {
            try {
                await signInWithPopup(auth, appleProvider);
            } catch (popupErr: any) {
                if (popupErr?.code === 'auth/popup-blocked' || popupErr?.code === 'auth/cancelled-popup-request') {
                    sessionStorage.setItem('apple-redirect-pending', 'true');
                    await signInWithRedirect(auth, appleProvider);
                } else {
                    throw popupErr;
                }
            }
        } catch (err: any) {
            submittingRef.current = false;
            setIsAppleLoading(false);
            if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
                return;
            }
            console.error('Apple Sign-In error:', err?.code, err);
            const appleErrMap: Record<string, string> = {
                'auth/unauthorized-domain': 'This domain is not authorised in Firebase. Add it in Firebase Console → Authentication → Authorized Domains.',
                'auth/operation-not-allowed': 'Apple Sign-In is not enabled. Enable it in Firebase Console → Authentication → Sign-in method → Apple.',
                'auth/account-exists-with-different-credential': 'An account already exists with this email using a different sign-in method.',
                'auth/network-request-failed': 'Network error. Check your connection and try again.',
                'auth/popup-blocked': 'Popup was blocked by the browser. Please allow popups for this site and try again.',
            };
            const errMsg = appleErrMap[err?.code] || `Apple Sign-In failed (${err?.code || 'unknown'}). Please try again.`;
            setError(errMsg);
            showToast(errMsg, 'error');
        }
    };


    const handleForgotPassword = async () => {
        if (!email || !email.includes('@')) {
            showToast('Please enter a valid email address first', 'warning');
            return;
        }

        try {
            await sendPasswordResetEmail(auth, email);
            showToast('Password reset link sent to your email!', 'success');
        } catch (err: any) {
            console.error('Password reset error:', err);
            showToast(err.message || 'Failed to send reset link', 'error');
        }
    };

    return (
        <>
        <Seo
            title="Login | NexPlay"
            description="Log in to your NexPlay account."
            canonicalPath="/login"
            noindex
        />
        <div className="min-h-[100dvh] flex items-center justify-center p-4 md:p-8 bg-black">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-md w-full"
            >
                <div className="text-center mb-12">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-brand-500/10 border border-brand-500/20 mb-6">
                        <ShieldCheck className="w-10 h-10 text-brand-500" />
                    </div>
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tighter uppercase mb-2">Welcome Back</h2>
                    <p className="text-gray-400 font-bold">Login to access your NexPlay account</p>
                </div>

                <div className="bg-card/50 border border-gray-800 rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-10 shadow-2xl">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="email" className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Email Address</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-gray-500 group-focus-within:text-brand-500 transition">
                                    <Mail className="w-5 h-5" />
                                </div>
                                <input
                                    id="email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full pl-14 pr-6 py-4 bg-black border border-gray-800 rounded-2xl text-white placeholder-gray-700 focus:focus-visible:outline-none focus:border-brand-500 transition font-bold"
                                    placeholder="Enter your email"
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2 ml-1">
                                <label htmlFor="password" className="block text-xs font-black text-gray-500 uppercase tracking-widest">Password</label>
                                <button 
                                    type="button"
                                    onClick={handleForgotPassword}
                                    className="text-xs font-black text-brand-500 hover:text-brand-400 uppercase tracking-widest transition"
                                >
                                    Forgot Password?
                                </button>
                            </div>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-gray-500 group-focus-within:text-brand-500 transition">
                                    <Lock className="w-5 h-5" />
                                </div>
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full pl-14 pr-14 py-4 bg-black border border-gray-800 rounded-2xl text-white placeholder-gray-700 focus:focus-visible:outline-none focus:border-brand-500 transition font-bold"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-5 flex items-center text-gray-500 hover:text-white transition"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <motion.div 
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="bg-red-500/10 border border-red-500/20 text-red-400 px-5 py-4 rounded-2xl text-xs font-black uppercase tracking-widest"
                            >
                                {error}
                            </motion.div>
                        )}

                        {authError && user && (
                            <motion.div 
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-5 py-4 rounded-2xl text-xs font-black uppercase tracking-widest flex flex-col gap-3"
                            >
                                <span>{authError}</span>
                                <button
                                    type="button"
                                    onClick={() => retryAuth()}
                                    className="self-start text-white bg-amber-500/20 hover:bg-amber-500/30 px-4 py-2 rounded-xl transition"
                                >
                                    Retry
                                </button>
                            </motion.div>
                        )}

                        {recaptchaSiteKey ? (
                            <div className="text-center text-[11px] text-slate-500">
                                Protected by Google reCAPTCHA Enterprise. <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" className="underline hover:text-slate-400">Privacy</a> & <a href="https://policies.google.com/terms" target="_blank" rel="noreferrer" className="underline hover:text-slate-400">Terms</a>.
                            </div>
                        ) : null}

                        <button
                            type="submit"
                            disabled={isLoading || isGoogleLoading || !!user}
                            className="w-full flex items-center justify-center py-5 px-6 rounded-2xl text-sm font-black text-white bg-brand-500 hover:bg-brand-400 focus:focus-visible:outline-none transition disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest shadow-lg shadow-brand-500/20"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    Login Now <ArrowRight className="ml-2 w-5 h-5" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="flex-1 border-t border-gray-800"></div>
                            <span className="text-xs font-black text-gray-600 uppercase tracking-widest">Or continue with</span>
                            <div className="flex-1 border-t border-gray-800"></div>
                        </div>

                        <button
                            type="button"
                            onClick={handleGoogleSignIn}
                            disabled={isLoading || isGoogleLoading || isAppleLoading || !!user}
                            className="w-full flex items-center justify-center py-5 px-6 border border-gray-800 rounded-2xl bg-black text-sm font-black text-white hover:bg-card focus:focus-visible:outline-none transition disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest"
                        >
                            {isGoogleLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                                        <path
                                            fill="currentColor"
                                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                        />
                                        <path
                                            fill="#34A853"
                                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                        />
                                        <path
                                            fill="#FBBC05"
                                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                        />
                                        <path
                                            fill="#EA4335"
                                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                        />
                                    </svg>
                                    Google
                                </>
                            )}
                        </button>
                    </div>

                    <div className="mt-10 pt-8 border-t border-gray-800 text-center">
                        <p className="text-sm text-gray-500 font-bold">
                            Don't have an account?{' '}
                            <Link to="/register" className="text-brand-500 font-black hover:text-brand-400 transition uppercase tracking-widest text-xs">
                                Create Account
                            </Link>
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
        </>
    );
};

export default Login;
