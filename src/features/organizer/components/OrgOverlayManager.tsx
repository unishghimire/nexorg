import React from 'react';
import { Trash2, Radio, ShieldAlert } from 'lucide-react';
import Modal from '../../../shared/components/Modal';

export type OverlayType =
  | 'CREATE_TOURNAMENT'
  | 'SCRIM_SLOTS'
  | 'ROOM_DISPATCH'
  | 'DISPUTE_RESOLVER'
  | 'TEAM_WARNING'
  | 'DELETE_CONFIRM'
  | null;

interface OrgOverlayManagerProps {
  activeOverlay: OverlayType;
  onClose: () => void;
  // Delete confirm
  deleteTarget?: string;
  isDeleting?: boolean;
  onConfirmDelete?: () => void;
  // Team warning
  teamName?: string | null;
  warningReason?: string;
  setWarningReason?: (v: string) => void;
  onIssueWarning?: () => void;
  // Room dispatch
  roomId?: string;
  setRoomId?: (v: string) => void;
  roomPass?: string;
  setRoomPass?: (v: string) => void;
  streamUrl?: string;
  setStreamUrl?: (v: string) => void;
  onBroadcastRoom?: () => void;
  // Dispute resolver
  disputeId?: string;
  onResolveDispute?: (action: 'warn' | 'ban' | 'dismiss') => void;
  // Scrim slots
  scrimTitle?: string;
  slotGrid?: { slotNumber: number; teamName: string | null; status: string }[];
  onToggleSlot?: (slotNumber: number) => void;
}

