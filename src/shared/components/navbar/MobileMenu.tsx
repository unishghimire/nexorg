import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/utils';

interface MobileMenuProps {
    isOpen: boolean;
    onClose: () => void;
    navLinks: { name: string; path: string }[];
    secondaryLinks?: { name: string; path: string }[];
}

/**
 * Slide-down mobile menu for the Navbar. Renders nav links, account section
 * (when logged in), or login CTA (when logged out).
 */
const MobileMenu: React.FC<MobileMenuProps> = ({ isOpen, onClose, navLinks, secondaryLinks = [] }) => {
    const { user, profile, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const isActive = (path: string) => location.pathname === path;

    const handleLogout = () => {
        logout();
        navigate('/');
        onClose();
    };

    return (
        <div className={`lg:hidden absolute top-[100%] left-0 w-full transition-colors duration-300 ease-in-out bg-dark/95 backdrop-blur-xl border-t border-gray-800 ${isOpen ? 'max-h-[calc(100dvh-4rem)] sm:max-h-[calc(100dvh-5rem)] opacity-100 overflow-y-auto' : 'max-h-0 opacity-0 pointer-events-none border-t-0 overflow-hidden'}`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-2" inert={!isOpen}>
                {user && (
                    <div className="flex sm:hidden items-center p-4 gap-4 mb-4 bg-surface/20 rounded-xl border border-gray-800/50">
                        <div className="w-12 h-12 shrink-0 bg-brand-700 rounded-full flex items-center justify-center font-bold text-lg ring-2 ring-brand-500 overflow-hidden">
                            {profile?.profilePicUrl ? <img src={profile.profilePicUrl} className="w-full h-full object-cover" alt="Avatar" loading="lazy" /> : (profile?.username || 'U')[0].toUpperCase()}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <div className="font-bold text-white truncate text-lg">{(profile?.username || 'User')}</div>
                            <div className="text-sm font-black text-brand-400 mt-1 cursor-pointer flex items-center gap-1 w-max px-3 py-2 bg-brand-900/20 touch-target rounded-lg hover:bg-brand-900/40 transition" onClick={() => { navigate('/wallet'); onClose(); }}>
                                <Wallet className="w-4 h-4" />
                                {formatCurrency((profile?.balance || 0) + (profile?.orgWalletBalance || 0))}
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-1">
                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-4 mb-2">Navigation</div>
                    {navLinks.map((link) => (
                        <Link
                            key={link.path}
                            to={link.path}
                            onClick={onClose}
                            className={`block px-4 py-3 rounded-xl text-sm font-bold transition-colors ${isActive(link.path) ? 'text-brand-400 bg-brand-500/10' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
                        >
                            {link.name}
                        </Link>
                    ))}
                </div>

                {secondaryLinks.length > 0 && (
                    <div className="pt-4 mt-4 border-t border-gray-800 space-y-1">
                        <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-4 mb-2">Explore</div>
                        {secondaryLinks.map((link) => (
                            <Link
                                key={link.path}
                                to={link.path}
                                onClick={onClose}
                                className={`block px-4 py-3 rounded-xl text-sm font-bold transition-colors ${isActive(link.path) ? 'text-brand-400 bg-brand-500/10' : 'text-gray-300 hover:text-white hover:bg-white/5'}`}
                            >
                                {link.name}
                            </Link>
                        ))}
                    </div>
                )}

                {user ? (
                    <div className="pt-4 mt-4 border-t border-gray-800 space-y-1">
                        <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-4 mb-2">Account</div>
                        <Link to="/dashboard" onClick={onClose} className="block px-4 py-3 rounded-xl text-sm font-bold text-gray-300 hover:text-white hover:bg-white/5 transition-colors">
                            Dashboard
                        </Link>
                        <Link to="/profile" onClick={onClose} className="block px-4 py-3 rounded-xl text-sm font-bold text-gray-300 hover:text-white hover:bg-white/5 transition-colors">
                            My Profile
                        </Link>
                        <Link to="/wallet" onClick={onClose} className="block sm:hidden px-4 py-3 rounded-xl text-sm font-bold text-gray-300 hover:text-white hover:bg-white/5 transition-colors">
                            My Wallet
                        </Link>
                        <button type="button" onClick={handleLogout} className="block w-full text-left px-4 py-3 rounded-xl text-sm font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors mt-2">
                            Sign Out
                        </button>
                    </div>
                ) : (
                    <div className="pt-4 mt-4 border-t border-gray-800 sm:hidden">
                        <Link to="/login" onClick={onClose} className="flex items-center justify-center w-full bg-brand-500 hover:bg-brand-600 text-white px-6 py-3 rounded-full font-black tracking-widest text-sm transition-colors shadow-lg hover:shadow-brand-500/25">
                            LOGIN / SIGN UP
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MobileMenu;
