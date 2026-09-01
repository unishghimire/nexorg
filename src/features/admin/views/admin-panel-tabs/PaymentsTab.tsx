import React from 'react';
import { Trash, Edit, Plus, Sparkles, AlertCircle } from 'lucide-react';

import { AdminPanelTabProps } from './types';

export const PaymentsTab: React.FC<AdminPanelTabProps> = (props) => {
    const { 
        NEXPLAY_LOGO, 
        categoryActive, 
        categoryDescription, 
        categoryName, 
        editingCategory, 
        editingPayment, 
        handleDeleteCategory, 
        handleDeletePayment, 
        handleSaveCategory, 
        handleSavePayment, 
        handleSeedDefaultPayments,
        isCategoryModalOpen, 
        isPaymentModalOpen, 
        paymentActive, 
        paymentCategories = [], 
        paymentCategoryId, 
        paymentInstructions, 
        paymentMethods = [], 
        paymentName, 
        paymentType,
        setCategoryActive, 
        setCategoryDescription, 
        setCategoryName, 
        setEditingCategory, 
        setEditingPayment, 
        setIsCategoryModalOpen, 
        setIsPaymentModalOpen, 
        setPaymentActive, 
        setPaymentCategoryId, 
        setPaymentInstructions, 
        setPaymentName, 
        setPaymentQr, 
        uploading, 
        setPaymentType, 
        handlePastePayment, 
        handleDropPayment, 
        handleDragOverPayment, 
        processAndUploadPayment, 
        paymentQr 
    } = props;

    return (
        <div className="space-y-12">
            {/* Payment Categories Section */}
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-white uppercase tracking-wider">Payment Categories</h2>
                        <p className="text-xs text-slate-400 mt-1">Organize payment methods into categories (e.g. Digital Wallets, Mobile Banking, Direct Bank)</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {paymentCategories.length === 0 && handleSeedDefaultPayments && (
                            <button 
                                type="button"
                                onClick={handleSeedDefaultPayments}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2.5 min-h-[44px] rounded-lg font-bold text-xs transition flex items-center gap-2 shadow-lg shadow-emerald-950/40"
                            >
                                <Sparkles className="w-4 h-4" /> Load Nepal Defaults
                            </button>
                        )}
                        <button 
                            type="button" 
                            onClick={() => {
                                setEditingCategory(null);
                                setCategoryName('');
                                setCategoryDescription('');
                                setCategoryActive(true);
                                setIsCategoryModalOpen(true);
                            }}
                            className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2.5 min-h-[44px] rounded-lg font-bold text-sm transition flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" /> Add Category
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {paymentCategories.length === 0 ? (
                        <div className="col-span-full py-8 text-center bg-dark/50 rounded-2xl border border-slate-800 space-y-2">
                            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">No categories configured.</p>
                            <p className="text-xs text-slate-500">Create a category first to attach payment methods to.</p>
                        </div>
                    ) : paymentCategories.map(cat => (
                        <div key={cat.id} className="bg-card p-4 rounded-xl border border-slate-800 flex flex-col gap-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-white">{cat.name}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`w-2 h-2 rounded-full ${cat.isActive ? 'bg-green-500' : 'bg-surface'}`}></span>
                                        <span className="text-[10px] text-slate-400 uppercase font-bold">{cat.isActive ? 'Active' : 'Inactive'}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        type="button" 
                                        onClick={() => {
                                            setEditingCategory(cat);
                                            setCategoryName(cat.name);
                                            setCategoryDescription(cat.description);
                                            setCategoryActive(cat.isActive);
                                            setIsCategoryModalOpen(true);
                                        }} 
                                        className="text-blue-400 hover:text-white p-2"
                                        title="Edit Category"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button 
                                        type="button" 
                                        aria-label="Delete category" 
                                        onClick={() => handleDeleteCategory(cat.id)} 
                                        className="text-red-400 hover:text-white p-2 flex items-center justify-center rounded-lg transition-colors"
                                        title="Delete Category"
                                    >
                                        <Trash className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="text-[10px] text-slate-400 bg-dark p-2 rounded border border-slate-700 h-16 overflow-y-auto">
                                {cat.description || 'No description'}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Payment Methods Section */}
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-white uppercase tracking-wider">Payment Methods (QR Codes)</h2>
                        <p className="text-xs text-slate-400 mt-1">Manage deposit QR codes, account numbers, and transfer instructions shown to users</p>
                    </div>
                    <button 
                        type="button" 
                        onClick={() => {
                            setEditingPayment(null);
                            setPaymentName('');
                            setPaymentCategoryId(paymentCategories.length === 1 ? paymentCategories[0].id : '');
                            setPaymentQr('');
                            setPaymentInstructions('');
                            setPaymentType('eSewa');
                            setPaymentActive(true);
                            setIsPaymentModalOpen(true);
                        }}
                        className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2.5 min-h-[44px] rounded-lg font-bold text-sm transition flex items-center gap-2 self-start sm:self-auto"
                    >
                        <Plus className="w-4 h-4" /> Add Method
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {paymentMethods.length === 0 ? (
                        <div className="col-span-full py-10 text-center bg-dark/50 rounded-2xl border border-slate-800 space-y-3">
                            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">No payment methods configured.</p>
                            <p className="text-xs text-slate-500">
                                {paymentCategories.length === 0 
                                    ? 'Click "Load Nepal Defaults" above or create a category first.' 
                                    : 'Click "Add Method" to configure a payment gateway or QR code.'}
                            </p>
                        </div>
                    ) : paymentMethods.map(pm => {
                        const category = paymentCategories.find(c => c.id === pm.categoryId);
                        return (
                            <div key={pm.id} className="bg-card p-4 rounded-xl border border-slate-800 flex flex-col gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 bg-dark rounded-lg border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                                        <img 
                                            src={pm.qrUrl || undefined} 
                                            className="w-full h-full object-contain" 
                                            alt="QR" 
                                            loading="lazy" 
                                            onError={(e) => (e.currentTarget.src = NEXPLAY_LOGO)}
                                        />
                                    </div>
                                    <div className="flex-grow min-w-0">
                                        <h3 className="font-bold text-white truncate">{pm.name}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`w-2 h-2 rounded-full shrink-0 ${pm.isActive ? 'bg-green-500' : 'bg-surface'}`}></span>
                                            <span className="text-[10px] text-slate-400 uppercase font-bold truncate">
                                                {category ? category.name : (pm.type || 'Custom')} | {pm.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2 shrink-0">
                                        <button 
                                            type="button" 
                                            onClick={() => {
                                                setEditingPayment(pm);
                                                setPaymentName(pm.name);
                                                setPaymentCategoryId(pm.categoryId || '');
                                                setPaymentQr(pm.qrUrl);
                                                setPaymentInstructions(pm.instructions);
                                                setPaymentType(pm.type || 'eSewa');
                                                setPaymentActive(pm.isActive);
                                                setIsPaymentModalOpen(true);
                                            }} 
                                            className="text-blue-400 hover:text-white p-1.5"
                                            title="Edit Method"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => handleDeletePayment(pm.id)} 
                                            className="text-red-400 hover:text-white p-1.5"
                                            title="Delete Method"
                                        >
                                            <Trash className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="text-[10px] text-slate-400 bg-dark p-2.5 rounded border border-slate-700 h-16 overflow-y-auto whitespace-pre-line">
                                    {pm.instructions}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Category Modal */}
            {isCategoryModalOpen && (
                <div className="fixed inset-0 modal-backdrop backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-card w-full max-w-lg rounded-2xl border border-slate-800 p-5 sm:p-8 space-y-6 shadow-2xl">
                        <h3 className="text-xl font-bold text-white uppercase tracking-widest border-b border-slate-800 pb-4">
                            {editingCategory ? 'Edit Category' : 'Add Category'}
                        </h3>
                        
                        <div className="space-y-5">
                            <div>
                                <label htmlFor="payment-cat-name" className="text-xs text-slate-400 uppercase font-bold mb-2 block">Category Name *</label>
                                <input 
                                    id="payment-cat-name"
                                    type="text" 
                                    value={categoryName}
                                    onChange={(e) => setCategoryName(e.target.value)}
                                    className="w-full bg-dark border border-slate-700 rounded-lg p-3 text-white focus:border-brand-500 focus-visible:outline-none transition text-sm"
                                    placeholder="e.g. Digital Wallets, Mobile Banking, Bank Transfer"
                                />
                            </div>
                            <div>
                                <label htmlFor="payment-cat-desc" className="text-xs text-slate-400 uppercase font-bold mb-2 block">Description</label>
                                <textarea 
                                    id="payment-cat-desc"
                                    value={categoryDescription}
                                    onChange={(e) => setCategoryDescription(e.target.value)}
                                    className="w-full bg-dark border border-slate-700 rounded-lg p-3 text-white focus:border-brand-500 focus-visible:outline-none transition h-24 resize-none text-sm"
                                    placeholder="Brief description of this category (e.g. eSewa, Khalti, IME Pay instant transfers)..."
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                <input 
                                    type="checkbox" 
                                    id="catActive"
                                    checked={categoryActive}
                                    onChange={(e) => setCategoryActive(e.target.checked)}
                                    className="w-4 h-4 rounded bg-dark border-slate-700 text-brand-500 focus:ring-brand-500"
                                />
                                <label htmlFor="catActive" className="text-sm text-white font-bold cursor-pointer">Active (Visible to users)</label>
                            </div>
                        </div>

                        <div className="flex gap-4 pt-4 border-t border-slate-800">
                            <button 
                                type="button" 
                                onClick={() => setIsCategoryModalOpen(false)}
                                className="flex-1 bg-surface hover:bg-surface/80 text-white py-3 rounded-xl font-bold transition text-sm"
                            >
                                Cancel
                            </button>
                            <button 
                                type="button" 
                                onClick={handleSaveCategory}
                                className="flex-1 bg-brand-600 hover:bg-brand-500 text-white py-3 rounded-xl font-bold transition text-sm shadow-lg shadow-brand-950/40"
                            >
                                {editingCategory ? 'Update Category' : 'Save Category'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Method Modal */}
            {isPaymentModalOpen && (
                <div className="fixed inset-0 modal-backdrop backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-card w-full max-w-lg rounded-2xl border border-slate-800 p-5 sm:p-8 space-y-6 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar">
                        <h3 className="text-xl font-bold text-white uppercase tracking-widest border-b border-slate-800 pb-4">
                            {editingPayment ? 'Edit Payment Method' : 'Add Payment Method'}
                        </h3>

                        {paymentCategories.length === 0 && (
                            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center justify-between gap-3">
                                <div className="flex items-start gap-2.5">
                                    <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs text-amber-400 font-bold uppercase">No Categories Available</p>
                                        <p className="text-xs text-slate-300 mt-0.5">You need to create a Category before adding a payment method.</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsPaymentModalOpen(false);
                                        setEditingCategory(null);
                                        setCategoryName('');
                                        setCategoryDescription('');
                                        setCategoryActive(true);
                                        setIsCategoryModalOpen(true);
                                    }}
                                    className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs px-3 py-2 rounded-lg transition shrink-0"
                                >
                                    + Add Category
                                </button>
                            </div>
                        )}
                        
                        <div className="space-y-5">
                            <div>
                                <label htmlFor="payment-category" className="text-xs text-slate-400 uppercase font-bold mb-2 block">Category *</label>
                                <select 
                                    id="payment-category"
                                    value={paymentCategoryId}
                                    onChange={(e) => setPaymentCategoryId(e.target.value)}
                                    className="w-full bg-dark border border-slate-700 rounded-lg p-3 text-white focus:border-brand-500 focus-visible:outline-none transition text-sm"
                                >
                                    <option value="">-- Select a Category --</option>
                                    {paymentCategories.map(cat => (
                                        <option key={cat.id} value={cat.id}>
                                            {cat.name} {!cat.isActive ? '(Inactive)' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label htmlFor="payment-type" className="text-xs text-slate-400 uppercase font-bold mb-2 block">Payment Type / Provider</label>
                                <select 
                                    id="payment-type"
                                    value={paymentType || 'eSewa'}
                                    onChange={(e) => setPaymentType(e.target.value)}
                                    className="w-full bg-dark border border-slate-700 rounded-lg p-3 text-white focus:border-brand-500 focus-visible:outline-none transition text-sm"
                                >
                                    <option value="eSewa">eSewa</option>
                                    <option value="Khalti">Khalti</option>
                                    <option value="IME Pay">IME Pay</option>
                                    <option value="FonePay">FonePay QR</option>
                                    <option value="Bank">Bank Transfer</option>
                                    <option value="Wallet">Digital Wallet (Generic)</option>
                                    <option value="QR">QR Code (Generic)</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>

                            <div>
                                <label htmlFor="payment-method-name" className="text-xs text-slate-400 uppercase font-bold mb-2 block">Method Name *</label>
                                <input 
                                    id="payment-method-name"
                                    type="text" 
                                    value={paymentName}
                                    onChange={(e) => setPaymentName(e.target.value)}
                                    className="w-full bg-dark border border-slate-700 rounded-lg p-3 text-white focus:border-brand-500 focus-visible:outline-none transition text-sm"
                                    placeholder="e.g. eSewa (Official) or Global IME Bank"
                                />
                            </div>

                            <div>
                                <label htmlFor="payment-qr" className="text-xs text-slate-400 uppercase font-bold mb-2 block">QR Code Image * (Paste, Drop or Click to Select)</label>
                                <div 
                                    onPaste={handlePastePayment}
                                    onDrop={handleDropPayment}
                                    onDragOver={handleDragOverPayment}
                                    onClick={() => document.getElementById('payment-qr-file-input')?.click()}
                                    className={`relative w-48 h-48 mx-auto rounded-xl border-2 border-dashed transition-colors flex items-center justify-center overflow-hidden group cursor-pointer ${uploading ? 'border-brand-500 bg-brand-500/10' : 'border-slate-700 hover:border-brand-500 bg-dark'}`}
                                >
                                    {uploading ? (
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                                            <span className="text-[10px] text-brand-400 font-bold uppercase">Uploading...</span>
                                        </div>
                                    ) : (
                                        <>
                                            <img 
                                                src={paymentQr || NEXPLAY_LOGO || undefined} 
                                                alt="QR Preview" 
                                                className="w-full h-full object-contain opacity-80 group-hover:opacity-100 transition"
                                                onError={(e) => (e.currentTarget.src = NEXPLAY_LOGO)}
                                                referrerPolicy="no-referrer" 
                                                loading="lazy" 
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center bg-dark/40 opacity-0 group-hover:opacity-100 transition">
                                                <Plus className="w-8 h-8 text-white" />
                                            </div>
                                        </>
                                    )}
                                </div>
                                <input 
                                    id="payment-qr-file-input"
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                        if (e.target.files?.[0]) {
                                            processAndUploadPayment(e.target.files[0]);
                                        }
                                    }}
                                />
                                <div className="mt-3">
                                    <input 
                                        type="text" 
                                        value={paymentQr}
                                        onChange={(e) => setPaymentQr(e.target.value)}
                                        className="w-full bg-dark border border-slate-700 rounded-lg p-3 text-white focus:border-brand-500 focus-visible:outline-none text-sm transition"
                                        placeholder="Or paste QR Image URL..."
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="payment-instructions" className="text-xs text-slate-400 uppercase font-bold mb-2 block">Instructions * (Account Name, Number, etc.)</label>
                                <textarea 
                                    id="payment-instructions"
                                    value={paymentInstructions}
                                    onChange={(e) => setPaymentInstructions(e.target.value)}
                                    className="w-full bg-dark border border-slate-700 rounded-lg p-3 text-white focus:border-brand-500 focus-visible:outline-none h-24 transition text-sm"
                                    placeholder="Account Name: NexPlay Official&#10;Number: 98XXXXXXXX&#10;Please attach screenshot of payment receipt."
                                />
                            </div>

                            <div className="flex items-center gap-3 bg-dark/50 p-3 rounded-lg border border-slate-800">
                                <input 
                                    type="checkbox" 
                                    id="paymentActive"
                                    checked={paymentActive}
                                    onChange={(e) => setPaymentActive(e.target.checked)}
                                    className="w-5 h-5 accent-brand-500 cursor-pointer"
                                />
                                <label htmlFor="paymentActive" className="text-sm text-slate-300 font-bold uppercase cursor-pointer">Active (Visible to users)</label>
                            </div>
                        </div>

                        <div className="flex gap-4 pt-2 border-t border-slate-800">
                            <button 
                                type="button" 
                                onClick={() => setIsPaymentModalOpen(false)}
                                className="flex-1 bg-surface hover:bg-surface/80 text-white py-3 rounded-xl font-bold transition text-sm"
                            >
                                Cancel
                            </button>
                            <button 
                                type="button" 
                                onClick={handleSavePayment}
                                className="flex-1 bg-brand-600 hover:bg-brand-500 text-white py-3 rounded-xl font-bold transition text-sm shadow-lg shadow-brand-950/40"
                            >
                                {editingPayment ? 'Update Method' : 'Save Method'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