export const OrgOverlayManager: React.FC<OrgOverlayManagerProps> = ({
  activeOverlay,
  onClose,
  deleteTarget,
  isDeleting,
  onConfirmDelete,
  teamName,
  warningReason,
  setWarningReason,
  onIssueWarning,
  roomId,
  setRoomId,
  roomPass,
  setRoomPass,
  streamUrl,
  setStreamUrl,
  onBroadcastRoom,
  disputeId,
  onResolveDispute,
  scrimTitle,
  slotGrid,
  onToggleSlot,
}) => {
  return (
    <>
      {/* DELETE CONFIRM */}
      {activeOverlay === 'DELETE_CONFIRM' && (
        <Modal isOpen onClose={onClose} title="Delete Tournament">
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <p className="text-sm text-gray-400 mb-6">
              Permanently delete <span className="text-white font-bold">"{deleteTarget}"</span>? All match data, registrations, and brackets will be removed.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} disabled={isDeleting} className="flex-1 bg-card hover:bg-surface text-white py-3 rounded-lg font-medium text-sm border border-gray-800 transition-colors min-h-[44px]">
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirmDelete}
                disabled={isDeleting}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white py-3 rounded-lg font-medium text-sm transition-colors min-h-[44px] flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* TEAM WARNING */}
      {activeOverlay === 'TEAM_WARNING' && (
        <Modal isOpen onClose={onClose} title="Issue Disciplinary Warning">
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-400">
              Issuing a warning against <span className="text-white font-bold">{teamName}</span>. This will be logged to the team's disciplinary record.
            </p>
            <div>
              <label className="block text-xs text-gray-500 font-medium uppercase tracking-wider mb-2">Violation Description</label>
              <textarea
                value={warningReason}
                onChange={e => setWarningReason?.(e.target.value)}
                rows={3}
                placeholder="e.g. Failed to submit match screenshot within 15-minute grace period."
                className="w-full bg-black border border-gray-800 rounded-lg p-3 text-sm text-white focus-visible:outline-none focus:border-brand-500"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 bg-card hover:bg-surface text-white py-3 rounded-lg font-medium text-sm border border-gray-800 transition-colors min-h-[44px]">
                Cancel
              </button>
              <button type="button" onClick={onIssueWarning} className="flex-1 bg-amber-600 hover:bg-amber-500 text-white py-3 rounded-lg font-medium text-sm transition-colors min-h-[44px]">
                Issue Warning
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ROOM DISPATCH */}
      {activeOverlay === 'ROOM_DISPATCH' && (
        <Modal isOpen onClose={onClose} title="Broadcast Room Credentials">
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-400">
              These credentials will be pushed to all registered players instantly via notification.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 font-medium uppercase tracking-wider mb-2">Room ID</label>
                <input
                  type="text"
                  value={roomId}
                  onChange={e => setRoomId?.(e.target.value)}
                  placeholder="e.g. 5240212"
                  className="w-full bg-black border border-gray-800 rounded-lg p-3 text-sm text-white focus-visible:outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 font-medium uppercase tracking-wider mb-2">Room Password</label>
                <input
                  type="text"
                  value={roomPass}
                  onChange={e => setRoomPass?.(e.target.value)}
                  placeholder="e.g. ffpro2026"
                  className="w-full bg-black border border-gray-800 rounded-lg p-3 text-sm text-white focus-visible:outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 font-medium uppercase tracking-wider mb-2">Stream Link (Optional)</label>
                <input
                  type="text"
                  value={streamUrl}
                  onChange={e => setStreamUrl?.(e.target.value)}
                  placeholder="https://youtube.com/live/..."
                  className="w-full bg-black border border-gray-800 rounded-lg p-3 text-sm text-white focus-visible:outline-none focus:border-brand-500"
                />
              </div>
            </div>
            <button
              onClick={onBroadcastRoom}
              className="w-full bg-brand-500 hover:bg-brand-400 text-white py-3 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 min-h-[44px]"
            >
              <Radio className="w-4 h-4" /> Broadcast to Players
            </button>
          </div>
        </Modal>
      )}

      {/* DISPUTE RESOLVER */}
      {activeOverlay === 'DISPUTE_RESOLVER' && (
        <Modal isOpen onClose={onClose} title="Resolve Match Dispute" maxWidth="sm:max-w-2xl">
          <div className="p-6 space-y-5">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <ShieldAlert className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-gray-300">
                Review the dispute evidence and take action. This decision is final and will be logged to the match audit trail.
              </p>
            </div>
            <div className="bg-black/30 border border-gray-800 rounded-lg p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Dispute Evidence</p>
              <div className="aspect-video bg-card rounded-lg flex items-center justify-center border border-gray-800">
                <p className="text-xs text-gray-600">Screenshot evidence preview</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <button
                onClick={() => onResolveDispute?.('warn')}
                className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 py-3 rounded-lg font-medium text-sm transition-colors min-h-[44px]"
              >
                Issue Warning
              </button>
              <button
                onClick={() => onResolveDispute?.('ban')}
                className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 py-3 rounded-lg font-medium text-sm transition-colors min-h-[44px]"
              >
                Ban Team
              </button>
              <button
                onClick={() => onResolveDispute?.('dismiss')}
                className="bg-surface hover:bg-surface text-gray-300 border border-gray-700 py-3 rounded-lg font-medium text-sm transition-colors min-h-[44px]"
              >
                Dismiss
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* SCRIM SLOTS */}
      {activeOverlay === 'SCRIM_SLOTS' && (
        <Modal isOpen onClose={onClose} title={`Slot Manager — ${scrimTitle ?? 'Scrim'}`} maxWidth="sm:max-w-3xl">
          <div className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-gray-800">
              <p className="text-xs text-gray-400">
                Click an open slot to manually reserve it. Click a filled slot to release the team (entry fees will be automatically refunded).
              </p>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Filled ({slotGrid?.filter(s => s.status === 'filled').length || 0})
                </span>
                <span className="flex items-center gap-1.5 text-slate-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-slate-700" />
                  Open ({slotGrid?.filter(s => s.status !== 'filled').length || 0})
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[60vh] overflow-y-auto pr-1">
              {slotGrid?.map((slot: any) => {
                const isFilled = slot.status === 'filled';
                return (
                  <button
                    key={slot.slotNumber}
                    type="button"
                    onClick={() => onToggleSlot?.(slot.slotNumber)}
                    className={`p-3 rounded-xl border text-left transition-all min-h-[68px] flex flex-col justify-between cursor-pointer ${
                      isFilled
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300 hover:bg-emerald-950/50 hover:border-emerald-400 shadow-sm'
                        : 'bg-card/60 border-gray-800 text-gray-400 hover:border-gray-700 hover:text-white'
                    }`}
                    title={slot.teamName ? `Slot ${slot.slotNumber}: ${slot.teamName} (Click to release)` : `Slot ${slot.slotNumber}: Open (Click to reserve)`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                        Slot #{slot.slotNumber}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                          isFilled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-400'
                        }`}
                      >
                        {isFilled ? 'Filled' : 'Open'}
                      </span>
                    </div>
                    <div className="mt-2 min-w-0">
                      <div className="text-xs font-bold truncate text-white flex items-center gap-1.5">
                        <span className="truncate">{isFilled ? (slot.teamName || `Team ${slot.slotNumber}`) : '+ Open Slot'}</span>
                        {slot.teamTag && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-blue-500/20 text-blue-400 font-mono border border-blue-500/30 shrink-0">
                            [{slot.teamTag}]
                          </span>
                        )}
                        {slot.isDedicatedTeam && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold shrink-0">
                            Team
                          </span>
                        )}
                      </div>
                      {slot.leader && slot.leader !== slot.teamName && (
                        <div className="text-[10px] text-gray-400 truncate mt-0.5">
                          Leader: <span className="text-gray-300">{slot.leader}</span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

export default OrgOverlayManager;
