import React from 'react';
import {Trash, Edit, Plus} from 'lucide-react';

import { AdminPanelTabProps } from './types';

export const PromoTab: React.FC<AdminPanelTabProps> = (props) => {
    const { editingPromo, formatCurrency, handleDeletePromo, handleSavePromo, isPromoModalOpen, promoActive, promoAmount, promoCode, promoCodes, promoMaxUses, setEditingPromo, setIsPromoModalOpen, setPromoActive, setPromoAmount, setPromoCode, setPromoMaxUses } = props;
    return (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-white uppercase tracking-wider">Promo Codes</h2>
                        <button type="button" 
                            onClick={() => {
                                setEditingPromo(null);
                                setPromoCode('');
                                setPromoAmount('');
                                setPromoMaxUses('');
                                setPromoActive(true);
                                setIsPromoModalOpen(true);
                            }}
                            className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" /> Add Promo
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {promoCodes.map(p => (
                            <div key={p.id} className="bg-card p-4 rounded-2xl border border-slate-800">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="text-xl font-black text-brand-400 tracking-tighter">{p.code}</div>
                                        <div className="text-xs text-slate-400 font-bold uppercase">{p.isActive ? 'Active' : 'Inactive'}</div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button type="button" onClick={() => {
                                            setEditingPromo(p);
                                            setPromoCode(p.code);
                                            setPromoAmount(p.amount.toString());
                                            setPromoMaxUses(p.maxUses.toString());
                                            setPromoActive(p.isActive);
                                            setIsPromoModalOpen(true);
                                        }} className="text-blue-400 hover:text-white"><Edit className="w-4 h-4" /></button>
                                        <button type="button" onClick={() => handleDeletePromo(p.id)} className="text-red-400 hover:text-white"><Trash className="w-4 h-4" /></button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                                    <div className="bg-dark p-2 rounded border border-slate-700">
                                        <div className="text-[10px] text-slate-400 uppercase font-bold">Amount</div>
                                        <div className="text-sm text-white font-bold">{formatCurrency(p.amount)}</div>
                                    </div>
                                    <div className="bg-dark p-2 rounded border border-slate-700">
                                        <div className="text-[10px] text-slate-400 uppercase font-bold">Uses</div>
                                        <div className="text-sm text-white font-bold">{p.currentUses} / {p.maxUses}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {isPromoModalOpen && (
                        <div className="fixed inset-0 modal-backdrop backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                            <div className="bg-card w-full max-w-md rounded-2xl border border-slate-800 p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar">
                                <h3 className="text-xl font-bold text-white uppercase tracking-widest border-b border-slate-800 pb-4">
                                    {editingPromo ? 'Edit Promo Code' : 'Add Promo Code'}
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <label htmlFor="promo-code" className="text-xs text-slate-400 uppercase font-bold mb-1 block">Code</label>
                                        <input type="text" value={promoCode} onChange={e => setPromoCode(e.target.value)} className="w-full bg-dark border border-slate-700 rounded-lg p-3 text-white focus:border-brand-500 focus-visible:outline-none uppercase" placeholder="WELCOME50" />
                                    </div>
                                    <div>
                                        <label htmlFor="promo-amount" className="text-xs text-slate-400 uppercase font-bold mb-1 block">Amount</label>
                                        <input type="number" value={promoAmount} onChange={e => setPromoAmount(e.target.value)} className="w-full bg-dark border border-slate-700 rounded-lg p-3 text-white focus:border-brand-500 focus-visible:outline-none" />
                                    </div>
                                    <div>
                                        <label htmlFor="promo-max-uses" className="text-xs text-slate-400 uppercase font-bold mb-1 block">Max Uses</label>
                                        <input type="number" value={promoMaxUses} onChange={e => setPromoMaxUses(e.target.value)} className="w-full bg-dark border border-slate-700 rounded-lg p-3 text-white focus:border-brand-500 focus-visible:outline-none" />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <input type="checkbox" id="promoActive" checked={promoActive} onChange={e => setPromoActive(e.target.checked)} className="w-4 h-4 accent-brand-500" />
                                        <label htmlFor="promoActive" className="text-sm text-gray-300 font-bold uppercase">Active</label>
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button type="button" onClick={() => setIsPromoModalOpen(false)} className="flex-1 bg-surface py-3 rounded-xl font-bold">Cancel</button>
                                    <button type="button" onClick={handleSavePromo} className="flex-1 bg-brand-600 py-3 rounded-xl font-bold">Save</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
    );
};
