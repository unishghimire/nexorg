import { sanitizeUrl } from '../../../shared/utils/utils';
import React, { useState } from 'react';
import {
  Radio,
  Key,
  Copy,
  ShieldAlert,
  ExternalLink,
  Clock,
  Check,
  MapPin
} from 'lucide-react';

export interface MatchRoomsTabProps {
  matchRooms: any[];
  disputes: any[];
  onOpenRoomDispatch: (room: any) => void;
  onResolveDispute: (disputeId: string, action: string) => void;
  onOpenDisputeOverlay?: (disputeId: string) => void;
}

const MatchRoomsTab: React.FC<MatchRoomsTabProps> = ({
  matchRooms = [],
  disputes = [],
  onOpenRoomDispatch,
  onResolveDispute,
  onOpenDisputeOverlay,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  const getRoomStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'live') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Live
        </span>
      );
    }
    if (s === 'pending') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          Pending
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-surface text-slate-400 border border-gray-700">
        {status || 'Unknown'}
      </span>
    );
  };

  const getDisputeStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'pending') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          Pending
        </span>
      );
    }
    if (s === 'reviewing') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
          Reviewing
        </span>
      );
    }
    if (s === 'resolved') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Resolved
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-surface text-slate-400 border border-gray-700">
        {status || 'Unknown'}
      </span>
    );
  };

  return (
    <div className="space-y-8 text-white">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-white">Match Rooms</h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">Live lobby dispatch and dispute resolution</p>
        </div>
      </div>

      {/* Section A: Live Match Rooms */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Radio className="w-5 h-5 text-emerald-400" />
          <h3 className="text-lg font-semibold text-white">Live Match Rooms</h3>
        </div>

        {matchRooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl bg-card/50 border border-slate-800">
            <Radio className="w-12 h-12 text-gray-600 mb-3" />
            <p className="text-slate-400 font-medium">No active match rooms.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {matchRooms.map((room, idx) => {
              const roomIdKey = `room-${room.id || idx}-id`;
              const roomPassKey = `room-${room.id || idx}-pass`;
              const isIdCopied = copiedKey === roomIdKey;
              const isPassCopied = copiedKey === roomPassKey;

              return (
                <div
                  key={room.id || idx}
                  className="bg-card/80 border border-slate-800 hover:border-gray-700 transition-colors rounded-xl p-5 space-y-4"
                >
                  {/* Top Bar: Tournament Name, Map, Status */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                    <div className="space-y-1">
                      <h4 className="font-semibold text-white text-base md:text-lg">
                        {room.tournamentName || room.title || 'Free Fire Tournament'}
                      </h4>
                      {room.map && (
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" /> Map: <span className="text-slate-300 font-medium">{room.map}</span>
                        </p>
                      )}
                    </div>
                    <div>{getRoomStatusBadge(room.status)}</div>
                  </div>

                  {/* Room ID & Password Key-Value Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Room ID Box */}
                    <div className="bg-dark/40 border border-slate-800 rounded-lg p-3 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                        <span className="font-medium flex items-center gap-1">
                          <Key className="w-3.5 h-3.5 text-emerald-400" /> Room ID
                        </span>
                        <button
                          onClick={() => handleCopy(room.roomId, roomIdKey)}
                          className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1 font-medium min-h-[44px] px-2"
                          aria-label="Copy Room ID" title="Copy Room ID"
                        >
                          {isIdCopied ? (
                            <span className="text-emerald-400 flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> Copied!
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <Copy className="w-3.5 h-3.5" /> Copy
                            </span>
                          )}
                        </button>
                      </div>
                      <span className="font-mono text-sm sm:text-base font-bold text-white tracking-wider">
                        {room.roomId || 'N/A'}
                      </span>
                    </div>

                    {/* Room Password Box */}
                    <div className="bg-dark/40 border border-slate-800 rounded-lg p-3 flex flex-col justify-between">
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                        <span className="font-medium flex items-center gap-1">
                          <Key className="w-3.5 h-3.5 text-emerald-400" /> Password
                        </span>
                        <button
                          onClick={() => handleCopy(room.roomPass, roomPassKey)}
                          className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1 font-medium min-h-[44px] px-2"
                          aria-label="Copy Room Password" title="Copy Room Password"
                        >
                          {isPassCopied ? (
                            <span className="text-emerald-400 flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> Copied!
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <Copy className="w-3.5 h-3.5" /> Copy
                            </span>
                          )}
                        </button>
                      </div>
                      <span className="font-mono text-sm sm:text-base font-bold text-white tracking-wider">
                        {room.roomPass || 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <button
                      onClick={() => onOpenRoomDispatch(room)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs sm:text-sm px-4 py-2 rounded-lg transition-colors flex items-center gap-2 min-h-[44px]"
                    >
                      <Radio className="w-4 h-4" /> Broadcast Room
                    </button>

                    {room.streamUrl && (
                      <a
                        href={sanitizeUrl(room.streamUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[44px] px-3 py-2 text-xs sm:text-sm text-brand-400 hover:text-brand-300 font-medium flex items-center gap-1.5 transition-colors rounded-lg hover:bg-brand-500/10"
                      >
                        View Stream <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Section B: Dispute Queue */}
      <section className="space-y-4 pt-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-amber-500" />
          <h3 className="text-lg font-semibold text-white">Dispute Queue</h3>
        </div>

        {disputes.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl bg-card/50 border border-slate-800">
            <ShieldAlert className="w-12 h-12 text-gray-600 mb-3" />
            <p className="text-slate-400 font-medium">No disputes filed.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {disputes.map((dispute, idx) => (
              <div
                key={dispute.id || idx}
                className="bg-card/80 border border-slate-800 hover:border-gray-700 transition-colors rounded-xl p-5 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white text-base">
                        {dispute.reportedBy ? `Reported by ${dispute.reportedBy}` : 'Dispute Report'}
                      </span>
                      {dispute.tournamentName && (
                        <span className="text-xs text-slate-400 bg-surface px-2 py-0.5 rounded">
                          {dispute.tournamentName}
                        </span>
                      )}
                      {dispute.matchRoom && (
                        <span className="text-xs text-slate-400 bg-surface/80 px-2 py-0.5 rounded">
                          Room #{dispute.matchRoom}
                        </span>
                      )}
                    </div>
                  </div>
                  <div>{getDisputeStatusBadge(dispute.status)}</div>
                </div>

                <p className="text-sm text-slate-300 bg-dark/30 p-3 rounded-lg border border-slate-800/50">
                  {dispute.reason || 'No details provided.'}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Filed: {dispute.filedAt || 'Recently'}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenDisputeOverlay) {
                        onOpenDisputeOverlay(dispute.id);
                      } else if (onResolveDispute) {
                        onResolveDispute(dispute.id, 'warn');
                      }
                    }}
                    className="bg-surface hover:bg-surface text-white font-medium text-xs px-3.5 py-2 rounded-lg transition-colors border border-gray-700 flex items-center gap-1.5 min-h-[44px]"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" /> Review Dispute
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default MatchRoomsTab;
