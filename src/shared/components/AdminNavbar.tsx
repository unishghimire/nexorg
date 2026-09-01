import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Trophy, LayoutDashboard, LogOut, ExternalLink, User } from 'lucide-react';
import { NEXPLAY_LOGO } from '../constants/constants';

export const AdminNavbar: React.FC = () => {
    const { user, profile, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const isAdmin = profile?.role === 'admin';
    const isOrganizer = profile?.role === 'organizer' || isAdmin;

    const mainAppUrl = import.meta.env.VITE_MAIN_APP_URL || 'https://www.nexplayorg.app';

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    if (!user) {
        return (
            <header className="sticky top-0 z-50 bg-dark/95 backdrop-blur-md border-b border-gray-800">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-3">
                        <img src={NEXPLAY_LOGO} alt="NexPlay" className="w-8 h-8 rounded-lg object-cover" />
                        <div>
                            <span className="text-lg font-black text-white uppercase tracking-wider">NEX<span className="text-brand-500">ADMIN</span></span>
                            <span className="ml-2 text-[9px] bg-brand-500/20 text-brand-400 font-bold px-1.5 py-0.5 rounded border border-brand-500/30 uppercase">Portal</span>
                        </div>
                    </Link>
                    <div className="flex items-center gap-3">
                        <a 
                            href={mainAppUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-gray-400 hover:text-white flex items-center gap-1 font-bold uppercase transition"
                        >
                            <span>Main App</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <Link 
                            to="/login"
                            className="text-xs bg-brand-600 hover:bg-brand-500 text-white font-black px-4 py-2 rounded-lg uppercase tracking-wider transition"
                        >
                            Sign In
                        </Link>
                    </div>
                </div>
            </header>
        );
    }

    return (
        <header className="sticky top-0 z-50 bg-dark/95 backdrop-blur-md border-b border-gray-800 shadow-xl">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <Link to="/" className="flex items-center gap-3">
                        <img src={NEXPLAY_LOGO} alt="NexPlay" className="w-8 h-8 rounded-lg object-cover" />
                        <div className="flex items-center gap-2">
                            <span className="text-lg font-black text-white uppercase tracking-wider">NEX<span className="text-brand-500">ADMIN</span></span>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-widest ${
                                isAdmin 
                                    ? 'bg-red-500/20 text-red-400 border-red-500/30' 
                                    : 'bg-brand-500/20 text-brand-400 border-brand-500/30'
                            }`}>
                                {isAdmin ? 'ADMIN' : 'ORGANIZER'}
                            </span>
                        </div>
                    </Link>

                    <nav className="hidden md:flex items-center gap-2">
                        {isAdmin && (
                            <Link 
                                to="/admin" 
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 ${
                                    location.pathname.startsWith('/admin')
                                        ? 'bg-brand-600/20 text-brand-400 border border-brand-500/30'
                                        : 'text-gray-400 hover:text-white hover:bg-surface'
                                }`}
                            >
                                <Shield className="w-3.5 h-3.5" />
                                <span>Admin Panel</span>
                            </Link>
                        )}
                        {isOrganizer && (
                            <Link 
                                to="/organizer" 
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 ${
                                    location.pathname.startsWith('/organizer')
                                        ? 'bg-brand-600/20 text-brand-400 border border-brand-500/30'
                                        : 'text-gray-400 hover:text-white hover:bg-surface'
                                }`}
                            >
                                <Trophy className="w-3.5 h-3.5" />
                                <span>Organizer Hub</span>
                            </Link>
                        )}
                    </nav>
                </div>

                <div className="flex items-center gap-3">
                    <a 
                        href={mainAppUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="hidden sm:flex text-xs text-gray-400 hover:text-white items-center gap-1.5 font-bold uppercase bg-surface/40 hover:bg-surface px-3 py-1.5 rounded-lg border border-gray-800 transition"
                    >
                        <span>Main Platform</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <div className="flex items-center gap-2 pl-2 border-l border-gray-800">
                        <div className="text-right hidden sm:block">
                            <div className="text-xs font-bold text-white leading-none">{profile?.username || user.email?.split('@')[0]}</div>
                            <div className="text-[10px] text-gray-500 font-mono mt-0.5">{profile?.orgName || profile?.role}</div>
                        </div>
                        <button
                            type="button"
                            onClick={handleLogout}
                            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition border border-transparent hover:border-red-500/20"
                            title="Sign Out"
                            aria-label="Sign Out"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default AdminNavbar;
