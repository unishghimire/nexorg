import React from 'react';
import {Users, ArrowDown, ArrowUp, Check, X, Trash, Edit, Eye, Plus, Bell, Info} from 'lucide-react';

import { AdminPanelTabProps } from './types';

export const DashboardTab: React.FC<AdminPanelTabProps> = (props) => {
    const { DEFAULT_BANNER, NEXPLAY_LOGO, activityLogs, closeConfirmModal, editingSlide, executeRejectTx, formatCurrency, formatDate, getRelativeTime, handleApproveTx, handleDeleteSlide, handleSaveSlide, isSlideModalOpen, pendingTransactions, setEditingSlide, setIsSlideModalOpen, setSlideBtnText, setSlideDescription, setSlideImage, setSlideIsActive, setSlideLink, setSlideTitle, slideBtnText, slideDescription, slideImage, slideIsActive, slideLink, slideTitle, slides, stats, uploading, users, setConfirmModal, setSelectedTx, handlePasteSlide, handleDropSlide, handleDragOverSlide, processAndUploadSlide } = props;
    return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
                    <div className="col-span-full grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-2">
                        <div className="relative overflow-hidden bg-gradient-to-br from-blue-900/40 to-blue-900/10 p-4 sm:p-6 rounded-2xl border border-blue-500/20 flex items-center gap-3 sm:gap-5 group">
                            <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-colors"></div>
                            <div className="w-14 h-14 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center text-xl border border-blue-500/30 shadow-lg shadow-blue-500/20">
                                <Users className="w-7 h-7" />
                            </div>
                            <div>
                                <div className="text-xs text-blue-200/70 uppercase font-bold tracking-wider mb-1">Total Holdings (recent users)</div>
                                <div className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight truncate">{formatCurrency(stats.totalBalance)}</div>
                            </div>
                        </div>
                        <div className="relative overflow-hidden bg-gradient-to-br from-green-900/40 to-green-900/10 p-4 sm:p-6 rounded-2xl border border-green-500/20 flex items-center gap-3 sm:gap-5 group">
                            <div className="absolute -right-6 -top-6 w-24 h-24 bg-green-500/10 rounded-full blur-2xl group-hover:bg-green-500/20 transition-colors"></div>
                            <div className="w-14 h-14 rounded-2xl bg-green-500/20 text-green-400 flex items-center justify-center text-xl border border-green-500/30 shadow-lg shadow-green-500/20">
                                <ArrowDown className="w-7 h-7" />
                            </div>
                            <div>
                                <div className="text-xs text-green-200/70 uppercase font-bold tracking-wider mb-1">Today's Deposits</div>
                                <div className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight truncate">{formatCurrency(stats.todayDep)}</div>
                            </div>
                        </div>
                        <div className="relative overflow-hidden bg-gradient-to-br from-red-900/40 to-red-900/10 p-4 sm:p-6 rounded-2xl border border-red-500/20 flex items-center gap-3 sm:gap-5 group">
                            <div className="absolute -right-6 -top-6 w-24 h-24 bg-red-500/10 rounded-full blur-2xl group-hover:bg-red-500/20 transition-colors"></div>
                            <div className="w-14 h-14 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center text-xl border border-red-500/30 shadow-lg shadow-red-500/20">
                                <ArrowUp className="w-7 h-7" />
                            </div>
                            <div>
                                <div className="text-xs text-red-200/70 uppercase font-bold tracking-wider mb-1">Today's Withdrawals</div>
                                <div className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight truncate">{formatCurrency(stats.todayWith)}</div>
                            </div>
                        </div>
                        <div className="relative overflow-hidden bg-gradient-to-br from-purple-900/40 to-purple-900/10 p-4 sm:p-6 rounded-2xl border border-purple-500/20 flex items-center gap-3 sm:gap-5 group">
                            <div className="absolute -right-6 -top-6 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-colors"></div>
                            <div className="w-14 h-14 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center text-xl border border-purple-500/30 shadow-lg shadow-purple-500/20">
                                <Users className="w-7 h-7" />
                            </div>
                            <div>
                                <div className="text-xs text-purple-200/70 uppercase font-bold tracking-wider mb-1">Total Users</div>
                                <div className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">{users.length}</div>
                            </div>
                        </div>
                    </div>

                    <div className="col-span-full grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="bg-card p-4 sm:p-6 rounded-2xl border border-slate-800 lg:col-span-2 shadow-xl">
                            <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
                                <h2 className="font-bold text-white text-lg flex items-center gap-2">
                                    <Bell className="w-5 h-5 text-brand-400" /> Pending Transactions
                                </h2>
                                <span className="bg-brand-500/20 text-brand-400 text-xs font-bold px-3 py-1 rounded-full border border-brand-500/30">
                                    {pendingTransactions.length} Pending
                                </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[350px] sm:max-h-[450px] overflow-y-auto custom-scrollbar content-start pr-2">
                                {pendingTransactions.length > 0 ? (
                                    pendingTransactions.map(t => (
                                        <div key={t.id} className="bg-dark/50 hover:bg-dark p-5 rounded-2xl border border-slate-800 hover:border-slate-700 transition-colors shadow-md group">
                                            <div className="flex justify-between items-start mb-4 border-b border-slate-800 pb-3">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`font-black tracking-wider ${t.type === 'deposit' ? 'text-green-400' : 'text-red-400'} uppercase text-xs`}>{t.type}</span>
                                                        <span className="text-[10px] bg-surface px-2 py-0.5 rounded-full text-slate-300 font-bold tracking-wider">{t.method}</span>
                                                    </div>
                                                    <div className="text-white font-bold text-sm mb-1">{t.username || 'Unknown User'}</div>
                                                    <div className="text-[10px] text-slate-400 font-mono">{getRelativeTime(t.timestamp)}</div>
                                                </div>
                                                <div className="text-xl font-black text-white tracking-tight">{formatCurrency(Math.abs(t.amount))}</div>
                                            </div>
                                            <div className="text-[11px] text-slate-400 mb-5 bg-dark/40 p-2 rounded-lg border border-slate-800/50 font-mono flex justify-between items-center">
                                                <span className="text-slate-500">REF:</span> 
                                                <span className="text-brand-300 select-all">{t.refId}</span>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                <button type="button" onClick={() => handleApproveTx(t)} className="bg-green-600/20 hover:bg-green-600 text-green-400 hover:text-white border border-green-500/30 hover:border-green-500 py-2.5 min-h-[44px] rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-colors">
                                                    <Check className="w-4 h-4" /> Approve
                                                </button>
                                                <button type="button" onClick={() => {
                                                    setConfirmModal({
                                                        isOpen: true,
                                                        title: 'Reject Transaction',
                                                        message: 'Are you sure you want to reject this transaction?',
                                                        isDestructive: true,
                                                        onConfirm: () => {
                                                            executeRejectTx(t, 'Rejected by Admin');
                                                            closeConfirmModal();
                                                        }
                                                    });
                                                }} className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 hover:border-red-500 py-2.5 min-h-[44px] rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-colors">
                                                    <X className="w-4 h-4" /> Reject
                                                </button>
                                                <button type="button" onClick={() => setSelectedTx(t)} className="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 hover:border-blue-500 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-colors">
                                                    <Eye className="w-4 h-4" /> Review
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-full h-full flex flex-col items-center justify-center text-slate-400 py-10">
                                        <div className="w-16 h-16 bg-dark rounded-full flex items-center justify-center mb-4 border border-slate-800">
                                            <Check className="text-3xl text-green-500/50" />
                                        </div>
                                        <p className="font-bold uppercase tracking-widest text-sm text-slate-500">All Caught Up!</p>
                                        <p className="text-xs text-gray-700 mt-1">No pending transactions to review.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-card p-4 sm:p-6 rounded-2xl border border-slate-800 shadow-xl max-h-[450px] sm:max-h-[550px] flex flex-col">
                            <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
                                <h2 className="font-bold text-white text-lg flex items-center gap-2">
                                    <Info className="w-5 h-5 text-brand-400" /> Activity Feed
                                </h2>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
                                {activityLogs.length > 0 ? (
                                    activityLogs.map(log => (
                                        <div key={log.id} className="bg-dark/50 p-4 rounded-xl border border-slate-800">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-brand-400 font-bold text-sm">{log.action}</span>
                                                <div className="text-right">
                                                    <div className="text-[10px] text-slate-400">{formatDate(log.timestamp)}</div>
                                                    <div className="text-[10px] text-slate-400 font-mono">{getRelativeTime(log.timestamp)}</div>
                                                </div>
                                            </div>
                                            <p className="text-slate-300 text-xs mb-2">{log.details}</p>
                                            <div className="text-[10px] text-slate-400 font-mono">By: {log.adminEmail}</div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                        <p className="text-sm">No recent activity.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-card p-4 rounded-xl border border-slate-800">
                            <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                                <h2 className="font-bold text-white">Promotion Slider</h2>
                                <button type="button" 
                                    onClick={() => {
                                        setEditingSlide(null);
                                        setSlideTitle('');
                                        setSlideImage('');
                                        setSlideLink('');
                                        setSlideBtnText('View More');
                                        setIsSlideModalOpen(true);
                                    }}
                                    className="bg-brand-600 px-2 py-1 rounded text-xs text-white"
                                >
                                    Add New
                                </button>
                            </div>
                            <div className="h-48 overflow-y-auto custom-scrollbar">
                                {slides.length > 0 ? (
                                    slides.map(s => (
                                        <div key={s.id} className="flex justify-between items-center bg-dark p-2 rounded mb-2 border border-slate-700">
                                            <div className="flex items-center gap-2">
                                                <img src={s.imageUrl || undefined} onError={(e) => { e.currentTarget.src = NEXPLAY_LOGO; }} className="w-10 h-6 object-cover rounded" alt={s.title} loading="lazy" />
                                                <span className="text-white text-sm truncate flex-1 min-w-0">{s.title}</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button type="button" onClick={() => {
                                                    setEditingSlide(s);
                                                    setSlideTitle(s.title);
                                                    setSlideDescription(s.description || '');
                                                    setSlideImage(s.imageUrl);
                                                    setSlideLink(s.link);
                                                    setSlideBtnText(s.buttonText);
                                                    setSlideIsActive(s.isActive);
                                                    setIsSlideModalOpen(true);
                                                }} className="text-blue-400 hover:text-white"><Edit className="w-4 h-4" /></button>
                                                <button type="button" aria-label="Delete promotion slide" onClick={() => handleDeleteSlide(s.id)} className="text-red-400 hover:text-white p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-colors"><Trash className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-slate-400 text-sm text-center">No custom slides.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {isSlideModalOpen && (
                        <div className="fixed inset-0 modal-backdrop backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                            <div className="bg-card w-full max-w-md rounded-2xl border border-slate-800 p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar">
                                <h3 className="text-xl font-bold text-white uppercase tracking-widest border-b border-slate-800 pb-4">
                                    {editingSlide ? 'Edit Slide' : 'Add Slide'}
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <label htmlFor="slide-title" className="text-xs text-slate-400 uppercase font-bold mb-1 block">Title</label>
                                        <input id="slide-title" type="text" value={slideTitle} onChange={e => setSlideTitle(e.target.value)} className="w-full bg-dark border border-slate-700 rounded-lg p-3 text-white focus:border-brand-500 focus-visible:outline-none" />
                                    </div>
                                    <div>
                                        <label htmlFor="slide-desc" className="text-xs text-slate-400 uppercase font-bold mb-1 block">Description</label>
                                        <textarea id="slide-desc" value={slideDescription} onChange={e => setSlideDescription(e.target.value)} className="w-full bg-dark border border-slate-700 rounded-lg p-3 text-white focus:border-brand-500 focus-visible:outline-none h-20 resize-none" placeholder="Short description for the slide..." />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-400 uppercase font-bold mb-1 block">Image (Paste, Drop or Click to Select)</label>
                                        <div 
                                            onPaste={handlePasteSlide}
                                            onDrop={handleDropSlide}
                                            onDragOver={handleDragOverSlide}
                                            onClick={() => document.getElementById('slide-image-file-input')?.click()}
                                            className={`relative w-full aspect-video rounded-xl border-2 border-dashed transition-colors flex items-center justify-center overflow-hidden group cursor-pointer ${uploading ? 'border-brand-500 bg-brand-500/10' : 'border-slate-700 hover:border-brand-500 bg-dark'}`}
                                        >
                                            {uploading ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                                                    <span className="text-[10px] text-brand-400 font-bold uppercase">Uploading...</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <img 
                                                        src={slideImage || DEFAULT_BANNER || undefined} 
                                                        alt="Slide Preview" 
                                                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition"
                                                        onError={(e) => (e.currentTarget.src = NEXPLAY_LOGO)}
                                                        referrerPolicy="no-referrer" loading="lazy" />
                                                    <div className="absolute inset-0 flex items-center justify-center bg-dark/40 opacity-0 group-hover:opacity-100 transition">
                                                        <Plus className="w-8 h-8 text-white" />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        <input 
                                            id="slide-image-file-input"
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => {
                                                if (e.target.files?.[0]) {
                                                    processAndUploadSlide(e.target.files[0]);
                                                }
                                            }}
                                        />
                                        <div className="mt-2">
                                            <input type="text" value={slideImage} onChange={e => setSlideImage(e.target.value)} className="w-full bg-dark border border-slate-700 rounded-lg p-3 text-white focus:border-brand-500 focus-visible:outline-none text-xs" placeholder="Or paste URL..." />
                                        </div>
                                    </div>
                                    <div>
                                        <label htmlFor="slide-link" className="text-xs text-slate-400 uppercase font-bold mb-1 block">Link</label>
                                        <input id="slide-link" type="text" value={slideLink} onChange={e => setSlideLink(e.target.value)} className="w-full bg-dark border border-slate-700 rounded-lg p-3 text-white focus:border-brand-500 focus-visible:outline-none" placeholder="/tournaments or https://..." />
                                    </div>
                                    <div>
                                        <label htmlFor="slide-btn-text" className="text-xs text-slate-400 uppercase font-bold mb-1 block">Button Text</label>
                                        <input type="text" value={slideBtnText} onChange={e => setSlideBtnText(e.target.value)} className="w-full bg-dark border border-slate-700 rounded-lg p-3 text-white focus:border-brand-500 focus-visible:outline-none" />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="checkbox" 
                                            id="slideIsActive"
                                            checked={slideIsActive} 
                                            onChange={e => setSlideIsActive(e.target.checked)} 
                                            className="w-4 h-4 rounded border-slate-700 bg-dark text-brand-600 focus:ring-brand-500"
                                        />
                                        <label htmlFor="slideIsActive" className="text-xs text-slate-300 font-bold uppercase cursor-pointer">Active Status</label>
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button type="button" onClick={() => setIsSlideModalOpen(false)} className="flex-1 bg-surface py-3 rounded-xl font-bold">Cancel</button>
                                    <button type="button" onClick={handleSaveSlide} className="flex-1 bg-brand-600 py-3 rounded-xl font-bold">Save</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
    );
};
