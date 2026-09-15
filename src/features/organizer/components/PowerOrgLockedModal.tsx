import React from 'react';
import Modal from '../../../shared/components/Modal';
import { Lock, Zap, CheckCircle2, Gamepad2, ArrowRight, ShieldAlert } from 'lucide-react';

interface PowerOrgLockedModalProps {
  isOpen: boolean;
  onClose: () => void;
  completedScrimsCount: number;
  onApply?: () => void;
  onHostScrim?: () => void;
  applicationStatus?: 'none' | 'pending' | 'approved' | 'rejected';
}

export const PowerOrgLockedModal: React.FC<PowerOrgLockedModalProps> = ({
  isOpen,
  onClose,
  completedScrimsCount,
  onApply,
  onHostScrim,
  applicationStatus = 'none',
}) => {
  const requiredScrims = 20;
  const progressPercent = Math.min(100, Math.round((completedScrimsCount / requiredScrims) * 100));
  const isRequirementMet = completedScrimsCount >= requiredScrims;
  const remaining = Math.max(0, requiredScrims - completedScrimsCount);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Power Organizer Required">
      <div className="space-y-5 text-sm">
        {/* Header Visual */}
        <div className="bg-gradient-to-br from-amber-500/20 via-brand-500/10 to-dark p-5 rounded-2xl border border-amber-500/30 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 mx-auto flex items-center justify-center shadow-lg shadow-amber-500/10">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-white uppercase tracking-wider">
              Tournament Hosting is Locked
            </h3>
            <p className="text-xs text-gray-300 mt-1 max-w-sm mx-auto leading-relaxed">
              Official tournament hosting is exclusive to verified <strong className="text-amber-400 font-bold">Power Organizers</strong>. Standard Organizers can host Free Scrims, Paid Scrims, and Per-Kill Scrims.
            </p>
          </div>
        </div>

        {/* Milestone Progress Box */}
        <div className="bg-dark/80 border border-gray-800 p-4 rounded-xl space-y-3">
          <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider">
            <span className="text-gray-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              Power Org Qualification Progress
            </span>
            <span className={isRequirementMet ? 'text-emerald-400 font-mono' : 'text-amber-400 font-mono'}>
              {completedScrimsCount} / {requiredScrims} Scrims ({progressPercent}%)
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2.5 bg-black/60 rounded-full overflow-hidden border border-white/5 p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isRequirementMet
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-sm shadow-emerald-500/50'
                  : 'bg-gradient-to-r from-brand-500 to-amber-500 shadow-sm shadow-brand-500/40'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="text-[11px] text-gray-400 leading-relaxed">
            {isRequirementMet ? (
              applicationStatus === 'pending' ? (
                <span className="text-amber-300 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Your Power Organizer application has been submitted and is currently pending Admin verification.
                </span>
              ) : (
                <span className="text-emerald-300 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  You have completed the 20 authentic scrims requirement! Submit your application below to unlock Tournament hosting.
                </span>
              )
            ) : (
              <span>
                Host and finalize <strong className="text-white">{remaining} more authentic scrims</strong> with registered teams to unlock the Power Organizer application.
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-dark border border-gray-800 text-gray-300 rounded-xl text-xs font-black uppercase tracking-wider hover:text-white"
          >
            Close
          </button>

          {isRequirementMet && applicationStatus !== 'pending' ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onApply?.();
              }}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-brand-600 hover:from-amber-400 hover:to-brand-500 text-black font-black rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
            >
              <Zap className="w-3.5 h-3.5 fill-black" /> Apply for Power Status <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onClose();
                onHostScrim?.();
              }}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-lg shadow-brand-950/40"
            >
              <Gamepad2 className="w-3.5 h-3.5" /> Host a Scrim Now
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default PowerOrgLockedModal;
