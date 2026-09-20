import React from 'react';
import { Download, X, Share, PlusSquare, Smartphone, Zap } from 'lucide-react';
import { usePwaInstall } from '../../hooks/usePwaInstall';

export const InstallAppPrompt: React.FC = () => {
    const {
        isInstalled,
        isDismissed,
        isIOS,
        showIOSModal,
        promptInstall,
        dismissPrompt,
        closeIOSModal
    } = usePwaInstall();

    const showFloatingBanner = !isInstalled && !isDismissed;

    return (
        <>
            {/* 1. Floating Native Mobile Installation Banner */}
            {showFloatingBanner && (
                <aside
                    aria-label="Install Mobile App"
                    className="md:hidden fixed bottom-4 inset-x-3 z-40 animate-slide-up"
                >
                    <div className="relative bg-[#0c1222]/95 backdrop-blur-xl border border-purple-500/40 rounded-2xl p-3 shadow-[0_10px_35px_rgba(0,0,0,0.85)] flex items-center justify-between gap-2.5 overflow-hidden">
                        <div className="absolute -left-6 -top-6 w-20 h-20 bg-purple-600/20 rounded-full blur-xl pointer-events-none" />

                        <div className="flex items-center gap-2.5 min-w-0 flex-1 relative z-10">
                            <div className="w-10 h-10 rounded-xl overflow-hidden bg-purple-950/80 border border-purple-500/40 p-1 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(139,92,246,0.3)]">
                                <img src="/logo.png" alt="NexOrg App" className="w-full h-full object-contain" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-black text-white uppercase tracking-tight truncate">
                                        NexOrg Native App
                                    </span>
                                    <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 text-[8px] font-black uppercase tracking-wider">
                                        <Zap className="w-2 h-2 text-amber-400" /> PWA
                                    </span>
                                </div>
                                <p className="text-[10px] text-slate-300 truncate">
                                    Fast fullscreen organizer &amp; host tools on mobile
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5 relative z-10 shrink-0">
                            <button
                                type="button"
                                onClick={() => void promptInstall()}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-95 text-white font-extrabold text-xs uppercase tracking-wider shadow-[0_0_16px_rgba(139,92,246,0.5)] transition-all touch-target"
                                aria-label="Install NexOrg App"
                            >
                                <Download className="w-3.5 h-3.5" />
                                <span>Install</span>
                            </button>

                            <button
                                type="button"
                                onClick={dismissPrompt}
                                className="w-7 h-7 rounded-lg text-slate-400 hover:text-white flex items-center justify-center hover:bg-white/10 transition-colors"
                                aria-label="Dismiss install prompt"
                                title="Dismiss"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </aside>
            )}

            {/* 2. iOS / Mobile Browser Instructional Modal */}
            {showIOSModal && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="install-modal-title"
                    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
                >
                    <div className="bg-[#0f172a] border border-purple-500/30 rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 animate-slide-up relative">
                        <button
                            type="button"
                            onClick={closeIOSModal}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
                            aria-label="Close installation dialog"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-purple-950/80 border border-purple-500/40 p-1.5 flex items-center justify-center shadow-[0_0_16px_rgba(139,92,246,0.4)] shrink-0">
                                <img src="/logo.png" alt="NexOrg App" className="w-full h-full object-contain" />
                            </div>
                            <div>
                                <h3 id="install-modal-title" className="text-base sm:text-lg font-black text-white uppercase tracking-tight">
                                    Install NexOrg App
                                </h3>
                                <p className="text-xs text-slate-400">
                                    {isIOS ? 'Install on iOS Safari' : 'Install on Mobile Browser'}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2.5 pt-1 text-xs text-slate-200">
                            {isIOS ? (
                                <>
                                    <div className="flex items-center gap-3 p-3 rounded-xl bg-[#141d33] border border-white/5">
                                        <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                                            <Share className="w-4 h-4" />
                                        </div>
                                        <p>
                                            1. Tap the <span className="text-white font-bold">Share</span> icon in Safari toolbar.
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3 p-3 rounded-xl bg-[#141d33] border border-white/5">
                                        <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                                            <PlusSquare className="w-4 h-4" />
                                        </div>
                                        <p>
                                            2. Scroll down and tap <span className="text-white font-bold">Add to Home Screen</span>.
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3 p-3 rounded-xl bg-[#141d33] border border-white/5">
                                        <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                                            <Smartphone className="w-4 h-4" />
                                        </div>
                                        <p>
                                            3. Tap <span className="text-white font-bold">Add</span> to install the app!
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex items-center gap-3 p-3 rounded-xl bg-[#141d33] border border-white/5">
                                        <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                                            <Share className="w-4 h-4" />
                                        </div>
                                        <p>
                                            1. Tap the <span className="text-white font-bold">Menu (⋮)</span> in your browser.
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3 p-3 rounded-xl bg-[#141d33] border border-white/5">
                                        <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                                            <PlusSquare className="w-4 h-4" />
                                        </div>
                                        <p>
                                            2. Select <span className="text-white font-bold">Install app</span> or <span className="text-white font-bold">Add to Home screen</span>.
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3 p-3 rounded-xl bg-[#141d33] border border-white/5">
                                        <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                                            <Smartphone className="w-4 h-4" />
                                        </div>
                                        <p>
                                            3. Launch the native organizer experience directly from your home screen!
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={closeIOSModal}
                            className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-purple-900/40 transition active:scale-95"
                        >
                            Got It
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default InstallAppPrompt;
