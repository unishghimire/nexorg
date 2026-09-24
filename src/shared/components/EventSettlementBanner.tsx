import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  ShieldAlert,
  Coins,
  FileCheck2,
  Lock,
  Unlock,
  ChevronDown,
  ChevronUp,
  History,
  Info,
} from 'lucide-react';
import {
  getResultDeadlineRemaining,
  calculatePenaltyDetails,
  DEFAULT_FREE_LOCK_AMOUNT,
  DeadlineRemaining,
} from '../services/eventSettlementService';
import { formatDate } from '../utils/utils';

export interface EventSettlementBannerProps {
  event: any;
  eventType: 'tournament' | 'scrim';
  onOpenResultModal?: () => void;
  onDepositLockAmount?: () => void;
  isAdmin?: boolean;
  isHost?: boolean;
}

export const EventSettlementBanner: React.FC<EventSettlementBannerProps> = ({
  event,
  eventType,
  onOpenResultModal,
  onDepositLockAmount,
  isAdmin = false,
  isHost = false,
}) => {
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [remaining, setRemaining] = useState<DeadlineRemaining>(() =>
    getResultDeadlineRemaining(event)
  );

  // Live timer tick every 1 second
  useEffect(() => {
    if (event?.status !== 'completed' || event?.resultStatus === 'published') return;

    const timer = setInterval(() => {
      setRemaining(getResultDeadlineRemaining(event));
    }, 1000);

    return () => clearInterval(timer);
  }, [event?.status, event?.completedAt, event?.resultDeadlineAt, event?.resultStatus]);

  if (!event) return null;

  const entryFee = Math.max(0, Number(event.entryFee || event.requirements?.entryFee || 0));
  const isPaid = entryFee > 0;
  const isFree = !isPaid;
  const prizePool = Math.max(0, Number(event.prizePool || 0));

  const isCompleted = event.status === 'completed';
  const isResultPublished = event.resultStatus === 'published' || event.resultStatus === 'verified';
  const isPenaltyApplied = event.penaltyApplied === true;

  const penaltyInfo = useMemo(() => calculatePenaltyDetails(event), [event]);

  // Expected profit calculation (Rs. 0 for Free Events)
  const filledSlots = Array.isArray(event.slots)
    ? event.slots.filter((s: any) => s.status === 'filled' || s.teamName).length
    : Number(event.filledSlots || event.currentPlayers || 0);

  const collectedFees = isPaid ? filledSlots * entryFee : 0;
  const rawProfit = isPaid ? Math.max(0, collectedFees - prizePool) : 0;
  const expectedProfit = isPaid ? Math.round(rawProfit * 0.85) : 0; // 85% host share

  const lockAmount = Math.max(0, Number(event.lockAmount || DEFAULT_FREE_LOCK_AMOUNT));
  const lockDeposited = event.lockAmountDeposited === true && event.lockAmountStatus === 'deposited';
  const lockRefunded = event.lockAmountStatus === 'refunded';

  const auditLogs = Array.isArray(event.settlementAuditLog) ? event.settlementAuditLog : [];

  return (
    <div className="my-5 rounded-2xl border border-gray-800 bg-gradient-to-br from-card via-dark to-surface/80 p-5 shadow-2xl overflow-hidden relative">
      {/* Background ambient glow */}
      {isPenaltyApplied ? (
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
      ) : remaining.isWarning && !isResultPublished ? (
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      ) : (
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
      )}

      {/* Top Header Row: Event Type & Dynamic Status Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800/80 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Event Category Badge */}
          <span
            className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
              isPaid
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
            }`}
          >
            {isPaid
              ? `💰 Paid ${eventType === 'scrim' ? 'Scrim' : 'Tournament'}`
              : `🎯 Free ${eventType === 'scrim' ? 'Scrim' : 'Tournament'}`}
          </span>

          {/* Result Status Badge */}
          {isResultPublished ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-3.5 h-3.5" /> Results Published
            </span>
          ) : isCompleted ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse">
              <Clock className="w-3.5 h-3.5" /> Result Pending
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/30">
              <Clock className="w-3.5 h-3.5" /> Active Match
            </span>
          )}

          {/* 48-Hour Deadline Badge */}
          {isCompleted && !isResultPublished && (
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                remaining.isExpired || isPenaltyApplied
                  ? 'bg-red-500/20 text-red-300 border-red-500/40'
                  : remaining.isWarning
                  ? 'bg-orange-500/20 text-orange-300 border-orange-500/40 animate-pulse'
                  : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              {remaining.isExpired || isPenaltyApplied
                ? 'Deadline Expired'
                : `48h Deadline: ${remaining.formatted}`}
            </span>
          )}

          {/* Settlement Badge */}
          {event.settlementStatus === 'settled' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
              <CheckCircle2 className="w-3.5 h-3.5" /> Settlement Complete
            </span>
          )}
        </div>

        {/* Action Button: Publish Results */}
        {onOpenResultModal && isCompleted && !isResultPublished && (
          <button
            type="button"
            onClick={onOpenResultModal}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-brand-500/25 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
          >
            <FileCheck2 className="w-4 h-4" />
            <span>Publish Official Results</span>
          </button>
        )}
      </div>

      {/* 48-Hour Deadline Warning / Alert Section */}
      {isCompleted && !isResultPublished && (
        <div
          className={`mt-4 rounded-xl p-4 border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
            remaining.isExpired || isPenaltyApplied
              ? 'bg-red-950/40 border-red-500/40 text-red-200'
              : remaining.isWarning
              ? 'bg-orange-950/40 border-orange-500/40 text-orange-200'
              : 'bg-indigo-950/30 border-indigo-500/30 text-indigo-200'
          }`}
        >
          <div className="flex items-start gap-3">
            {remaining.isExpired || isPenaltyApplied ? (
              <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider">
                {isPenaltyApplied
                  ? `10% Result Deadline Penalty Applied (Rs. ${Number(event.penaltyAmount || penaltyInfo.penaltyAmount).toLocaleString()})`
                  : remaining.isExpired
                  ? '48-Hour Result Deadline Has Expired'
                  : `48-Hour Result Deadline Active — ${remaining.formatted} Remaining`}
              </h4>
              <p className="text-[11px] opacity-80 mt-0.5 leading-relaxed">
                {isPenaltyApplied
                  ? `A 10% penalty of Rs. ${Number(event.penaltyAmount || penaltyInfo.penaltyAmount).toLocaleString()} was charged from organizer wallet for exceeding the 48-hour result deadline.`
                  : isPaid
                  ? `Official match results must be published within 48 hours of match completion. If missed, an automatic 10% penalty (${penaltyInfo.penaltyBaseDescription} = Rs. ${penaltyInfo.penaltyAmount.toLocaleString()}) will be charged.`
                  : `Free events require official results within 48 hours. If missed, 10% of the security lock deposit (Rs. ${penaltyInfo.penaltyAmount.toLocaleString()}) is penalized.`}
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="block text-[10px] uppercase font-bold tracking-widest opacity-70">
              Deadline Expiry
            </span>
            <span className="font-mono text-xs font-black">
              {event.resultDeadlineAt ? formatDate(event.resultDeadlineAt) : 'Within 48h'}
            </span>
          </div>
        </div>
      )}

      {/* Grid: Financial & Lock Telemetry Cards */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Card 1: Prize Pool */}
        <div className="rounded-xl border border-gray-800 bg-surface/50 p-3">
          <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1">
            Total Prize Pool
          </span>
          <span className="font-mono text-base font-black text-white">
            Rs. {prizePool.toLocaleString()}
          </span>
          <span className="text-[10px] text-gray-500 block mt-1">
            {event.payoutCompleted ? '✓ Distributed to Winners' : 'Locked in Escrow'}
          </span>
        </div>

        {/* Card 2: Organizer Profit or Rs. 0 Free Guarantee */}
        <div className="rounded-xl border border-gray-800 bg-surface/50 p-3">
          <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1">
            Host Profit Share
          </span>
          {isFree ? (
            <div>
              <span className="font-mono text-base font-black text-cyan-400">
                Rs. 0 (Free Event)
              </span>
              <span className="text-[10px] text-cyan-500/80 block mt-1 font-bold">
                Zero Profit Rule
              </span>
            </div>
          ) : (
            <div>
              <span
                className={`font-mono text-base font-black ${
                  event.organizerProfitReleased ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                Rs. {Number(event.organizerProfit ?? expectedProfit).toLocaleString()}
              </span>
              <span className="text-[10px] text-gray-500 block mt-1">
                {event.organizerProfitReleased
                  ? '✓ Released to Wallet'
                  : 'Locked Until Results'}
              </span>
            </div>
          )}
        </div>

        {/* Card 3: Free Event Lock Amount Deposit */}
        <div className="rounded-xl border border-gray-800 bg-surface/50 p-3">
          <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1">
            Security Lock Amount
          </span>
          {isFree ? (
            <div>
              <span className="font-mono text-base font-black text-cyan-300">
                Rs. {lockAmount.toLocaleString()}
              </span>
              <div className="flex items-center gap-1 mt-1">
                {lockRefunded ? (
                  <span className="text-[10px] text-emerald-400 font-bold">✓ Refunded</span>
                ) : lockDeposited ? (
                  <span className="text-[10px] text-cyan-400 font-bold">✓ Deposited</span>
                ) : (
                  <span className="text-[10px] text-amber-400 font-bold">Pending Deposit</span>
                )}
              </div>
            </div>
          ) : (
            <div>
              <span className="font-mono text-base font-black text-gray-500">
                N/A (Paid Event)
              </span>
              <span className="text-[10px] text-gray-500 block mt-1">
                Funded by entry fees
              </span>
            </div>
          )}
        </div>

        {/* Card 4: 10% Penalty Telemetry */}
        <div
          className={`rounded-xl border p-3 ${
            isPenaltyApplied
              ? 'border-red-500/40 bg-red-950/20'
              : 'border-gray-800 bg-surface/50'
          }`}
        >
          <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1">
            48h Penalty Status
          </span>
          {isPenaltyApplied ? (
            <div>
              <span className="font-mono text-base font-black text-red-400">
                -Rs. {Number(event.penaltyAmount || penaltyInfo.penaltyAmount).toLocaleString()}
              </span>
              <span className="text-[10px] text-red-400/80 block mt-1 font-bold">
                10% Penalty Applied
              </span>
            </div>
          ) : isResultPublished ? (
            <div>
              <span className="font-mono text-base font-black text-emerald-400">
                None (On-Time)
              </span>
              <span className="text-[10px] text-emerald-500/80 block mt-1">
                Met 48h deadline
              </span>
            </div>
          ) : (
            <div>
              <span className="font-mono text-base font-black text-gray-300">
                Rs. {penaltyInfo.penaltyAmount.toLocaleString()} (10%)
              </span>
              <span className="text-[10px] text-amber-500 block mt-1">
                At risk if &gt; 48h
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Free Event Lock Deposit Call to Action (if needed) */}
      {isFree && !lockDeposited && !lockRefunded && onDepositLockAmount && isHost && (
        <div className="mt-3 bg-cyan-950/30 border border-cyan-500/30 rounded-xl p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-xs text-cyan-200">
              Free events require an organizer security lock deposit of Rs. {lockAmount.toLocaleString()} before starting.
            </span>
          </div>
          <button
            type="button"
            onClick={onDepositLockAmount}
            className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-dark font-black text-xs uppercase tracking-wider shadow active:scale-95 transition-all shrink-0 cursor-pointer"
          >
            Deposit Lock
          </button>
        </div>
      )}

      {/* Collapsible Settlement Audit Trail */}
      {auditLogs.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-800">
          <button
            type="button"
            onClick={() => setShowAuditLog(!showAuditLog)}
            className="flex items-center justify-between w-full text-xs font-black uppercase tracking-wider text-gray-400 hover:text-white transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-brand-400" />
              Settlement & Audit Trail ({auditLogs.length} events)
            </span>
            {showAuditLog ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showAuditLog && (
            <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
              {auditLogs.map((log: any, idx: number) => (
                <div
                  key={idx}
                  className="rounded-lg bg-black/40 border border-gray-800 p-2.5 text-xs flex items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-white text-[11px] uppercase tracking-wide">
                        {log.action}
                      </span>
                      <span className="text-[10px] text-gray-500 font-mono">
                        by {log.actorName || log.actorUid}
                      </span>
                    </div>
                    {log.reason && (
                      <p className="text-[11px] text-gray-400">{log.reason}</p>
                    )}
                    {log.details && (
                      <p className="text-[11px] text-gray-400">{log.details}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-500 font-mono whitespace-nowrap">
                    {formatDate(log.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EventSettlementBanner;
