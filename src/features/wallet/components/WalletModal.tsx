import React, { useState, useEffect, useRef } from 'react';
import { X, ArrowDown, CreditCard, AlertTriangle, Upload } from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../../shared/config/firebase';
import { useAuth } from '../../../shared/context/AuthContext';
import { useNotification } from '../../../shared/context/NotificationContext';
import { PaymentMethod, PaymentCategory, SiteSettings } from '../../../shared/types/types';
import { formatCurrency } from '../../../shared/utils/utils';
import { uploadImage, MediaCategory } from '../../../shared/services/mediaService';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'deposit' | 'withdraw';
}

const DEFAULT_CATEGORIES: PaymentCategory[] = [
  { id: 'cat_wallets', name: 'Digital Wallets', description: 'eSewa, Khalti, IME Pay instant transfers', isActive: true, createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'cat_banking', name: 'Mobile Banking & QR', description: 'FonePay QR & ConnectIPS', isActive: true, createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'cat_bank', name: 'Direct Bank Transfer', description: 'National & Commercial Banks', isActive: true, createdAt: '2026-01-01T00:00:00.000Z' }
];

const DEFAULT_METHODS: PaymentMethod[] = [
  {
    id: 'method_esewa',
    categoryId: 'cat_wallets',
    name: 'eSewa',
    type: 'Wallet',
    qrUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=eSewa-Deposit-NexPlay',
    instructions: 'Send payment to eSewa ID: 9800000000 (NexPlay Official). Copy the transaction ID and upload payment screenshot.',
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'method_khalti',
    categoryId: 'cat_wallets',
    name: 'Khalti',
    type: 'Wallet',
    qrUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=Khalti-Deposit-NexPlay',
    instructions: 'Send payment to Khalti ID: 9800000000 (NexPlay Official). Enter transaction code and attach receipt screenshot.',
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'method_fonepay',
    categoryId: 'cat_banking',
    name: 'FonePay QR',
    type: 'QR',
    qrUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=FonePay-NexPlay-Official',
    instructions: 'Scan FonePay QR using any Banking App. Enter Transaction Ref and attach confirmation screenshot.',
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'method_bank',
    categoryId: 'cat_bank',
    name: 'Bank Transfer',
    type: 'Bank',
    qrUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=Bank-NexPlay-Official',
    instructions: 'Transfer to Global IME / Nabil Bank. A/C: 0123456789 (NexPlay Org). Attach transfer slip screenshot.',
    isActive: true,
    createdAt: new Date().toISOString()
  }
];

