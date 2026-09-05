import React, { useState } from 'react';
import { Trash2, Radio, ShieldAlert, Sparkles, Send, User, Gamepad2, AlertOctagon, Image as ImageIcon, ZoomIn, ExternalLink } from 'lucide-react';
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
  roomTargetTitle?: string;
  roomId?: string;
  setRoomId?: (v: string) => void;
  roomPass?: string;
  setRoomPass?: (v: string) => void;
  streamUrl?: string;
  setStreamUrl?: (v: string) => void;
  onBroadcastRoom?: () => void;
  // Dispute resolver
  disputeId?: string;
  dispute?: any;
  onResolveDispute?: (action: 'warn' | 'ban' | 'dismiss', resolutionNote?: string) => void;
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
  roomTargetTitle,
  roomId,
  setRoomId,
  roomPass,
  setRoomPass,
  streamUrl,
  setStreamUrl,
  onBroadcastRoom,
  disputeId,
  dispute,
  onResolveDispute,
  scrimTitle,
  slotGrid,
  onToggleSlot,
}) => {
  const [internalDisputeNote, setInternalDisputeNote] = useState('');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const generateRandomPassword = () => {
    const prefixes = ['ff', 'nex', 'pro', 'war'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(1000 + Math.random() * 9000);
    setRoomPass?.(`${prefix}${num}`);
  };

  const evidenceUrl = dispute?.evidenceUrl || dispute?.screenshotUrl || dispute?.imageUrl || dispute?.proofUrl;

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
            {roomTargetTitle && (
              <div className="p-3 bg-dark/60 rounded-xl border border-gray-800 text-xs font-bold text-gray-300">
                Lobby: <span className="text-white">{roomTargetTitle}</span>
              </div>
            )}
            <p className="text-xs text-gray-400">
              These credentials will be pushed to all registered players instantly via in-app alert.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 font-bold uppercase tracking-wider mb-1.5">Room ID</label>
                <input
                  type="text"
                  value={roomId}
                  onChange={e => setRoomId?.(e.target.value)}
                  placeholder="e.g. 5240212"
                  className="w-full bg-dark border border-gray-800 rounded-xl p-3 text-sm font-mono font-bold text-white focus-visible:outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs text-gray-400 font-bold uppercase tracking-wider">Room Password</label>
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" /> Random Pass
                  </button>
                </div>
                <input
                  type="text"
                  value={roomPass}
                  onChange={e => setRoomPass?.(e.target.value)}
                  placeholder="e.g. ffpro2026"
                  className="w-full bg-dark border border-gray-800 rounded-xl p-3 text-sm font-mono font-bold text-white focus-visible:outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 font-bold uppercase tracking-wider mb-1.5">Stream Link (Optional)</label>
                <input
                  type="text"
                  value={streamUrl}
                  onChange={e => setStreamUrl?.(e.target.value)}
                  placeholder="https://youtube.com/live/..."
                  className="w-full bg-dark border border-gray-800 rounded-xl p-3 text-xs text-white focus-visible:outline-none focus:border-brand-500"
                />
              </div>

              {/* Notification simulation */}
              <div className="bg-dark/80 p-3 rounded-xl border border-gray-800 text-xs space-y-1">
                <span className="text-[10px] font-black uppercase text-gray-400 flex items-center gap-1">
                  <Send className="w-3 h-3 text-blue-400" /> Player Alert Preview:
                </span>
                <p className="text-gray-300 font-mono text-[11px]">
                  Room ID: {roomId || '...'} | Password: {roomPass || '...'}
                </p>
              </div>
            </div>
            <button
              onClick={onBroadcastRoom}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 min-h-[44px] shadow-lg shadow-emerald-950/20"
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
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <ShieldAlert className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <p className="font-bold text-amber-300">
                  Review the match dispute evidence and official reports.
                </p>
                <p className="text-gray-300">
                  Your ruling will update the match record and notify involved participants.
                </p>
              </div>
            </div>

            {/* Dispute Case Info */}
            {dispute && (
              <div className="bg-dark/80 border border-gray-800 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Event:</span>
                  <span className="font-bold text-white">{dispute.tournamentName || 'Tournament'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Reporter:</span>
                  <span className="font-bold text-white">{dispute.reportedBy || dispute.reporterUid || 'Participant'}</span>
                </div>
                {dispute.reportedTeamName && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Accused Party:</span>
                    <span className="font-bold text-red-400">{dispute.reportedTeamName}</span>
                  </div>
                )}
                {dispute.matchRoom && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Match Room #:</span>
                    <span className="font-mono font-bold text-white">{dispute.matchRoom}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-gray-800">
                  <span className="text-gray-400 block mb-1">Reason:</span>
                  <p className="text-gray-200 bg-card p-2.5 rounded-lg border border-gray-800">
                    {dispute.reason || 'No description provided.'}
                  </p>
                </div>
              </div>
            )}

            {/* Evidence Image */}
            <div className="space-y-2">
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Dispute Evidence</p>
              {evidenceUrl ? (
                <div className="relative group">
                  <img
                    src={evidenceUrl}
                    alt="Dispute Screenshot"
                    className="max-h-60 w-full object-cover rounded-xl border border-gray-800 cursor-pointer"
                    onClick={() => setLightboxImage(evidenceUrl)}
                  />
                  <button
                    type="button"
                    onClick={() => setLightboxImage(evidenceUrl)}
                    className="absolute bottom-2 right-2 px-2.5 py-1 bg-black/80 text-white text-[10px] font-bold rounded-lg flex items-center gap-1 border border-gray-700"
                  >
                    <ZoomIn className="w-3 h-3 text-emerald-400" /> Full Image
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-dark/60 rounded-xl border border-gray-800 text-center text-xs text-gray-500">
                  No screenshot evidence attached by reporter.
                </div>
              )}
            </div>

            {/* Resolution Explanation */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-300">
                Resolution Explanation (Sent to Players)
              </label>
              <textarea
                value={internalDisputeNote}
                onChange={e => setInternalDisputeNote(e.target.value)}
                rows={2}
                placeholder="e.g. Warning issued for rule violation. / Dispute dismissed due to lack of evidence."
                className="w-full bg-dark border border-gray-800 rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:border-brand-500 focus-visible:outline-none"
              />
            </div>

            {/* Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <button
                type="button"
                onClick={() => onResolveDispute?.('dismiss', internalDisputeNote)}
                className="bg-surface hover:bg-surface text-gray-300 border border-gray-700 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition min-h-[44px]"
              >
                Dismiss Report
              </button>
              <button
                type="button"
                onClick={() => onResolveDispute?.('warn', internalDisputeNote)}
                className="bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition min-h-[44px]"
              >
                Issue Warning
              </button>
              <button
                type="button"
                onClick={() => onResolveDispute?.('ban', internalDisputeNote)}
                className="bg-red-600 hover:bg-red-500 text-white py-3 rounded-xl font-black text-xs uppercase tracking-wider transition min-h-[44px] shadow-lg shadow-red-950/40"
              >
                Disqualify / Ban
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

      {/* Lightbox for Evidence Screenshot */}
      {lightboxImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-fade-in">
          <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute -top-10 right-0 text-gray-400 hover:text-white p-1 rounded-lg transition"
            >
              ✕ Close
            </button>
            <img
              src={lightboxImage}
              alt="Full Evidence Screenshot"
              className="max-h-[85vh] max-w-full object-contain rounded-2xl border border-gray-800 shadow-2xl"
            />
          </div>
        </div>
      )}
    </>
  );
};

export default OrgOverlayManager;
