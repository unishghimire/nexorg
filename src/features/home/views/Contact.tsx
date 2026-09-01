import Seo from '../../../shared/components/Seo';
import React, { useState } from 'react';
import { Headset, Mail, Briefcase, MessageCircle, Facebook, Instagram, Music2, Building2, ExternalLink, CheckCircle2, FileText, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../../shared/context/AuthContext';
import { useNotification } from '../../../shared/context/NotificationContext';
import { useSiteSettings } from '../../../shared/context/SiteSettingsContext';
import { db } from '../../../shared/config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const Contact: React.FC = () => {
    const { user, profile } = useAuth();
    const { showToast } = useNotification();
    const { settings } = useSiteSettings();
    const [isApplying, setIsApplying] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    
    const [formData, setFormData] = useState({
        name: '',
        orgName: '',
        whatsapp: '',
        email: '',
        proofLink: '',
        agreed: false
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return showToast('Please login to apply', 'error');
        if (!formData.agreed) return showToast('Please agree to the terms', 'warning');
        
        setSubmitting(true);
        try {
            await addDoc(collection(db, 'orgApplications'), {
                userId: user.uid,
                username: profile?.username || 'Unknown',
                ...formData,
                status: 'pending',
                timestamp: serverTimestamp()
            });
            showToast('Application submitted successfully!', 'success');
            setIsApplying(false);
            setFormData({
                name: '',
                orgName: '',
                whatsapp: '',
                email: '',
                proofLink: '',
                agreed: false
            });
        } catch (error) {
            console.error("Error submitting application:", error);
            showToast('Failed to submit application', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
        <Seo
            title="Contact NexPlay — Esports Platform Nepal"
            description="Get in touch with the NexPlay team for support, partnerships, and esports tournament inquiries in Nepal."
            canonicalPath="/contact"
        />
        <div className="animate-fade-in max-w-4xl mx-auto space-y-8">
            <div className="bg-card p-5 sm:p-8 rounded-2xl border border-gray-800 shadow-2xl">
                <h1 className="text-2xl sm:text-3xl font-black text-white mb-6 border-b border-gray-800 pb-4 flex items-center gap-4">
                    <Headset className="text-brand-500 w-10 h-10" /> Contact Us
                </h1>
                <p className="text-gray-400 mb-8 leading-relaxed">Have a question, found a bug, or want to partner with us? We'd love to hear from you.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <div className="bg-dark/50 p-5 rounded-2xl border border-gray-800 hover:border-brand-500/30 transition-colors group">
                            <h3 className="text-brand-400 font-black text-[10px] uppercase tracking-widest mb-2">Email Support</h3>
                            <a href="mailto:nexplayorg@gmail.com" className="text-white text-lg hover:text-brand-300 transition flex items-center gap-3 font-bold">
                                <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center group-hover:bg-brand-500/20 transition-colors">
                                    <Mail className="w-5 h-5 text-brand-500" />
                                </div>
                                nexplayorg@gmail.com
                            </a>
                        </div>
                        <div className="bg-dark/50 p-5 rounded-2xl border border-gray-800 hover:border-brand-500/30 transition-colors group">
                            <h3 className="text-brand-400 font-black text-[10px] uppercase tracking-widest mb-2">Business Inquiries</h3>
                            <a href="mailto:nex.unishghimire@gmail.com" className="text-white text-lg hover:text-brand-300 transition flex items-center gap-3 font-bold">
                                <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center group-hover:bg-brand-500/20 transition-colors">
                                    <Briefcase className="w-5 h-5 text-brand-500" />
                                </div>
                                next.unishghimire@gmail.com
                            </a>
                        </div>
                    </div>

                    <div className="bg-dark/30 p-6 rounded-2xl border border-gray-800 text-center">
                        <h3 className="text-white font-black uppercase tracking-widest text-xs mb-6">Follow Our Community</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <a href="https://discord.gg/D3M3AqAe5U" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 bg-[#5865F2] hover:bg-[#4752C4] text-white py-3 rounded-xl font-bold transition-colors text-xs">
                                <MessageCircle className="w-4 h-4" /> Discord
                            </a>
                            <a href="https://www.facebook.com/nexplayorg" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 bg-[#1877F2] hover:bg-[#166FE5] text-white py-3 rounded-xl font-bold transition-colors text-xs">
                                <Facebook className="w-4 h-4" /> Facebook
                            </a>
                            <a href="https://www.instagram.com/nexplayorg?igsh=MWd6a2hqa2JqbzBxaw==" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 bg-[#E1306C] hover:bg-[#C13584] text-white py-3 rounded-xl font-bold transition-colors text-xs">
                                <Instagram className="w-4 h-4" /> Instagram
                            </a>
                            <a href="https://wa.me/+9779767783336" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white py-3 rounded-xl font-bold transition-colors text-xs">
                                <MessageCircle className="w-4 h-4" /> WhatsApp
                            </a>
                            <a href="https://www.tiktok.com/@nexplayorg" target="_blank" rel="noopener noreferrer" className="col-span-2 flex items-center justify-center gap-2 bg-black hover:bg-card text-white py-3 rounded-xl font-bold transition-colors text-xs border border-gray-800">
                                <Music2 className="w-4 h-4" /> Follow on TikTok
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            {/* Organization Application Section */}
            {(settings?.isOrgFormOpen ?? true) ? (
                <div className="bg-gradient-to-br from-brand-900/20 to-dark p-5 sm:p-8 rounded-2xl border border-brand-500/20 shadow-2xl relative overflow-hidden group">
                    <div className="absolute -right-20 -top-20 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl group-hover:bg-brand-500/10 transition-colors"></div>
                    
                    <div className="relative z-10">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                            <div className="space-y-2">
                                <h2 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                                    <Building2 className="text-brand-500 w-8 h-8" /> Become an Organizer
                                </h2>
                                <p className="text-gray-400 text-sm max-w-xl">Host your own tournaments, manage participants, and grow your gaming community with NexPlay's professional tools.</p>
                            </div>
                            <button type="button" 
                                onClick={() => setIsApplying(!isApplying)}
                                className={`px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm transition-colors shadow-xl ${
                                    isApplying 
                                    ? 'bg-surface text-gray-400 hover:text-white' 
                                    : 'bg-brand-600 hover:bg-brand-500 text-white shadow-brand-500/20'
                                }`}
                            >
                                {isApplying ? 'Close Form' : 'Apply Now'}
                            </button>
                        </div>

                        {isApplying ? (
                            <form onSubmit={handleSubmit} className="bg-dark/50 p-5 sm:p-8 rounded-2xl sm:rounded-3xl border border-gray-800 space-y-6 animate-slide-up">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest ml-1">Full Name</label>
                                        <input 
                                            required
                                            type="text" 
                                            value={formData.name}
                                            onChange={e => setFormData({...formData, name: e.target.value})}
                                            className="w-full bg-dark border border-gray-800 rounded-xl p-4 text-white focus:border-brand-500 focus-visible:outline-none transition-colors"
                                            placeholder="Your legal name"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest ml-1">Organization Name</label>
                                        <input 
                                            required
                                            type="text" 
                                            value={formData.orgName}
                                            onChange={e => setFormData({...formData, orgName: e.target.value})}
                                            className="w-full bg-dark border border-gray-800 rounded-xl p-4 text-white focus:border-brand-500 focus-visible:outline-none transition-colors"
                                            placeholder="e.g. Elite Gamers Nepal"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest ml-1">WhatsApp Contact</label>
                                        <input 
                                            required
                                            type="tel" 
                                            value={formData.whatsapp}
                                            onChange={e => setFormData({...formData, whatsapp: e.target.value})}
                                            className="w-full bg-dark border border-gray-800 rounded-xl p-4 text-white focus:border-brand-500 focus-visible:outline-none transition-colors"
                                            placeholder="+977 98XXXXXXXX"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest ml-1">Official Email</label>
                                        <input 
                                            required
                                            type="email" 
                                            value={formData.email}
                                            onChange={e => setFormData({...formData, email: e.target.value})}
                                            className="w-full bg-dark border border-gray-800 rounded-xl p-4 text-white focus:border-brand-500 focus-visible:outline-none transition-colors"
                                            placeholder="org@example.com"
                                        />
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                        <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest ml-1 flex items-center gap-2">
                                            Tournament Proof (Google Drive Link) <ExternalLink className="w-3 h-3" />
                                        </label>
                                        <input 
                                            required
                                            type="url" 
                                            value={formData.proofLink}
                                            onChange={e => setFormData({...formData, proofLink: e.target.value})}
                                            className="w-full bg-dark border border-gray-800 rounded-xl p-4 text-white focus:border-brand-500 focus-visible:outline-none transition-colors"
                                            placeholder="Link to screenshots/videos of past tournaments"
                                        />
                                    </div>
                                </div>

                                <div className="bg-brand-500/5 p-6 rounded-2xl border border-brand-500/10 space-y-4">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-brand-500/20 flex items-center justify-center shrink-0">
                                            <FileText className="w-5 h-5 text-brand-500" />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-sm font-bold text-white uppercase tracking-wide">Contract Instructions</h4>
                                            <p className="text-xs text-gray-400 leading-relaxed">
                                                Please download the official partnership contract from the link below, fill it out, and email it to <span className="text-brand-400 font-bold">partnerships.nexplayorg@gmail.com</span> with the subject "ORG APPLICATION - [Your Org Name]".
                                            </p>
                                            <button type="button" onClick={() => window.open("https://discord.com", "_blank")} className="inline-flex items-center gap-2 text-brand-500 hover:text-brand-400 text-[10px] font-black uppercase tracking-widest mt-2">
                                                Download Contract Template <ExternalLink className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 p-2">
                                    <input 
                                        type="checkbox" 
                                        id="agree" 
                                        checked={formData.agreed}
                                        onChange={e => setFormData({...formData, agreed: e.target.checked})}
                                        className="w-5 h-5 rounded border-gray-800 bg-dark text-brand-500 focus:ring-brand-500 accent-brand-500 cursor-pointer"
                                    />
                                    <label htmlFor="agree" className="text-xs text-gray-400 cursor-pointer select-none">
                                        I agree to NexPlay's Organizer Terms of Service and Privacy Policy.
                                    </label>
                                </div>

                                <button 
                                    disabled={submitting}
                                    type="submit" 
                                    className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white py-5 rounded-2xl font-black uppercase tracking-widest transition-colors shadow-xl shadow-brand-500/20 flex items-center justify-center gap-3"
                                >
                                    {submitting ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Submitting...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="w-5 h-5" /> Submit Application
                                        </>
                                    )}
                                </button>
                            </form>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {[
                                    { title: 'Verified Badge', desc: 'Get a blue checkmark on your org profile.' },
                                    { title: 'Fee Management', desc: 'Set entry fees and automated prize pools.' },
                                    { title: 'Analytics', desc: 'Track participant growth and engagement.' }
                                ].map((feature, i) => (
                                    <div key={i} className="bg-dark/30 p-5 rounded-2xl border border-gray-800/50">
                                        <h4 className="text-white font-bold text-sm mb-1">{feature.title}</h4>
                                        <p className="text-gray-500 text-xs">{feature.desc}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-dark/50 p-5 sm:p-8 rounded-2xl border border-gray-800 text-center">
                    <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-white uppercase tracking-widest mb-2">Applications Closed</h3>
                    <p className="text-gray-400 text-sm max-w-md mx-auto">We are not accepting organizer applications at this time. Please check back later.</p>
                </div>
            )}
        </div>
        </>
    );
};

export default Contact;