const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose, initialTab = 'deposit' }) => {
  const { user, profile } = useAuth();
  const { showToast } = useNotification();
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>(initialTab);
  const [paymentCategories, setPaymentCategories] = useState<PaymentCategory[]>(DEFAULT_CATEGORIES);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(DEFAULT_METHODS);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Deposit State
  const [selectedCategory, setSelectedCategory] = useState<PaymentCategory | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [senderNumber, setSenderNumber] = useState('');
  const [transactionCode, setTransactionCode] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [proofPreview, setProofPreview] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Withdrawal State
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState('');
  const [accountDetails, setAccountDetails] = useState('');

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      fetchData();
    }
  }, [isOpen, initialTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const catSnap = await getDocs(query(
        collection(db, 'paymentCategories'),
        where('isActive', '==', true)
      ));
      const loadedCats = catSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentCategory));
      setPaymentCategories(loadedCats.length > 0 ? loadedCats : DEFAULT_CATEGORIES);

      const paySnap = await getDocs(query(
        collection(db, 'paymentMethods'),
        where('isActive', '==', true)
      ));
      const loadedMethods = paySnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentMethod));
      setPaymentMethods(loadedMethods.length > 0 ? loadedMethods : DEFAULT_METHODS);

      const settingsSnap = await getDoc(doc(db, 'settings', 'site'));
      if (settingsSnap.exists()) {
        setSettings(settingsSnap.data() as SiteSettings);
      }
    } catch (error) {
      console.warn('Using fallback payment options:', error);
      setPaymentCategories(DEFAULT_CATEGORIES);
      setPaymentMethods(DEFAULT_METHODS);
    } finally {
      setLoading(false);
    }
  };

  const handleScreenshotUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      showToast('Image must be under 15MB', 'error');
      return;
    }

    setIsUploading(true);
    try {
      // 1. Instant local preview
      const previewUrl = URL.createObjectURL(file);
      setProofPreview(previewUrl);

      // 2. Upload directly to ImgBB via mediaService
      const res = await uploadImage(file, MediaCategory.PAYMENT_PROOF);
      if (res && res.success && res.url) {
        setProofUrl(res.url);
        setProofPreview(res.url);
        showToast('Payment screenshot attached successfully', 'success');
      } else {
        showToast(res?.error || 'Failed to upload screenshot to ImgBB', 'error');
      }
    } catch (error: any) {
      console.error('Screenshot upload error:', error);
      showToast('Failed to attach screenshot. Please try again.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDepositSubmit = async () => {
    if (!user) {
      return showToast('You must be signed in to submit a deposit', 'error');
    }
    if (!selectedMethod) {
      return showToast('Please select a payment method', 'error');
    }
    if (!depositAmount) {
      return showToast('Please enter deposit amount', 'error');
    }
    if (!senderNumber) {
      return showToast('Please enter your sender mobile/account number', 'error');
    }
    if (!transactionCode) {
      return showToast('Please enter the transaction reference code or name', 'error');
    }
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) return showToast('Please enter a valid amount greater than 0', 'error');

    setIsSubmitting(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        showToast('Authentication required — please sign in again', 'error');
        return;
      }

      const res = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          amount,
          method: selectedMethod.name || 'Digital Wallet',
          senderNumber: senderNumber.trim(),
          transactionCode: transactionCode.trim(),
          proofUrl: proofUrl || '',
        }),
      });

      const data = await res.json().catch(() => ({ success: false, message: 'Server response could not be parsed' }));
      if (!res.ok || !data.success) {
        showToast(data.message || 'Failed to submit deposit', 'error');
        return;
      }

      showToast('Deposit request submitted! Admin will verify and credit your balance.', 'success');
      // Reset form
      setDepositAmount('');
      setSenderNumber('');
      setTransactionCode('');
      setProofUrl('');
      setProofPreview('');
      setSelectedMethod(null);
      setSelectedCategory(null);
      onClose();
    } catch (error: any) {
      console.error('Error submitting deposit:', error);
      showToast(error.message || 'Failed to submit deposit request', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdrawSubmit = async () => {
    if (!user || !withdrawAmount || !withdrawMethod || !accountDetails) {
      return showToast('Please fill all fields', 'error');
    }

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) return showToast('Invalid amount', 'error');
    if (settings?.minWithdrawal && amount < settings.minWithdrawal) {
      return showToast(`Minimum withdrawal amount is ${formatCurrency(settings.minWithdrawal)}`, 'error');
    }
    const totalAvailable = (profile?.balance || 0) + (profile?.orgWalletBalance || 0);
    if (amount > totalAvailable) return showToast('Insufficient balance', 'error');

    setIsSubmitting(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        showToast('Authentication required', 'error');
        return;
      }

      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          amount,
          method: withdrawMethod,
          accountDetails,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.message || 'Failed to withdraw', 'error');
        return;
      }

      showToast('Withdrawal request submitted!', 'success');
      setWithdrawAmount('');
      setWithdrawMethod('');
      setAccountDetails('');
      onClose();
    } catch (error) {
      // Error submitting withdrawal
      showToast('Failed to submit withdrawal request', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}></div>
      <div className="relative w-full sm:max-w-lg bg-card rounded-t-3xl sm:rounded-3xl border border-gray-800 shadow-2xl overflow-hidden animate-slide-up sm:animate-scale-in max-h-[90vh] flex flex-col">
        <div className="p-4 sm:p-6 border-b border-gray-800 flex justify-between items-center bg-gradient-to-r from-gray-900 to-black shrink-0">
          <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-brand-500" /> {activeTab === 'deposit' ? 'Deposit Funds' : 'Withdraw Funds'}
          </h2>
          <button type="button" onClick={onClose} className="p-2.5 hover:bg-surface rounded-full transition text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-grow">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center">
              <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Loading options...</p>
            </div>
          ) : activeTab === 'deposit' ? (
            <div className="space-y-6">
              {!selectedCategory ? (
                <div className="grid grid-cols-1 gap-3">
                  <h3 className="text-xs text-gray-400 uppercase font-bold mb-2">Select Payment Category</h3>
                  {paymentCategories.map(cat => (
                    <button type="button" 
                      key={cat.id} 
                      onClick={() => setSelectedCategory(cat)}
                      className="flex items-center justify-between p-4 bg-card rounded-xl border border-gray-800 hover:border-brand-500 transition group"
                    >
                      <div className="text-left">
                        <div className="font-bold text-white group-hover:text-brand-400 transition">{cat.name}</div>
                        <div className="text-[10px] text-gray-500 uppercase font-black mt-1">{cat.description}</div>
                      </div>
                      <ArrowDown className="w-4 h-4 text-gray-600 group-hover:text-brand-500 transition -rotate-90" />
                    </button>
                  ))}
                </div>
              ) : !selectedMethod ? (
                <div className="space-y-6 animate-fade-in">
                  <button type="button" onClick={() => setSelectedCategory(null)} className="text-brand-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 hover:underline">
                    <X className="w-3 h-3" /> Back to Categories
                  </button>
                  <h3 className="text-xs text-gray-400 uppercase font-bold mb-2">Select {selectedCategory.name} Method</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {paymentMethods.filter(pm => pm.categoryId === selectedCategory.id).map(pm => (
                      <button type="button" 
                        key={pm.id} 
                        onClick={() => setSelectedMethod(pm)}
                        className="flex items-center justify-between p-4 bg-card rounded-xl border border-gray-800 hover:border-brand-500 transition group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-dark rounded-lg flex items-center justify-center border border-gray-700">
                            <img src={pm.qrUrl || undefined} className="w-8 h-8 object-contain" alt={pm.name} loading="lazy" />
                          </div>
                          <div className="text-left">
                            <div className="font-bold text-white group-hover:text-brand-400 transition">{pm.name}</div>
                            <div className="text-[10px] text-gray-500 uppercase font-black">{pm.type}</div>
                          </div>
                        </div>
                        <ArrowDown className="w-4 h-4 text-gray-600 group-hover:text-brand-500 transition" />
                      </button>
                    ))}
                    {paymentMethods.filter(pm => pm.categoryId === selectedCategory.id).length === 0 && (
                        <div className="text-center py-8 text-gray-500 text-sm">No payment methods available in this category.</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-6 animate-fade-in">
                  <button type="button" onClick={() => setSelectedMethod(null)} className="text-brand-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 hover:underline">
                    <X className="w-3 h-3" /> Change Method
                  </button>
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-40 h-40 bg-white p-2 rounded-xl">
                      <img src={selectedMethod.qrUrl || undefined} className="w-full h-full object-contain" alt="QR" loading="lazy" />
                    </div>
                    <div className="bg-dark p-4 rounded-xl border border-gray-800 w-full">
                      <p className="text-[10px] text-gray-500 uppercase font-black mb-2">Instructions</p>
                      <p className="text-xs text-gray-300 leading-relaxed">{selectedMethod.instructions}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <input 
                      type="number" 
                      aria-label="Amount in rupees"
                      placeholder="Amount (Rs.)"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 focus-visible:outline-none font-bold"
                    />
                    <input 
                      type="text" 
                      aria-label="Sender Number"
                      placeholder="Sender Number"
                      value={senderNumber}
                      onChange={(e) => setSenderNumber(e.target.value)}
                      className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 focus-visible:outline-none font-bold"
                    />
                    <input 
                      type="text" 
                      aria-label="Transaction Code or Name"
                      placeholder="Transaction Code / Name"
                      value={transactionCode}
                      onChange={(e) => setTransactionCode(e.target.value)}
                      className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 focus-visible:outline-none font-bold"
                    />
                    
                    {/* Screenshot Upload */}
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase font-black mb-2 block">Payment Screenshot (Required)</label>
                      {proofPreview ? (
                        <div className="relative">
                          <img src={proofPreview} alt="Payment screenshot" className="w-full max-h-48 object-contain rounded-xl border border-gray-700" loading="lazy" />
                          <button type="button" 
                            onClick={() => { setProofPreview(''); setProofUrl(''); }}
                            className="absolute top-2 right-2 bg-black/80 rounded-full p-1 text-white hover:bg-red-500 transition"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => !isUploading && fileInputRef.current?.click()}
                          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const file = e.dataTransfer.files?.[0];
                            if (file) handleScreenshotUpload(file);
                          }}
                          onPaste={(e) => {
                            const items = e.clipboardData?.items;
                            if (!items) return;
                            for (const item of items) {
                              if (item.type.startsWith('image/')) {
                                const file = item.getAsFile();
                                if (file) handleScreenshotUpload(file);
                                break;
                              }
                            }
                          }}
                          tabIndex={0}
                          className="w-full bg-dark border-2 border-dashed border-gray-700 rounded-xl py-8 flex flex-col items-center gap-3 hover:border-brand-500 transition group cursor-pointer focus:focus-visible:outline-none focus:border-brand-500"
                        >
                          {isUploading ? (
                            <>
                              <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                              <p className="text-xs text-gray-500">Uploading...</p>
                            </>
                          ) : (
                            <>
                              <div className="w-12 h-12 bg-surface rounded-full flex items-center justify-center group-hover:bg-brand-500/10 transition">
                                <Upload className="w-5 h-5 text-gray-500 group-hover:text-brand-500" />
                              </div>
                              <p className="text-xs text-gray-400 font-medium">Upload payment screenshot</p>
                              <p className="text-[10px] text-gray-600">Click, drag-and-drop, or paste — JPG, PNG, WEBP max 5MB</p>
                            </>
                          )}
                        </div>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleScreenshotUpload(file);
                          e.target.value = '';
                        }}
                      />
                    </div>

                    <button type="button" 
                      onClick={handleDepositSubmit}
                      disabled={isSubmitting || isUploading}
                      className="w-full bg-brand-600 hover:bg-brand-500 text-white py-4 rounded-xl font-black uppercase tracking-widest transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? 'Processing...' : 'Submit Deposit'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-dark p-4 rounded-xl border border-gray-800 text-center">
                <p className="text-[10px] text-gray-500 uppercase font-black mb-1">Available Balance</p>
                <p className="text-2xl font-black text-brand-400">{formatCurrency((profile?.balance || 0) + (profile?.orgWalletBalance || 0))}</p>
              </div>
              <div className="space-y-4">
                <input 
                  type="number" 
                  aria-label="Withdraw Amount"
                  placeholder="Withdraw Amount"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 focus-visible:outline-none font-bold"
                />
                <select 
                  value={withdrawMethod}
                  aria-label="Withdraw Method"
                  onChange={(e) => setWithdrawMethod(e.target.value)}
                  className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 focus-visible:outline-none font-bold"
                >
                  <option value="">Select Method</option>
                  {paymentMethods.map(pm => (
                    <option key={pm.id} value={pm.name}>{pm.name}</option>
                  ))}
                </select>
                <textarea 
                  aria-label="Account Details"
                  placeholder="Account Details (ID, Name, etc.)"
                  value={accountDetails}
                  onChange={(e) => setAccountDetails(e.target.value)}
                  className="w-full bg-dark border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-brand-500 focus-visible:outline-none font-bold h-24 resize-none"
                />
                <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-xl flex gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
                  <p className="text-[10px] text-yellow-200 uppercase font-black leading-tight">Processed within 24-48 hours. Ensure details are correct.</p>
                </div>
                <button type="button" 
                  onClick={handleWithdrawSubmit}
                  disabled={isSubmitting}
                  className="w-full bg-brand-600 hover:bg-brand-500 text-white py-4 rounded-xl font-black uppercase tracking-widest transition shadow-lg disabled:opacity-50"
                >
                  {isSubmitting ? 'Processing...' : 'Request Withdrawal'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WalletModal;
