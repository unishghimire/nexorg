import React, { useState } from 'react';
import {
  Search,
  Users,
  Lock,
  Unlock,
  AlertTriangle,
  Ban,
  ChevronDown,
  ChevronUp,
  Shield,
} from 'lucide-react';

export interface TeamsRostersTabProps {
  teams: any[];
  onToggleRosterLock: (teamId: string) => void;
  onIssueWarning: (teamName: string) => void;
  onBanTeam: (teamId: string, teamName: string) => void;
}

export const TeamsRostersTab: React.FC<TeamsRostersTabProps> = ({
  teams,
  onToggleRosterLock,
  onIssueWarning,
  onBanTeam,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>({});

  const toggleExpand = (teamId: string) => {
    setExpandedTeams((prev) => ({
      ...prev,
      [teamId]: !prev[teamId],
    }));
  };

  const filteredTeams = (teams || []).filter((team) => {
    const teamName = team?.name || team?.teamName || '';
    return teamName.toLowerCase().includes(searchQuery.toLowerCase().trim());
  });

  const renderStrikesBadge = (strikesCount: number = 0) => {
    if (strikesCount === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface/80 text-slate-400 border border-gray-700/60">
          0 Strikes
        </span>
      );
    }
    if (strikesCount === 1) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          1 Strike
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/30">
        <AlertTriangle className="w-3 h-3 shrink-0" />
        {strikesCount} Strikes
      </span>
    );
  };

  return (
    <div className="space-y-6 text-gray-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-white">Teams & Rosters</h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Team registry, Free Fire IGIDs, roster locks, and disciplinary actions
          </p>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative w-full">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search teams by name..."
          className="w-full min-h-[44px] bg-dark border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus-visible:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
        />
      </div>

      {/* Content area */}
      {filteredTeams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-dark/40 border border-slate-800/80 rounded-xl text-center px-4">
          <div className="w-12 h-12 rounded-full bg-card border border-slate-800 flex items-center justify-center mb-3">
            <Users className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-300">No teams registered.</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            {searchQuery
              ? `No registered teams match "${searchQuery}". Try clearing your search.`
              : 'There are currently no teams registered for this organizer account.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table (hidden sm:block) */}
          <div className="hidden sm:block overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 rounded-xl border border-slate-800 bg-dark/40">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-card/80 border-b border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4">Team Name</th>
                  <th className="py-3.5 px-4">IGID</th>
                  <th className="py-3.5 px-4">Players</th>
                  <th className="py-3.5 px-4 text-center">Roster Status</th>
                  <th className="py-3.5 px-4 text-center">Strikes</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {filteredTeams.map((team) => {
                  const teamId = team.id || team._id;
                  const teamName = team.name || team.teamName || 'Unnamed Team';
                  const igid = team.igid || 'N/A';
                  const players = team.players || [];
                  const isLocked = Boolean(team.rosterLocked);
                  const isBanned = Boolean(team.banned);
                  const banReason = team.banReason;
                  const strikes = team.strikes || 0;
                  const isExpanded = Boolean(expandedTeams[teamId]);

                  return (
                    <React.Fragment key={teamId}>
                      <tr
                        className={`transition-colors ${
                          isBanned
                            ? 'bg-red-950/20 border-l-4 border-l-red-500'
                            : 'hover:bg-card/40'
                        }`}
                      >
                        {/* Team Name */}
                        <td className="py-4 px-4 font-semibold text-white">
                          <div className="flex items-center gap-2">
                            <span>{teamName}</span>
                            {isBanned && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-red-500/20 text-red-400 border border-red-500/40 uppercase">
                                <Ban className="w-2.5 h-2.5" />
                                BANNED
                              </span>
                            )}
                          </div>
                          {isBanned && banReason && (
                            <p className="text-xs text-red-400/90 font-normal mt-0.5">
                              Reason: {banReason}
                            </p>
                          )}
                        </td>

                        {/* IGID */}
                        <td className="py-4 px-4 font-mono text-xs text-slate-300">
                          {igid}
                        </td>

                        {/* Players */}
                        <td className="py-4 px-4">
                          <button
                            type="button"
                            onClick={() => toggleExpand(teamId)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-card hover:bg-surface border border-gray-700/70 text-xs font-medium text-slate-200 transition-colors"
                          >
                            <Users className="w-3.5 h-3.5 text-brand-400" />
                            <span>{players.length} Players</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </button>
                        </td>

                        {/* Roster Status (Toggle Switch) */}
                        <td className="py-4 px-4 text-center">
                          <div className="inline-flex items-center justify-center">
                            <button
                              type="button"
                              onClick={() => onToggleRosterLock(teamId)}
                              className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center p-1 focus-visible:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-black rounded-full"
                              title={
                                isLocked
                                  ? 'Roster locked — click to unlock'
                                  : 'Roster unlocked — click to lock'
                                }
                              aria-label={
                                isLocked ? `Unlock roster for ${teamName}` : `Lock roster for ${teamName}`
                              }
                            >
                              <div
                                className={`w-12 h-6 rounded-full p-1 transition-colors relative flex items-center ${
                                  isLocked ? 'bg-green-500' : 'bg-surface'
                                }`}
                              >
                                <div
                                  className={`w-4 h-4 rounded-full bg-white transition-transform transform ${
                                    isLocked ? 'translate-x-6' : 'translate-x-0'
                                  } flex items-center justify-center shadow-sm`}
                                >
                                  {isLocked ? (
                                    <Lock className="w-2.5 h-2.5 text-green-700" />
                                  ) : (
                                    <Unlock className="w-2.5 h-2.5 text-gray-600" />
                                  )}
                                </div>
                              </div>
                            </button>
                          </div>
                        </td>

                        {/* Strikes */}
                        <td className="py-4 px-4 text-center">
                          {renderStrikesBadge(strikes)}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-4 text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => onIssueWarning(teamName)}
                              className="inline-flex items-center gap-1 px-3.5 py-2 min-h-[44px] rounded-lg text-xs font-medium border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500 transition-colors"
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Warn
                            </button>
                            {!isBanned && (
                              <button
                                type="button"
                                onClick={() => onBanTeam(teamId, teamName)}
                                className="inline-flex items-center gap-1 px-3.5 py-2 min-h-[44px] rounded-lg text-xs font-medium border border-red-500/40 text-red-400 hover:bg-red-500/10 hover:border-red-500 transition-colors"
                              >
                                <Ban className="w-3.5 h-3.5" />
                                Ban
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Sub-row for Roster Players */}
                      {isExpanded && (
                        <tr className="bg-dark/80">
                          <td colSpan={6} className="p-4">
                            <div className="bg-card/90 border border-slate-800 rounded-2xl p-4 space-y-3">
                              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                                  <Users className="w-4 h-4 text-brand-400" />
                                  Player Roster — {teamName}
                                </h4>
                                <span className="text-xs text-slate-400 font-mono">
                                  {players.length} Registered Player{players.length !== 1 ? 's' : ''}
                                </span>
                              </div>

                              {players.length === 0 ? (
                                <p className="text-xs text-slate-400 py-2">
                                  No players added to this roster.
                                </p>
                              ) : (
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                  {players.map((player: any, idx: number) => {
                                    const isLeader =
                                      player.role === 'leader' || player.role === 'Leader';
                                    return (
                                      <div
                                        key={idx}
                                        className="bg-black/60 border border-slate-800/80 rounded-md p-3 flex flex-col justify-between space-y-2"
                                      >
                                        <div>
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="font-semibold text-sm text-white truncate">
                                              {player.name}
                                            </span>
                                            {isLeader ? (
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-brand-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                                                <Shield className="w-2.5 h-2.5 text-brand-400" />
                                                Leader
                                              </span>
                                            ) : (
                                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-surface text-slate-300 border border-gray-700/60 shrink-0">
                                                Member
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-xs font-mono text-slate-400 mt-1">
                                            UID / IGID: <span className="text-slate-200">{player.igid || 'N/A'}</span>
                                          </p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Cards (block sm:hidden) */}
          <div className="block sm:hidden space-y-4">
            {filteredTeams.map((team) => {
              const teamId = team.id || team._id;
              const teamName = team.name || team.teamName || 'Unnamed Team';
              const igid = team.igid || 'N/A';
              const players = team.players || [];
              const isLocked = Boolean(team.rosterLocked);
              const isBanned = Boolean(team.banned);
              const banReason = team.banReason;
              const strikes = team.strikes || 0;
              const isExpanded = Boolean(expandedTeams[teamId]);

              return (
                <div
                  key={teamId}
                  className={`bg-dark/40 rounded-xl border p-4 space-y-4 transition-colors ${
                    isBanned
                      ? 'border-slate-800 border-l-4 border-l-red-500 bg-red-950/15'
                      : 'border-slate-800'
                  }`}
                >
                  {/* Top Header Row */}
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-800/80">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-base text-white">{teamName}</h3>
                        {isBanned && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-red-500/20 text-red-400 border border-red-500/40 uppercase">
                            <Ban className="w-2.5 h-2.5" />
                            BANNED
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-mono text-slate-400 mt-0.5">
                        IGID: {igid}
                      </p>
                      {isBanned && banReason && (
                        <p className="text-xs text-red-400 mt-1">
                          Reason: {banReason}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Status & Strikes */}
                  <div className="grid grid-cols-2 gap-3 py-1">
                    <div className="bg-card/60 p-2.5 rounded-lg border border-slate-800 flex flex-col items-start gap-1">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                        Roster Lock
                      </span>
                      <button
                        type="button"
                        onClick={() => onToggleRosterLock(teamId)}
                        className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center p-1 focus-visible:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-black rounded-full"
                        aria-label={
                          isLocked ? `Unlock roster for ${teamName}` : `Lock roster for ${teamName}`
                        }
                      >
                        <div
                          className={`w-12 h-6 rounded-full p-1 transition-colors relative flex items-center ${
                            isLocked ? 'bg-green-500' : 'bg-surface'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-white transition-transform transform ${
                              isLocked ? 'translate-x-6' : 'translate-x-0'
                            } flex items-center justify-center shadow-sm`}
                          >
                            {isLocked ? (
                              <Lock className="w-2.5 h-2.5 text-green-700" />
                            ) : (
                              <Unlock className="w-2.5 h-2.5 text-gray-600" />
                            )}
                          </div>
                        </div>
                      </button>
                    </div>

                    <div className="bg-card/60 p-2.5 rounded-lg border border-slate-800 flex flex-col items-start gap-1 justify-center">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                        Disciplinary
                      </span>
                      {renderStrikesBadge(strikes)}
                    </div>
                  </div>

                  {/* Player Expansion Toggle */}
                  <div>
                    <button
                      type="button"
                      onClick={() => toggleExpand(teamId)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-card/80 border border-slate-800 text-xs font-semibold text-slate-300 hover:bg-surface transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-brand-400" />
                        <span>Roster ({players.length} Players)</span>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </button>

                    {/* Sub-card Player Roster */}
                    {isExpanded && (
                      <div className="mt-3 p-3 bg-dark/90 rounded-lg border border-slate-800 space-y-2">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1.5 mb-2">
                          Registered Players
                        </div>
                        {players.length === 0 ? (
                          <p className="text-xs text-slate-400">No players registered.</p>
                        ) : (
                          <div className="space-y-2">
                            {players.map((player: any, idx: number) => {
                              const isLeader =
                                player.role === 'leader' || player.role === 'Leader';
                              return (
                                <div
                                  key={idx}
                                  className="bg-black/60 border border-slate-800 p-2.5 rounded-md flex items-center justify-between gap-2 text-xs"
                                >
                                  <div>
                                    <p className="font-semibold text-white">{player.name}</p>
                                    <p className="font-mono text-[11px] text-slate-400 mt-0.5">
                                      UID: {player.igid || 'N/A'}
                                    </p>
                                  </div>
                                  {isLeader ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-brand-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                                      <Shield className="w-2.5 h-2.5 text-brand-400" />
                                      Leader
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-surface text-slate-300 border border-gray-700/60 shrink-0">
                                      Member
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions Full Width */}
                  <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => onIssueWarning(teamName)}
                      className="w-full py-2.5 px-3 border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <AlertTriangle className="w-4 h-4" />
                      Issue Warning / Strike
                    </button>
                    {!isBanned && (
                      <button
                        type="button"
                        onClick={() => onBanTeam(teamId, teamName)}
                        className="w-full py-2.5 px-3 border border-red-500/40 text-red-400 hover:bg-red-500/10 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Ban className="w-4 h-4" />
                        Ban Team
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default TeamsRostersTab;
