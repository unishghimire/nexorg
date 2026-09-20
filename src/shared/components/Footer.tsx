import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, MessageCircle, Trophy, Users, Gamepad2, Smartphone, Download, CheckCircle2, Zap } from 'lucide-react';
import { usePwaInstall } from '../hooks/usePwaInstall';

const Footer: React.FC = () => {
    const { isInstalled, promptInstall } = usePwaInstall();

    return (
        <footer className="relative bg-[#070a12] border-t border-purple-950/40 text-center py-10 px-4 mt-auto">
            {/* Subtle brand glow line */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent"></div>

            <div className="max-w-7xl mx-auto px-4">
                {/* Native Mobile App Card — Rendered at the footer of all pages */}
                <div className="w-full max-w-md mx-auto mb-8 p-4 rounded-2xl bg-gradient-to-br from-[#120d2b] via-[#0d1326] to-[#08182b] border border-purple-500/40 shadow-xl relative overflow-hidden text-left">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-purple-600/20 rounded-full blur-xl pointer-events-none" />
                    <div className="relative z-10 flex items-center gap-3.5 mb-3">
                        <div className="w-12 h-12 rounded-xl bg-purple-950/90 border border-purple-400/50 p-1 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(168,85,247,0.4)]">
                            <img src="/logo.png" alt="NexOrg App" className="w-full h-full object-contain" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-white uppercase tracking-tight">
                                    NexOrg Native App
                                </span>
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[9px] font-black uppercase tracking-wider">
                                    <Zap className="w-2.5 h-2.5 text-amber-400" /> PWA
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-300 leading-snug mt-0.5">
                                Fullscreen host tools, real-time match room management, and instant payouts on mobile.
                            </p>
                        </div>
                    </div>

                    {isInstalled ? (
                        <div className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span>NexOrg App Installed &amp; Ready</span>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => void promptInstall()}
                            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-purple-900/50 active:scale-[0.98] transition-all touch-target"
                        >
                            <Smartphone className="w-4 h-4 text-purple-200" />
                            <Download className="w-4 h-4 text-purple-200" />
                            <span>Install Native Mobile App</span>
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8 text-left">
                    {/* Brand + Description */}
                    <div className="col-span-2 md:col-span-1">
                        <Link to="/" className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 rounded-lg overflow-hidden bg-purple-900/50 border border-purple-500/40 p-1 flex items-center justify-center">
                                <img src="/logo.png" alt="NexOrg Logo" className="w-full h-full object-contain" />
                            </div>
                            <span className="font-black text-lg tracking-tight text-white">Nex<span className="text-brand-500">Org</span></span>
                        </Link>
                        <p className="text-gray-400 text-xs leading-relaxed">
                            Nepal's premier host suite for esports tournaments, scrims, room credentials, and prize payouts.
                        </p>
                    </div>

                    {/* Manage */}
                    <nav aria-label="Management links">
                        <h3 className="text-white font-bold text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5 text-purple-300">
                            <Trophy className="w-4 h-4" aria-hidden="true" /> Manage
                        </h3>
                        <ul className="space-y-1.5 text-xs">
                            <li><Link to="/organizer?tab=tournaments" className="text-gray-400 hover:text-white transition inline-block py-1">Tournaments</Link></li>
                            <li><Link to="/organizer?tab=scrims" className="text-gray-400 hover:text-white transition inline-block py-1">Daily Scrims</Link></li>
                            <li><Link to="/organizer?tab=rooms" className="text-gray-400 hover:text-white transition inline-block py-1">Match Rooms</Link></li>
                            <li><Link to="/organizer?tab=payouts" className="text-gray-400 hover:text-white transition inline-block py-1">Prize Payouts</Link></li>
                        </ul>
                    </nav>

                    {/* Support */}
                    <nav aria-label="Support links">
                        <h3 className="text-white font-bold text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5 text-blue-300">
                            <Users className="w-4 h-4" aria-hidden="true" /> Support
                        </h3>
                        <ul className="space-y-1.5 text-xs">
                            <li><a href="https://wa.me/9779767783336" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 transition inline-block py-1">WhatsApp Helpdesk</a></li>
                            <li><a href="mailto:nexplayorg@gmail.com" className="text-gray-400 hover:text-white transition inline-block py-1">Email Support</a></li>
                            <li><Link to="/organizer?tab=disputes" className="text-gray-400 hover:text-white transition inline-block py-1">Disputes Center</Link></li>
                        </ul>
                    </nav>

                    {/* Platform */}
                    <nav aria-label="Platform links">
                        <h3 className="text-white font-bold text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5 text-emerald-300">
                            <Gamepad2 className="w-4 h-4" aria-hidden="true" /> Platform
                        </h3>
                        <ul className="space-y-1.5 text-xs">
                            <li><Link to="/organizer" className="text-gray-400 hover:text-white transition inline-block py-1">Host Portal</Link></li>
                            <li><Link to="/profile" className="text-gray-400 hover:text-white transition inline-block py-1">Organization Profile</Link></li>
                            <li><span className="text-gray-500 text-[11px]">System Status: Operational</span></li>
                        </ul>
                    </nav>
                </div>

                <div className="border-t border-gray-800/80 pt-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
                    <p className="text-gray-500 text-center md:text-left">
                        &copy; {new Date().getFullYear()} NexPlay Esports. All rights reserved.
                    </p>
                    <div className="flex flex-wrap gap-4 text-gray-400">
                        <a href="mailto:nexplayorg@gmail.com" className="hover:text-white transition flex items-center gap-1.5 py-1">
                            <Mail className="w-3.5 h-3.5" aria-hidden="true" /> nexplayorg@gmail.com
                        </a>
                        <a href="https://wa.me/9779767783336" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition flex items-center gap-1.5 py-1">
                            <MessageCircle className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" /> WhatsApp Host Support
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
