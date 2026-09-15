import React, { useState } from 'react';
import { collection, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../shared/config/firebase';
import { useAuth } from '../../../shared/context/AuthContext';
import { useNotification } from '../../../shared/context/NotificationContext';
import Modal from '../../../shared/components/Modal';
import { Trophy, Zap, CheckCircle2, ShieldCheck, Send, AlertTriangle, ExternalLink } from 'lucide-react';

interface PowerOrgApplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  completedScrimsCount: number;
  onSuccess?: () => void;
}

export const PowerOrgApplyModal: React.FC<PowerOrgApplyModalProps> = ({
  isOpen,
  onClose,
  completedScrimsCount,
  onSuccess,
}) => {
  const { user, profile } = useAuth();
  const { showToast } = useNotification();
  const [submitting, setSubmitting] = useState(false);
  const [communityLink, setCommunityLink] = useState(profile?.discord || profile?.youtube || '');
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp || profile?.phone || '');
  const [notes, setNotes] = useState('');

  const isEligible = completedScrimsCount >= 20;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showToast('You must be signed in to apply', 'error');
      return;
    }

    if (!isEligible) {
      showToast(`Requirement not met: You need at least 20 completed authentic scrims to apply (currently: ${completedScrimsCount}).`, 'error');
      return;
    }

    setSubmitting(true);
    try {
      const appRef = doc(collection(db, 'power_org_applications'));
      const appData = {
        id: appRef.id,
        userId: user.uid,
        username: profile?.username || 'Organizer',
        orgName: profile?.orgName || profile?.username || 'Organization',
        email: user.email || profile?.email || '',
        phone: profile?.phone || '',
        whatsapp: whatsapp.trim() || profile?.whatsapp || '',
        communityLink: communityLink.trim(),
        completedScrimsCount,
        notes: notes.trim(),
        status: 'pending',
        appliedAt: serverTimestamp(),
      };

      await setDoc(appRef, appData);

      // Update user doc application state
      await updateDoc(doc(db, 'users', user.uid), {
        powerOrgApplicationStatus: 'pending',
        powerOrgAppliedAt: serverTimestamp(),
        completedScrimsCount,
        updatedAt: serverTimestamp(),
      });

      showToast(
        'Power Organizer application submitted successfully! Our Admin team will verify your completed scrims and activate your status.',
        'success'
      );

      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('Error submitting power org application:', err);
      showToast(err.message || 'Failed to submit application', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Apply for Power Organizer Status">
      <form onSubmit={handleSubmit} className="space-y-5 text-sm">
        {/* Header Pitch */}
        <div className="bg-gradient-to-br from-amber-500/15 via-brand-500/10 to-dark p-4 rounded-2xl border border-amber-500/30 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-400">
              <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
              Tournament Hosting Privileges
            </span>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Criteria Met
            </span>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed">
            Power Organizers can create and manage official multi-round tournaments, brackets, and full prize distributions. Standard Organizers are dedicated to running free, paid, and per-kill scrims.
          </p>
        </div>

        {/* Milestone Verification Card */}
        <div className="bg-dark/70 border border-gray-800 p-4 rounded-xl space-y-3">
          <div className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-brand-400" />
            Verified Authentic Scrims Milestone
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-black/50 p-3 rounded-lg border border-white/5">
              <div className="text-[10px] text-gray-500 uppercase font-black">Completed Scrims</div>
              <div className="text-xl font-black text-emerald-400 font-mono mt-0.5">
                {completedScrimsCount} <span className="text-xs text-gray-500">/ 20</span>
              </div>
            </div>
            <div className="bg-black/50 p-3 rounded-lg border border-white/5">
              <div className="text-[10px] text-gray-500 uppercase font-black">Requirement Status</div>
              <div className="text-xs font-black text-emerald-400 uppercase mt-2 flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> 100% Eligible
              </div>
            </div>
          </div>
          <p className="text-[11px] text-gray-400">
            You have successfully hosted and finalized {completedScrimsCount} authentic scrims with verified results.
          </p>
        </div>

        {/* Organization Info */}
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
              Organization Name
            </label>
            <input
              type="text"
              readOnly
              value={profile?.orgName || profile?.username || 'Organization'}
              className="w-full bg-black/60 border border-gray-800 rounded-xl p-3 text-xs text-gray-300 font-bold cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
              WhatsApp / Contact Phone *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. +977 98XXXXXXXX"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className="w-full bg-black border border-gray-800 rounded-xl p-3 text-xs text-white font-medium focus-visible:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
              Community / Social Link (Optional)
            </label>
            <input
              type="url"
              placeholder="https://discord.gg/... or YouTube channel"
              value={communityLink}
              onChange={(e) => setCommunityLink(e.target.value)}
              className="w-full bg-black border border-gray-800 rounded-xl p-3 text-xs text-white font-medium focus-visible:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
              Experience &amp; Tournament Plans (Optional Note for Admin)
            </label>
            <textarea
              rows={3}
              placeholder="Tell our review team about the tournaments you plan to host, your gaming community, or previous esports management experience..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-black border border-gray-800 rounded-xl p-3 text-xs text-white font-medium focus-visible:outline-none focus:border-brand-500"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-dark border border-gray-800 text-gray-300 rounded-xl text-xs font-black uppercase tracking-wider hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !isEligible}
            className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-lg shadow-brand-950/40"
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Send className="w-3.5 h-3.5" /> Submit Power Org Application
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default PowerOrgApplyModal;
