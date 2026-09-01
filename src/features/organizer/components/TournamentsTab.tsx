import React, { useState } from 'react';
import {
  Plus,
  Trophy,
  Radio,
  Check,
  Play,
  Trash2,
  ChevronDown,
  ChevronUp,
  Settings2,
  Edit2,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import { getSlotCount, getFilledSlotCount } from '../../../shared/utils/scrimSlots';

export interface BracketMatch {
  id?: string;
  round: number;
  match?: number;
  teamA?: string;
  teamB?: string;
  team1?: string;
  team2?: string;
  winner?: string | null;
  scoreA?: number;
  scoreB?: number;
  score1?: number;
  score2?: number;
}

export interface TournamentsTabProps {
  hostedTournaments: any[];
  onDelete: (id: string, title: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onCreateTournament: () => void;
  onOpenRoomDispatch: (tournament: any) => void;
  onManageTournament?: (id: string, matchType?: string) => void;
  onEditTournament?: (tournament: any) => void;
  onActivateTournament?: (id: string) => Promise<void>;
}

const TournamentsTab: React.FC<TournamentsTabProps> = ({
  hostedTournaments,
  onDelete,
  onUpdateStatus,
  onCreateTournament,
  onOpenRoomDispatch,
  onManageTournament,
  onEditTournament,
  onActivateTournament,
}) => {
  const [expandedBrackets, setExpandedBrackets] = useState<Record<string, boolean>>({});

  const toggleBracket = (id: string) => {
    setExpandedBrackets((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const formatFormat = (format?: string) => {
    if (!format) return 'Battle Royale';
    return format
      .replace(/_/g, ' ')
      .replace(/-/g, ' ')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getStatusBadge = (status: string, fundingStatus?: string) => {
    const s = status ? status.toLowerCase() : 'upcoming';
    if (s === 'pending_funding' || fundingStatus === 'PENDING_FUNDING') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          Pending Funding
        </span>
      );
    }
    switch (s) {
      case 'live':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </span>
        );
      case 'completed':
      case 'finalized':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800/80 text-zinc-400 border border-slate-700/60">
            <Check className="w-3 h-3 text-zinc-400" />
            Completed
          </span>
        );
      case 'upcoming':
      case 'draft':
      case 'open':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
            Upcoming
          </span>
        );
    }
  };

  const renderBracket = (matches: BracketMatch[]) => {
    if (!matches || matches.length === 0) return null;

    const rounds = Array.from(new Set(matches.map((m) => m.round))).sort((a, b) => a - b);
    const maxRound = Math.max(...rounds);

    const getRoundTitle = (round: number) => {
      if (round === maxRound && maxRound > 1) return 'Finals';
      if (round === maxRound - 1 && maxRound > 2) return 'Semi-Finals';
      return `Round ${round}`;
    };

    return (
      <div className="mt-4 pt-4 border-t border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Tournament Bracket
          </span>
          <span className="text-xs text-zinc-400 sm:hidden">
            Swipe to view full bracket &rarr;
          </span>
        </div>

        <div className="overflow-x-auto pb-2 custom-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-4 min-w-max p-1">
            {rounds.map((roundNum) => {
              const roundMatches = matches.filter((m) => m.round === roundNum);
              return (
                <div key={roundNum} className="flex flex-col gap-3 min-w-[220px]">
                  <div className="text-xs font-medium text-zinc-400 text-center py-1 bg-zinc-900/80 rounded border border-slate-800">
                    {getRoundTitle(roundNum)}
                  </div>
                  {roundMatches.map((match, idx) => {
                    const teamA = match.teamA || match.team1 || 'TBD';
                    const teamB = match.teamB || match.team2 || 'TBD';
                    const scoreA = match.scoreA ?? match.score1 ?? 0;
                    const scoreB = match.scoreB ?? match.score2 ?? 0;

                    const winner = match.winner;
                    const isWinnerA =
                      winner === teamA ||
                      (!winner && scoreA > scoreB && (scoreA > 0 || scoreB > 0));
                    const isWinnerB =
                      winner === teamB ||
                      (!winner && scoreB > scoreA && (scoreA > 0 || scoreB > 0));

                    return (
                      <div
                        key={match.id || idx}
                        className="bg-zinc-900 border border-slate-800 rounded-lg p-3 text-sm shadow-sm space-y-1.5"
                      >
                        {/* Team A */}
                        <div
                          className={`flex justify-between items-center px-2.5 py-1.5 rounded transition-colors ${
                            isWinnerA
                              ? 'bg-green-500/10 text-green-400 font-semibold border border-green-500/20'
                              : 'bg-zinc-950/60 text-zinc-300'
                          }`}
                        >
                          <span className="truncate max-w-[130px]">{teamA}</span>
                          <span
                            className={`font-mono text-xs font-bold ${
                              isWinnerA ? 'text-green-400' : 'text-zinc-400'
                            }`}
                          >
                            {scoreA}
                          </span>
                        </div>

                        {/* Team B */}
                        <div
                          className={`flex justify-between items-center px-2.5 py-1.5 rounded transition-colors ${
                            isWinnerB
                              ? 'bg-green-500/10 text-green-400 font-semibold border border-green-500/20'
                              : 'bg-zinc-950/60 text-zinc-300'
                          }`}
                        >
                          <span className="truncate max-w-[130px]">{teamB}</span>
                          <span
                            className={`font-mono text-xs font-bold ${
                              isWinnerB ? 'text-green-400' : 'text-zinc-400'
                            }`}
                          >
                            {scoreB}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const hasTournaments = hostedTournaments && hostedTournaments.length > 0;

  return (
    <div className="space-y-6 text-sm text-zinc-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Tournaments
          </h2>
        </div>

        <button
          onClick={onCreateTournament}
          className="bg-brand-500 hover:bg-brand-400 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors min-h-[44px] flex items-center justify-center gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Create Tournament</span>
        </button>
      </div>

      {/* Tournament Cards or Empty State */}
      {!hasTournaments ? (
        <div className="bg-dark/50 border border-slate-800 rounded-lg p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
          <div className="p-4 rounded-full bg-zinc-900 border border-slate-800 mb-4 text-amber-400">
            <Trophy className="w-10 h-10" />
          </div>
          <p className="text-zinc-300 font-medium mb-4 text-base max-w-md">
            No tournaments yet. Create your first Free Fire tournament.
          </p>
          <button
            onClick={onCreateTournament}
            className="bg-brand-500 hover:bg-brand-400 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors min-h-[44px] flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create Tournament</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {hostedTournaments.map((tournament) => {
            const isExpanded = !!expandedBrackets[tournament.id];
            const hasBracket =
              Array.isArray(tournament.bracketMatches) &&
              tournament.bracketMatches.length > 0;
            const isLive = tournament.status === 'live';
            const isCompleted =
              tournament.status === 'completed' || tournament.status === 'finalized';

            return (
              <div
                key={tournament.id}
                className="bg-dark/50 border border-slate-800 rounded-2xl p-5 transition-colors hover:border-gray-700/80"
              >
                {/* Title & Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base sm:text-lg font-semibold text-white tracking-tight">
                      {tournament.title}
                    </h3>
                  </div>
                  <div>{getStatusBadge(tournament.status, tournament.fundingStatus)}</div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                  <div>
                    <span className="block text-xs text-zinc-400 mb-1">Game</span>
                    <span className="font-medium text-zinc-200 truncate block">
                      {tournament.game || 'Free Fire'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-zinc-400 mb-1">Format</span>
                    <span className="font-medium text-zinc-200 truncate block">
                      {formatFormat(tournament.format)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-zinc-400 mb-1">Teams</span>
                    <span className="font-medium text-zinc-200">
                      {getFilledSlotCount(tournament)} / {getSlotCount(tournament)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-zinc-400 mb-1">Prize Pool</span>
                    <span className="font-medium text-amber-400 truncate block">
                      Rs. {(tournament.prizePool || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {/* Activate & Reserve Funds for Pending Funding tournaments */}
                  {(tournament.status === 'pending_funding' || tournament.fundingStatus === 'PENDING_FUNDING') && onActivateTournament && (
                    <button
                      onClick={() => onActivateTournament(tournament.id)}
                      className="min-h-[44px] px-3.5 py-2 rounded-lg text-sm font-medium bg-amber-600 hover:bg-amber-500 text-white transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Lock className="w-4 h-4" />
                      <span>Activate & Reserve Funds</span>
                    </button>
                  )}

                  {/* Manage / Details */}
                  {onManageTournament && (
                    <button
                      onClick={() => onManageTournament(tournament.id, tournament.matchType || (tournament.isScrim ? 'scrims' : 'tournament'))}
                      className="min-h-[44px] px-3.5 py-2 rounded-lg text-sm font-medium bg-brand-500 hover:bg-brand-400 text-white transition-colors flex items-center justify-center gap-2"
                    >
                      <Settings2 className="w-4 h-4" />
                      <span>Manage</span>
                    </button>
                  )}

                  {/* Edit */}
                  {onEditTournament && (
                    <button
                      onClick={() => onEditTournament(tournament)}
                      className="min-h-[44px] px-3.5 py-2 rounded-lg text-sm font-medium border border-gray-700 hover:border-gray-600 hover:bg-slate-800/80/80 text-zinc-200 transition-colors flex items-center justify-center gap-2"
                    >
                      <Edit2 className="w-4 h-4" />
                      <span>Edit</span>
                    </button>
                  )}

                  {/* Room Details */}
                  <button
                    onClick={() => onOpenRoomDispatch(tournament)}
                    className="min-h-[44px] px-3.5 py-2 rounded-lg text-sm font-medium border border-gray-700 hover:border-gray-600 hover:bg-slate-800/80/80 text-zinc-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <Radio className="w-4 h-4 text-brand-400" />
                    <span>Room Details</span>
                  </button>

                  {/* Status Toggles: Go Live or Finalize */}
                  {isLive ? (
                    <button
                      onClick={() => onUpdateStatus(tournament.id, 'completed')}
                      className="min-h-[44px] px-3.5 py-2 rounded-lg text-sm font-medium bg-amber-600 hover:bg-amber-500 text-white transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Check className="w-4 h-4" />
                      <span>Finalize</span>
                    </button>
                  ) : !isCompleted && tournament.status !== 'pending_funding' ? (
                    <button
                      onClick={() => onUpdateStatus(tournament.id, 'live')}
                      className="min-h-[44px] px-3.5 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Go Live</span>
                    </button>
                  ) : null}

                  {/* Delete */}
                  <button
                    onClick={() => onDelete(tournament.id, tournament.title)}
                    className="min-h-[44px] px-3.5 py-2 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </button>

                  {/* View Bracket toggle button if bracketMatches present */}
                  {hasBracket && (
                    <button
                      onClick={() => toggleBracket(tournament.id)}
                      className="min-h-[44px] px-3.5 py-2 rounded-lg text-sm font-medium border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10 transition-colors flex items-center justify-center gap-2"
                    >
                      <span>{isExpanded ? 'Hide Bracket' : 'View Bracket'}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>

                {/* Inline Bracket render */}
                {hasBracket && isExpanded && renderBracket(tournament.bracketMatches)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TournamentsTab;
