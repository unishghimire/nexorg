import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Trophy, Swords, LogOut, Wallet, Smartphone, Sparkles, User, Radio } from 'lucide-react';
import { NEXPLAY_LOGO } from '../constants/constants';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { calculateLevel } from '../utils/utils';

interface OrgNavbarProps {
  onCreateTournament?: () => void;
  onCreateScrim?: () => void;
}

export const OrgNavbar: React.FC<OrgNavbarProps> = () => {
    const { user, profile, logout } = useAuth();
    const { isInstalled, promptInstall } = usePwaInstall();
    const navigate = useNavigate();
    const location = useLocation();

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
                            <span className="text-lg font-black text-white uppercase tracking-wider">NEX<span className="text-brand-500">ORG</span></span>
                            <span className="ml-2 text-[9px] bg-brand-500/20 text-brand-400 font-bold px-1.5 py-0.5 rounded border border-brand-500/30 uppercase">Host Suite</span>
                        </div>
                    </Link>
                    <Link 
                        to="/login"
                        className="text-xs bg-brand-600 hover:bg-brand-500 text-white font-black px-4 py-2 rounded-lg uppercase tracking-wider transition"
                    >
                        Host Sign In
                    </Link>
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
                            <span className="text-lg font-black text-white uppercase tracking-wider">NEX<span className="text-brand-500">ORG</span></span>
                            <span className="text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-widest bg-brand-500/20 text-brand-400 border-brand-500/30">
                                ORGANIZER
                            </span>
                        </div>
                    </Link>

                    <nav className="hidden lg:flex items-center gap-1.5">
                        <Link 
                            to="/" 
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 ${
                                location.pathname === '/' && !location.search
                                    ? 'bg-brand-600/20 text-brand-400 border border-brand-500/30'
                                    : 'text-gray-400 hover:text-white hover:bg-surface'
                            }`}
                        >
                            <Trophy className="w-3.5 h-3.5" />
                            <span>Dashboard</span>
                        </Link>
                        <Link 
                            to="/?tab=tournaments" 
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 ${
                                location.search.includes('tab=tournaments') || location.pathname.startsWith('/tournaments')
                                    ? 'bg-brand-600/20 text-brand-400 border border-brand-500/30'
                                    : 'text-gray-400 hover:text-white hover:bg-surface'
                            }`}
                        >
                            <Trophy className="w-3.5 h-3.5 text-yellow-500" />
                            <span>Tournaments</span>
                        </Link>
                        <Link 
                            to="/?tab=scrims" 
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 ${
                                location.search.includes('tab=scrims') || location.pathname.startsWith('/scrims')
                                    ? 'bg-brand-600/20 text-brand-400 border border-brand-500/30'
                                    : 'text-gray-400 hover:text-white hover:bg-surface'
                            }`}
                        >
                            <Swords className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Scrims</span>
                        </Link>
                        <Link 
                            to="/?tab=rooms" 
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 ${
                                location.search.includes('tab=rooms')
                                    ? 'bg-brand-600/20 text-brand-400 border border-brand-500/30'
                                    : 'text-gray-400 hover:text-white hover:bg-surface'
                            }`}
                        >
                            <Radio className="w-3.5 h-3.5 text-red-400" />
                            <span>Rooms</span>
                        </Link>
                        <Link 
                            to="/?tab=wallet" 
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 ${
                                location.search.includes('tab=wallet') || location.pathname === '/wallet'
                                    ? 'bg-brand-600/20 text-brand-400 border border-brand-500/30'
                                    : 'text-gray-400 hover:text-white hover:bg-surface'
                            }`}
                        >
                            <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Wallet</span>
                        </Link>
                    </nav>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                    {!isInstalled && (
                        <button
                            type="button"
                            onClick={() => void promptInstall()}
                            className="md:hidden inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-gradient-to-r from-purple-600/30 to-indigo-600/30 hover:from-purple-600/40 hover:to-indigo-600/40 border border-purple-500/40 text-purple-300 hover:text-white text-xs font-bold transition shadow-sm active:scale-95"
                            aria-label="Install NexOrg Native App"
                            title="Install NexOrg Native App"
                        >
                            <Smartphone className="w-3.5 h-3.5 text-purple-400" />
                            <span className="text-[11px] font-black uppercase tracking-wider">Native</span>
                        </button>
                    )}

                    <div className="flex items-center gap-2 pl-2 border-l border-gray-800">
                        {/* Organization Level Chip */}
                        <div 
                            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[11px] font-black font-mono shadow-xs cursor-default"
                            title={`Organization Level ${profile?.orgLevel || calculateLevel(profile?.orgXp || 0)} • ${(profile?.orgXp || 0).toLocaleString()} EXP`}
                        >
                            <Sparkles className="w-3 h-3 text-purple-400" />
                            <span>LVL {profile?.orgLevel || calculateLevel(profile?.orgXp || 0)}</span>
                        </div>

                        <Link to="/profile" className="text-right hidden sm:block hover:opacity-80 transition" title="View Profile">
                            <div className="text-xs font-bold text-white leading-none flex items-center gap-1">
                                <span>{profile?.orgName || profile?.username || user.email?.split('@')[0]}</span>
                            </div>
                            <div className="text-[10px] text-gray-500 font-mono mt-0.5">Verified Host</div>
                        </Link>
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

export default OrgNavbar;
