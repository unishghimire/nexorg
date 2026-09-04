import React from 'react';
import { Gamepad2, RefreshCw, Clock, DollarSign, Trophy, Plus, Settings2, Edit2, Trash2, Radio, Play, CheckCircle2, RotateCcw, XCircle, Users } from 'lucide-react';
import { toDateSafe } from '../../../shared/utils/utils';
import { resolveSlotTeam, fetchDedicatedTeams, DedicatedTeamsLookup } from '../../../shared/utils/teamUtils';

export interface ScrimsHubTabProps {
  scrims: any[];
  participants?: any[];
  onOpenSlotGrid: (scrim: any) => void;
  onToggleSlot: (scrimId: any, slotNumber?: any) => void;
  onViewDetails?: (id: string) => void;
  onCreateScrim?: () => void;
  onEditScrim?: (scrim: any) => void;
  onDeleteScrim?: (scrimId: string, title: string) => void;
  onUpdateStatus?: (scrimId: string, status: string) => void;
  onOpenRoomDispatch?: (scrim: any) => void;
}

export const ScrimsHubTab: React.FC<ScrimsHubTabProps> = ({
  scrims,
  participants = [],
  onOpenSlotGrid,
  onToggleSlot,
  onViewDetails,
  onCreateScrim,
  onEditScrim,
  onDeleteScrim,
  onUpdateStatus,
  onOpenRoomDispatch,
}) => {
  const formatTime = (timeInput?: any) => {
    if (!timeInput) return 'TBD';
    try {
      const date = toDateSafe(timeInput);
      if (!date) return typeof timeInput === 'string' ? timeInput : 'TBD';
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch (e) {
      console.warn('Date formatting failed', e);
      return typeof timeInput === 'string' ? timeInput : 'TBD';
    }
  };

  const formatCurrency = (amount?: number) => {
    if (amount === undefined || amount === null) return 'N/A';
    if (amount === 0) return 'FREE';
    return `Rs. ${amount.toLocaleString()}`;
  };

  const formatMode = (formatStr?: string) => {
    if (!formatStr) return 'Battle Royale';
    if (formatStr.toLowerCase().includes('5v5')) return '5v5';
    if (formatStr.toLowerCase().includes('royale') || formatStr.toLowerCase().includes('br')) return 'Battle Royale';
    return formatStr;
  };

  const [dedicatedTeamsData, setDedicatedTeamsData] = React.useState<DedicatedTeamsLookup>({
    teamById: new Map(),
    teamByUserId: new Map(),
  });

  React.useEffect(() => {
    let isMounted = true;
    const teamIds: string[] = [];
    const userIds: string[] = [];

    scrims.forEach((scrim) => {
      (scrim.slots || []).forEach((s: any) => {
        if (s?.teamId) teamIds.push(s.teamId);
        if (s?.userId) userIds.push(s.userId);
      });
    });

    participants.forEach((p: any) => {
      if (p?.teamId) teamIds.push(p.teamId);
      if (p?.userId) userIds.push(p.userId);
    });

    if (teamIds.length === 0 && userIds.length === 0) return;

    fetchDedicatedTeams({ teamIds, userIds }).then((teamsMap) => {
      if (isMounted) {
        setDedicatedTeamsData(teamsMap);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [scrims, participants]);

  const handleSlotClick = (scrimId: string, slotNumber: number) => {
    if (typeof onToggleSlot === 'function') {
      onToggleSlot(scrimId, slotNumber);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black text-white tracking-tight">Scrims Hub</h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Manage Free Fire scrim schedules, slot reservations, and live matches
          </p>
        </div>

        <button
          type="button"
          onClick={() => onCreateScrim?.()}
          className="inline-flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-400 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-brand-500/10 self-start sm:self-auto cursor-pointer min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          <span>Schedule Scrim</span>
        </button>
      </div>

      {/* Empty State */}
      {!scrims || scrims.length === 0 ? (
        <div className="bg-dark/50 border border-slate-800 rounded-lg p-12 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-card border border-slate-800 flex items-center justify-center mb-4">
            <Gamepad2 className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">No scrims scheduled.</h3>
          <p className="text-sm text-slate-400 max-w-sm">
            There are no active or upcoming Free Fire scrim sessions available right now.
          </p>
          <button
            type="button"
            onClick={() => onCreateScrim?.()}
            className="mt-4 inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-400 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" /> Create First Scrim
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {scrims.map((scrim) => {
            const scrimParticipants = (participants || []).filter(
              (p) => p.tournamentId === scrim.id
            );

            const totalSlots =
              typeof scrim.totalSlots === 'number'
                ? scrim.totalSlots
                : typeof scrim.slots === 'number'
                ? scrim.slots
                : Array.isArray(scrim.slots)
                ? scrim.slots.length
                : 20;

            const rawSlots = Array.isArray(scrim.slots) ? scrim.slots : [];
            const isTeamFormat =
              (scrim.teamType || scrim.format || '').toLowerCase().includes('duo') ||
              (scrim.teamType || scrim.format || '').toLowerCase().includes('squad') ||
              (scrim.teamType || '').toLowerCase() !== 'solo';

            const slotList: Array<{
              slotNumber: number;
              status: string;
              teamName?: string | null;
              teamTag?: string | null;
              isDedicatedTeam?: boolean;
              leader?: string | null;
              inGameId?: string | null;
              teammates?: any[];
              teammatesCount: number;
            }> = Array.from({ length: totalSlots }, (_, i) => {
              const slotNum = i + 1;
              const docSlot = rawSlots.find((s: any) => s && s.slotNumber === slotNum) || rawSlots[i] || { slotNumber: slotNum, status: 'open' };
              const participant =
                scrimParticipants.find((p: any) => 
                  p.slotNumber === slotNum ||
                  (docSlot?.teamId && (p.teamId === docSlot.teamId || p.userId === docSlot.teamId)) ||
                  (docSlot?.userId && p.userId === docSlot.userId) ||
                  (docSlot?.teamName && docSlot.teamName !== 'Reserved' && p.teamName === docSlot.teamName)
                );

              const isFilled =
                Boolean(participant) ||
                docSlot?.status === 'filled' ||
                Boolean(docSlot?.teamName);

              const resolved = resolveSlotTeam(docSlot, participant, dedicatedTeamsData, isTeamFormat);
              const teamName = isFilled ? (resolved.teamName || `Team ${slotNum}`) : null;
              const leader = resolved.leader || participant?.username || docSlot?.leader || null;
              const inGameId = resolved.inGameId || participant?.inGameId || docSlot?.inGameId || null;
              const teammates = resolved.teammates || [];

              return {
                slotNumber: slotNum,
                status: isFilled ? 'filled' : 'open',
                teamName,
                teamTag: resolved.teamTag,
                isDedicatedTeam: resolved.isDedicatedTeam,
                leader,
                inGameId,
                teammates,
                teammatesCount: Array.isArray(teammates) ? teammates.length : 0,
              };
            });

            const filledSlots = slotList.filter((s) => s.status === 'filled').length;
            const progressPercent = Math.min(100, Math.max(0, (filledSlots / Math.max(1, totalSlots)) * 100));
            const registeredTeams = slotList.filter((s) => s.status === 'filled');

            const statusUpper = (scrim.status || 'OPEN').toUpperCase();

            return (
              <div
                key={scrim.id}
                className="bg-dark/50 border border-slate-800 rounded-2xl p-5 space-y-5 transition-colors hover:border-gray-700/80"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-lg font-bold text-white">{scrim.title}</h3>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-500/10 text-brand-400 border border-brand-500/20">
                        {formatMode(scrim.format)}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          statusUpper === 'LIVE'
                            ? 'bg-red-500/10 text-red-400 border-red-500/20 animate-pulse'
                            : statusUpper === 'COMPLETED'
                            ? 'bg-surface text-slate-400 border-gray-700'
                            : statusUpper === 'CANCELLED'
                            ? 'bg-red-900/20 text-red-400 border-red-800'
                            : 'bg-green-500/10 text-green-400 border-green-500/20'
                        }`}
                      >
                        {statusUpper}
                      </span>
                    </div>

                    {(scrim.recurring || scrim.recurrencePattern) && (
                      <div className="flex items-center gap-1.5 text-xs text-brand-400/90 font-medium">
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>{typeof scrim.recurrencePattern === 'string' ? scrim.recurrencePattern : 'Recurring Scrim Schedule'}</span>
                      </div>
                    )}

                    {(scrim.roomId || scrim.roomPass) && (
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs w-fit">
                        <Radio className="w-3 h-3 text-emerald-400 animate-pulse shrink-0" />
                        <span className="text-emerald-400 font-semibold">Room:</span>
                        <span className="font-mono text-white font-bold">{scrim.roomId || 'TBD'}</span>
                        {scrim.roomPass && (
                          <>
                            <span className="text-slate-600">|</span>
                            <span className="text-emerald-400 font-semibold">Pass:</span>
                            <span className="font-mono text-white font-bold">{scrim.roomPass}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions Header */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Manage Scrim */}
                    {onViewDetails && (
                      <button
                        type="button"
                        onClick={() => onViewDetails(scrim.id)}
                        className="bg-brand-500 hover:bg-brand-400 text-white px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 min-h-[40px]"
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                        <span>Manage</span>
                      </button>
                    )}

                    {/* Edit Scrim */}
                    {onEditScrim && (
                      <button
                        type="button"
                        onClick={() => onEditScrim(scrim)}
                        className="bg-card hover:bg-surface text-slate-200 border border-slate-800 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 min-h-[40px]"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                    )}

                    {/* Room Details */}
                    {onOpenRoomDispatch && (
                      <button
                        type="button"
                        onClick={() => onOpenRoomDispatch(scrim)}
                        className="bg-card hover:bg-surface text-slate-200 border border-slate-800 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 min-h-[40px]"
                      >
                        <Radio className="w-3.5 h-3.5 text-brand-400" />
                        <span>Room</span>
                      </button>
                    )}

                    {/* View Slot Grid */}
                    <button
                      type="button"
                      onClick={() => onOpenSlotGrid(scrim)}
                      className="bg-card hover:bg-surface text-slate-200 border border-slate-800 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 min-h-[40px]"
                    >
                      <span>Slot Grid</span>
                    </button>

                    {/* Quick Status Toggles */}
                    {onUpdateStatus && (
                      <div className="flex items-center gap-1">
                        {scrim.status !== 'live' && scrim.status !== 'completed' && (
                          <button
                            type="button"
                            onClick={() => onUpdateStatus(scrim.id, 'live')}
                            className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 p-2 rounded-lg text-xs font-semibold transition-colors"
                            title="Go Live"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {scrim.status === 'live' && (
                          <button
                            type="button"
                            onClick={() => onUpdateStatus(scrim.id, 'completed')}
                            className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 p-2 rounded-lg text-xs font-semibold transition-colors"
                            title="Complete / Finalize"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {scrim.status === 'completed' && (
                          <button
                            type="button"
                            onClick={() => onUpdateStatus(scrim.id, 'open')}
                            className="bg-surface hover:bg-card text-gray-300 border border-gray-700 p-2 rounded-lg text-xs font-semibold transition-colors"
                            title="Reopen"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Delete Scrim */}
                    {onDeleteScrim && (
                      <button
                        type="button"
                        onClick={() => onDeleteScrim(scrim.id, scrim.title)}
                        className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 p-2 rounded-lg text-xs font-semibold transition-colors min-h-[40px]"
                        title="Delete Scrim"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-400">Slot Reservations</span>
                    <span className="text-slate-200">
                      <span className="text-brand-400">{filledSlots}</span> / {totalSlots} Filled
                    </span>
                  </div>
                  <div className="h-2 bg-surface rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full transition-colors duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-slate-800/60">
                  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-card/40 border border-slate-800/50">
                    <div className="w-8 h-8 rounded-lg bg-surface/80 flex items-center justify-center flex-shrink-0 text-brand-400">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Start Time</div>
                      <div className="text-xs font-bold text-slate-200">{formatTime(scrim.startTime)}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-card/40 border border-slate-800/50">
                    <div className="w-8 h-8 rounded-lg bg-surface/80 flex items-center justify-center flex-shrink-0 text-amber-400">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Entry Fee</div>
                      <div className="text-xs font-bold text-slate-200">{formatCurrency(scrim.entryFee)}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-card/40 border border-slate-800/50">
                    <div className="w-8 h-8 rounded-lg bg-surface/80 flex items-center justify-center flex-shrink-0 text-emerald-400">
                      <Trophy className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Prize Pool</div>
                      <div className="text-xs font-bold text-slate-200">{formatCurrency(scrim.prizePool)}</div>
                    </div>
                  </div>
                </div>

                {/* Visual Slot Grid & Registered Teams */}
                <div className="pt-2 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Interactive Slot Grid ({filledSlots}/{totalSlots})
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenSlotGrid(scrim)}
                      className="text-xs font-semibold text-brand-400 hover:text-brand-300 transition cursor-pointer"
                    >
                      Expand Slot Manager →
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                    {slotList.map((slot) => (
                      <button
                        key={slot.slotNumber}
                        type="button"
                        onClick={() => handleSlotClick(scrim.id, slot.slotNumber)}
                        className={`p-2.5 rounded-xl border text-left transition-all min-h-[52px] flex flex-col justify-between cursor-pointer ${
                          slot.status === 'filled'
                            ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300 hover:bg-emerald-950/50 hover:border-emerald-400 shadow-sm shadow-emerald-950/50'
                            : 'bg-card/60 border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300'
                        }`}
                        title={slot.teamName ? `Slot ${slot.slotNumber}: ${slot.teamName} (Click to toggle/release)` : `Slot ${slot.slotNumber}: Open (Click to reserve)`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            Slot #{slot.slotNumber}
                          </span>
                          <span
                            className={`w-2 h-2 rounded-full ${
                              slot.status === 'filled' ? 'bg-emerald-400 ring-2 ring-emerald-500/30' : 'bg-slate-700'
                            }`}
                          />
                        </div>
                        <div className="text-xs font-bold truncate mt-1">
                          {slot.status === 'filled' ? (
                            <span className="text-emerald-300 flex items-center gap-1 truncate">
                              <Users className="w-3 h-3 flex-shrink-0 text-emerald-400" />
                              <span className="truncate">{slot.teamName}</span>
                              {slot.teamTag && (
                                <span className="text-[10px] text-emerald-400 font-mono">[{slot.teamTag}]</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-500 font-normal">+ Open</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Registered Teams Roster */}
                  {registeredTeams.length > 0 ? (
                    <div className="mt-3 p-3.5 bg-card/40 border border-slate-800/60 rounded-xl space-y-2">
                      <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-800/60">
                        <span className="font-bold text-slate-200 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-emerald-400" />
                          Registered Teams ({registeredTeams.length})
                        </span>
                        <span className="text-[10px] text-slate-500">Live Roster</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                        {registeredTeams.map((r) => (
                          <div
                            key={r.slotNumber}
                            className="flex items-center justify-between p-2.5 rounded-lg bg-surface/50 border border-slate-800 text-xs gap-2"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold shrink-0">
                                #{r.slotNumber}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="font-bold text-white truncate flex items-center gap-1.5">
                                  <span className="truncate">{r.teamName}</span>
                                  {r.teamTag && (
                                    <span className="px-1 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono text-[9px] border border-blue-500/30">
                                      [{r.teamTag}]
                                    </span>
                                  )}
                                  {r.isDedicatedTeam && (
                                    <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 text-[9px] border border-indigo-500/30 font-semibold">
                                      Team
                                    </span>
                                  )}
                                  {r.teammatesCount > 0 && (
                                    <span className="px-1.5 py-0.2 rounded bg-surface border border-slate-700 text-slate-300 text-[9px] shrink-0 font-medium">
                                      +{r.teammatesCount} roster
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 truncate mt-0.5">
                                  {r.leader && r.leader !== r.teamName && <span>Leader: <strong className="text-slate-300">{r.leader}</strong></span>}
                                  {r.inGameId && <span className="font-mono text-emerald-400">UID: {r.inGameId}</span>}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {onViewDetails && (
                                <button
                                  type="button"
                                  onClick={() => onViewDetails(scrim.id)}
                                  className="text-[10px] text-brand-400 hover:text-brand-300 px-2 py-1 rounded bg-brand-500/10 border border-brand-500/20 transition cursor-pointer"
                                  title="View full details and manage"
                                >
                                  Details
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleSlotClick(scrim.id, r.slotNumber)}
                                className="text-[10px] text-rose-400/80 hover:text-rose-300 px-2 py-1 rounded bg-rose-500/10 border border-rose-500/20 transition cursor-pointer"
                                title="Release this slot"
                              >
                                Release
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-2.5 bg-card/20 border border-slate-800/40 rounded-xl text-[11px] text-slate-500">
                      No teams registered yet. All {totalSlots} slots are currently open.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
export default ScrimsHubTab;
