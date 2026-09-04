import React from 'react';
import { Lock, Unlock, ShieldAlert, CheckCircle2, TrendingUp, AlertTriangle } from 'lucide-react';
import { FinancialReadiness } from '../services/prizeDistributionService';

interface FinancialLockBannerProps {
  readiness: FinancialReadiness;
  compact?: boolean;
  className?: string;
}

export const FinancialLockBanner: React.FC<FinancialLockBannerProps> = ({
  readiness,
  compact = false,
  className = '',
}) => {
  // If not a paid event or no prize pool, banner is not strictly needed
  if (!readiness.isPaid && !readiness.isPreFunded) {
    return null;
  }

  const {
    isLocked,
    prizePool,
    entryFee,
    filledSlots,
    minSlotsNeeded,
    collectedFees,
    shortfall,
    slotsRemaining,
    progressPercent,
    isPreFunded,
  } = readiness;

  if (compact) {
    if (isLocked) {
      return (
        <div
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold ${className}`}
          title={`Underfunded: Needs ${slotsRemaining} more slots (Rs. ${shortfall.toLocaleString()} shortfall) to reach Rs. ${prizePool.toLocaleString()} prize pool.`}
        >
          <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>
            Locked: Needs {slotsRemaining} {slotsRemaining === 1 ? 'slot' : 'slots'} (Rs. {collectedFees.toLocaleString()} / Rs. {prizePool.toLocaleString()})
          </span>
        </div>
      );
    }

    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold ${className}`}
      >
        <Unlock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span>
          {isPreFunded
            ? 'Host Escrow Funded'
            : `Fully Funded (Rs. ${collectedFees.toLocaleString()} / Rs. ${prizePool.toLocaleString()})`}
        </span>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div
        className={`relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/40 via-gray-900/90 to-gray-900/90 p-4 sm:p-5 shadow-xl backdrop-blur-md ${className}`}
      >
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 text-amber-400 mt-0.5 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              <Lock className="w-5 h-5 animate-pulse" />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm sm:text-base font-black uppercase tracking-tight text-white flex items-center gap-1.5">
                  Match Locked: Prize Pool Balance Required
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {progressPercent}% Funded
                </span>
              </div>

              <p className="text-xs text-gray-300 mt-1 max-w-2xl leading-relaxed">
                Paid tournaments and scrims cannot begin until player registrations collect sufficient entry fees to cover the total prize pool.
              </p>

              {/* Progress & Slots Metric */}
              <div className="mt-3.5 space-y-2">
                <div className="flex flex-wrap items-center justify-between text-xs font-semibold gap-2">
                  <span className="text-amber-400">
                    Collected: <strong className="text-white">Rs. {collectedFees.toLocaleString()}</strong> / Rs. {prizePool.toLocaleString()}
                  </span>
                  <span className="text-gray-400">
                    Slots: <strong className="text-white">{filledSlots} / {minSlotsNeeded}</strong> required filled
                  </span>
                </div>

                <div className="w-full h-2.5 bg-gray-800/80 rounded-full overflow-hidden border border-gray-700/50 p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-500 shadow-[0_0_12px_rgba(245,158,11,0.5)]"
                    style={{ width: `${Math.max(4, Math.min(100, progressPercent))}%` }}
                  />
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-amber-300/90 font-medium pt-0.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                  <span>
                    <strong>{slotsRemaining} more registered {slotsRemaining === 1 ? 'slot' : 'slots'}</strong> needed to reach starting balance (Shortfall: Rs. {shortfall.toLocaleString()} @ Rs. {entryFee.toLocaleString()}/slot).
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Ready / Funded State
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/30 via-gray-900/90 to-gray-900/90 p-4 sm:p-5 shadow-xl backdrop-blur-md ${className}`}
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
            <Unlock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm sm:text-base font-black uppercase tracking-tight text-white">
                Match Financially Ready
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> 100% Funded
              </span>
            </div>
            <p className="text-xs text-gray-300 mt-0.5">
              {isPreFunded
                ? `Total prize pool of Rs. ${prizePool.toLocaleString()} is guaranteed by organizer escrow. Match is authorized to start.`
                : `Total balance fulfilled! Rs. ${collectedFees.toLocaleString()} collected across ${filledSlots} slots. Match is authorized to start.`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
