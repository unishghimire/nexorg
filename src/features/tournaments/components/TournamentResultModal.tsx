import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trophy, X, Calendar, Users, Target, Award, Star, Medal,
  ArrowUpRight, Share2, Download, CheckCircle2, Search, ShieldCheck
} from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../shared/config/firebase';
import { Tournament } from '../../../shared/types/types';
import { formatCurrency, formatDate } from '../../../shared/utils/utils';
import { resolveAllScrimResults, ScrimResultEntry } from '../../../shared/utils/scrimResults';
import PrizeBoard from './PrizeBoard';
import ResultBoard from '../../results/components/ResultBoard';
import PerKillResultView from './PerKillResultView';
import { useNotification } from '../../../shared/context/NotificationContext';

interface TournamentResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournament: Tournament | any;
  participants?: any[];
}

const TournamentResultModal: React.FC<TournamentResultModalProps> = ({
  isOpen,
  onClose,
  tournament,
  participants: initialParticipants
}) => {
  const { showToast } = useNotification();
  const [fetchedParticipants, setFetchedParticipants] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // If participants were not passed in props, fetch them if tournament has an ID
  useEffect(() => {
    if (!isOpen || !tournament?.id || (initialParticipants && initialParticipants.length > 0)) {
      return;
    }

    let isMounted = true;
    const loadParts = async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'participants'), where('tournamentId', '==', tournament.id))
        );
        if (isMounted) {
          const parts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setFetchedParticipants(parts);
        }
      } catch (err) {
        console.warn('Could not fetch participants for result view:', err);
      }
    };

    loadParts();
    return () => {
      isMounted = false;
    };
  }, [isOpen, tournament?.id, initialParticipants]);

  const activeParticipants = (initialParticipants && initialParticipants.length > 0)
    ? initialParticipants
    : fetchedParticipants;

  // Resolve ALL registered teams & players who entered the scrim or tournament
  const allResults: ScrimResultEntry[] = useMemo(() => {
    return resolveAllScrimResults(tournament, activeParticipants);
  }, [tournament, activeParticipants]);

  // Derived Insights
  const { mvp, totalKills } = useMemo(() => {
    let mvpCandidate: any = null;
    let killsSum = 0;
    let maxKills = 0;

    allResults.forEach(r => {
      const k = Number(r.kills) || 0;
      killsSum += k;
      if (k > maxKills) {
        maxKills = k;
        mvpCandidate = r;
      }
    });

    return { mvp: mvpCandidate, totalKills: killsSum };
  }, [allResults]);

  const filteredResults = useMemo(() => {
    if (!searchQuery.trim()) return allResults;
    const q = searchQuery.toLowerCase();
    return allResults.filter(r =>
      (r.teamName && r.teamName.toLowerCase().includes(q)) ||
      (r.leader && r.leader.toLowerCase().includes(q)) ||
      (r.inGameName && r.inGameName.toLowerCase().includes(q)) ||
      (r.slotNumber && String(r.slotNumber).includes(q)) ||
      (r.status && r.status.toLowerCase().includes(q))
    );
  }, [allResults, searchQuery]);

  if (!isOpen) return null;

  const firstPlace = allResults.find(r => r.rank === 1);
  const secondPlace = allResults.find(r => r.rank === 2);
  const thirdPlace = allResults.find(r => r.rank === 3);

  const currencyCode = tournament.currency === 'USD' ? '$ ' :
    tournament.currency === 'EUR' ? '€ ' :
    tournament.currency === 'INR' ? '₹ ' : 'Rs. ';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6 lg:p-12 font-sans">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#0b1120]/95 backdrop-blur-md"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, y: 100, scale: 1 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 100, scale: 0.95 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative w-full max-w-5xl max-h-[100dvh] sm:max-h-[90vh] bg-[#0f172a] rounded-t-[2rem] sm:rounded-[2rem] border border-gray-800 shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Mobile Handle */}
          <div className="w-full flex justify-center pt-3 pb-1 sm:hidden absolute top-0 left-0 z-30 pointer-events-none">
            <div className="w-12 h-1.5 bg-surface rounded-full"></div>
          </div>

          {/* Header */}
          <div className="relative sticky top-0 z-20 bg-[#0f172a]/95 backdrop-blur-xl border-b border-gray-800 px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center text-amber-400 shrink-0">
                <Trophy className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight truncate">
                  {tournament.title}
                </h2>
                <div className="flex items-center gap-2 sm:gap-3 mt-1 flex-wrap">
                  <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    <Calendar className="w-3 h-3 text-brand-500" /> {formatDate(tournament.startTime || tournament.createdAt)}
                  </span>
                  <span className="w-1 h-1 rounded-full bg-gray-700 hidden sm:inline-block"></span>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" /> Official Results
                  </span>
                  {tournament.matchType === 'scrims' || tournament.isScrim ? (
                    <span className="text-[10px] font-bold text-brand-400 uppercase tracking-widest bg-brand-500/10 px-2 py-0.5 rounded-md border border-brand-500/20">
                      Scrim Match
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="p-3 bg-surface hover:bg-gray-800 text-gray-400 hover:text-white rounded-xl transition"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="overflow-y-auto custom-scrollbar flex-1 p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">

            {/* Winner Spotlight & Podium Hero */}
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-amber-500/10 via-[#0f172a] to-[#0f172a] border border-amber-500/20 p-5 sm:p-8 text-center group">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-48 bg-amber-500/15 blur-[90px] pointer-events-none"></div>

              <Trophy className="w-16 h-16 sm:w-20 sm:h-20 text-yellow-500 mx-auto mb-4 filter drop-shadow-[0_0_20px_rgba(234,179,8,0.5)] transform group-hover:scale-105 transition-transform duration-500" />
              <h3 className="text-[10px] font-black text-amber-400 uppercase tracking-[0.3em] mb-2">
                Scrim Champions & Podium
              </h3>

              {firstPlace ? (
                <div className="space-y-3">
                  <h4 className="text-3xl sm:text-5xl font-black text-white tracking-tighter uppercase truncate max-w-2xl mx-auto">
                    {firstPlace.teamName}
                  </h4>
                  {firstPlace.leader && firstPlace.leader !== firstPlace.teamName && (
                    <p className="text-xs text-gray-400 font-semibold">
                      Captain / Leader: <span className="text-white font-bold">{firstPlace.leader}</span>
                      {firstPlace.inGameName && ` (IGN: ${firstPlace.inGameName})`}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 pt-1">
                    <span className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-yellow-400 bg-yellow-500/10 px-4 py-1.5 rounded-full border border-yellow-500/30">
                      <Award className="w-4 h-4" /> 1st Place Champion
                    </span>
                    {firstPlace.prize > 0 && (
                      <span className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-emerald-400 bg-emerald-500/10 px-4 py-1.5 rounded-full border border-emerald-500/30">
                        <Trophy className="w-4 h-4" />
                        {formatCurrency(firstPlace.prize, currencyCode)}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-2xl font-black text-white tracking-tighter uppercase">
                  Winners Finalized
                </div>
              )}

              {/* Mini Podium Row (Rank 2 & Rank 3) */}
              {(secondPlace || thirdPlace) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6 max-w-xl mx-auto text-left">
                  {secondPlace && (
                    <div className="bg-card/80 border border-slate-700/60 rounded-2xl p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-400/20 border border-slate-400/30 flex items-center justify-center text-lg font-bold shrink-0">
                          🥈
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                            2nd Place
                          </span>
                          <span className="text-sm font-black text-white truncate block">
                            {secondPlace.teamName}
                          </span>
                        </div>
                      </div>
                      {secondPlace.prize > 0 && (
                        <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 shrink-0">
                          {formatCurrency(secondPlace.prize, currencyCode)}
                        </span>
                      )}
                    </div>
                  )}

                  {thirdPlace && (
                    <div className="bg-card/80 border border-amber-900/50 rounded-2xl p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-amber-700/20 border border-amber-600/30 flex items-center justify-center text-lg font-bold shrink-0">
                          🥉
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] uppercase font-bold text-amber-500 tracking-wider block">
                            3rd Place
                          </span>
                          <span className="text-sm font-black text-white truncate block">
                            {thirdPlace.teamName}
                          </span>
                        </div>
                      </div>
                      {thirdPlace.prize > 0 && (
                        <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 shrink-0">
                          {formatCurrency(thirdPlace.prize, currencyCode)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Match Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-[#1e293b]/50 border border-gray-800 rounded-2xl p-4 sm:p-5 text-center">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-brand-400 mx-auto mb-2 opacity-80" />
                <div className="text-xl sm:text-2xl font-black text-white">
                  {allResults.length > 0 ? allResults.length : (tournament.currentPlayers || 0)}
                </div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                  Registered Teams
                </div>
              </div>
              <div className="bg-[#1e293b]/50 border border-gray-800 rounded-2xl p-4 sm:p-5 text-center">
                <Target className="w-5 h-5 sm:w-6 sm:h-6 text-rose-400 mx-auto mb-2 opacity-80" />
                <div className="text-xl sm:text-2xl font-black text-white">
                  {totalKills > 0 ? totalKills : '-'}
                </div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                  Total Kills
                </div>
              </div>
              <div className="bg-[#1e293b]/50 border border-gray-800 rounded-2xl p-4 sm:p-5 text-center">
                <Medal className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 mx-auto mb-2 opacity-80" />
                <div className="text-xl sm:text-2xl font-black text-white">
                  {tournament.prizePool > 0 ? formatCurrency(tournament.prizePool, currencyCode) : 'Free'}
                </div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                  Total Prize Pool
                </div>
              </div>
              <div className="bg-[#1e293b]/50 border border-gray-800 rounded-2xl p-4 sm:p-5 text-center">
                <Star className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400 mx-auto mb-2 opacity-80" />
                <div className="text-lg sm:text-xl font-black text-white truncate max-w-full px-1" title={mvp?.teamName || mvp?.leader || '-'}>
                  {mvp ? (mvp.teamName || mvp.leader) : '-'}
                </div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                  Match MVP {mvp && mvp.kills > 0 ? `(${mvp.kills} K)` : ''}
                </div>
              </div>
            </div>

            {/* FULL REGISTERED TEAMS & PLAYERS RESULTS LEADERBOARD */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-gray-800">
                <div>
                  <h4 className="text-base sm:text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-brand-500" />
                    Complete Scrim Standings & Results
                  </h4>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Official match placements for all registered teams and players who competed in this scrim.
                  </p>
                </div>

                {/* Search / Filter Bar */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search team or slot..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#1e293b]/80 border border-gray-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:border-brand-500 focus-visible:outline-none"
                  />
                </div>
              </div>

              {filteredResults.length > 0 ? (
                <div className="bg-[#1e293b]/30 rounded-2xl sm:rounded-3xl border border-gray-800 overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#0f172a]/90 text-gray-400 uppercase font-mono border-b border-gray-800">
                        <tr>
                          <th className="py-3.5 px-4 text-center w-16">Rank</th>
                          <th className="py-3.5 px-3 w-20">Slot</th>
                          <th className="py-3.5 px-4">Team / Player</th>
                          <th className="py-3.5 px-3 text-center">Kills</th>
                          <th className="py-3.5 px-3 text-center">Points</th>
                          <th className="py-3.5 px-4 text-right">Prize</th>
                          <th className="py-3.5 px-4 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/60">
                        {filteredResults.map((entry) => {
                          const isTop1 = entry.rank === 1;
                          const isTop2 = entry.rank === 2;
                          const isTop3 = entry.rank === 3;

                          return (
                            <tr
                              key={entry.id}
                              className={`transition-colors ${
                                isTop1 ? 'bg-amber-500/5 hover:bg-amber-500/10' :
                                isTop2 ? 'bg-slate-400/5 hover:bg-slate-400/10' :
                                isTop3 ? 'bg-amber-700/5 hover:bg-amber-700/10' :
                                'hover:bg-white/5'
                              }`}
                            >
                              {/* Rank */}
                              <td className="py-3.5 px-4 text-center">
                                {isTop1 ? (
                                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-yellow-500/20 text-yellow-400 font-black text-xs border border-yellow-500/30">
                                    🥇 1
                                  </span>
                                ) : isTop2 ? (
                                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-400/20 text-slate-200 font-black text-xs border border-slate-400/30">
                                    🥈 2
                                  </span>
                                ) : isTop3 ? (
                                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-amber-700/20 text-amber-500 font-black text-xs border border-amber-600/30">
                                    🥉 3
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-surface text-gray-300 font-mono font-bold text-xs border border-gray-800">
                                    #{entry.rank}
                                  </span>
                                )}
                              </td>

                              {/* Slot Number */}
                              <td className="py-3.5 px-3">
                                {entry.slotNumber ? (
                                  <span className="font-mono font-bold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-md border border-brand-500/20 text-[11px]">
                                    Slot {entry.slotNumber}
                                  </span>
                                ) : (
                                  <span className="text-gray-600 font-mono">—</span>
                                )}
                              </td>

                              {/* Team Name & Captain */}
                              <td className="py-3.5 px-4 min-w-[180px]">
                                <div className="flex items-center gap-2">
                                  {entry.teamTag && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-brand-500/20 text-brand-400 font-mono font-bold shrink-0">
                                      [{entry.teamTag}]
                                    </span>
                                  )}
                                  <span className="font-black text-white text-sm truncate">
                                    {entry.teamName}
                                  </span>
                                </div>
                                {entry.leader && entry.leader !== entry.teamName && (
                                  <div className="text-[11px] text-gray-400 mt-0.5 truncate">
                                    <span className="text-gray-500">Player:</span> {entry.leader}
                                    {entry.inGameName && entry.inGameName !== entry.leader && (
                                      <span className="text-brand-400 ml-1">({entry.inGameName})</span>
                                    )}
                                  </div>
                                )}
                                {Array.isArray(entry.teammates) && entry.teammates.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {entry.teammates.slice(0, 4).map((tm: any, tmi: number) => (
                                      <span key={tmi} className="text-[9px] px-1.5 py-0.2 rounded bg-surface text-gray-400 border border-gray-800">
                                        {typeof tm === 'string' ? tm : (tm?.name || tm?.username || tm?.inGameName)}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>

                              {/* Kills */}
                              <td className="py-3.5 px-3 text-center font-bold text-gray-200">
                                {entry.kills > 0 ? (
                                  <span className="text-rose-400 font-black">{entry.kills}</span>
                                ) : (
                                  <span className="text-gray-500">0</span>
                                )}
                              </td>

                              {/* Points */}
                              <td className="py-3.5 px-3 text-center font-mono font-bold text-white">
                                {entry.score > 0 ? (
                                  <span className="text-brand-400 font-black">{entry.score} pts</span>
                                ) : (
                                  <span className="text-gray-500">0</span>
                                )}
                              </td>

                              {/* Prize */}
                              <td className="py-3.5 px-4 text-right">
                                {entry.prize > 0 ? (
                                  <span className="inline-block px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 font-black border border-emerald-500/30 text-xs">
                                    {formatCurrency(entry.prize, currencyCode)}
                                  </span>
                                ) : (
                                  <span className="text-gray-600 font-mono">—</span>
                                )}
                              </td>

                              {/* Status */}
                              <td className="py-3.5 px-4 text-right">
                                <span
                                  className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                    isTop1 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                                    isTop2 ? 'bg-slate-300/20 text-slate-300 border border-slate-400/30' :
                                    isTop3 ? 'bg-amber-800/20 text-amber-500 border border-amber-700/30' :
                                    'bg-surface text-gray-400 border border-gray-800'
                                  }`}
                                >
                                  {entry.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="bg-[#1e293b]/20 border border-dashed border-gray-800 rounded-2xl p-8 text-center">
                  <Users className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm font-bold text-gray-400">
                    No registered teams found matching your search.
                  </p>
                </div>
              )}
            </div>

            {/* Per-Kill Reward Results */}
            {(tournament as any).tournamentMode === 'PER_KILL_REWARD' && (
              <div className="space-y-4">
                <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                  <Target className="w-5 h-5 text-brand-500" /> Per-Kill Reward Results
                </h4>
                <div className="bg-[#1e293b]/30 rounded-3xl border border-gray-800 overflow-hidden shadow-xl p-4 sm:p-6">
                  <PerKillResultView tournament={tournament} />
                </div>
              </div>
            )}

            {/* Legacy Professional Scoreboard (if template explicitly configured) */}
            {tournament.manualResults && tournament.manualResults.length > 0 && tournament.resultTemplate && (
              <div className="space-y-4">
                <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                  <Target className="w-5 h-5 text-indigo-500" /> Custom Scoreboard Template
                </h4>
                <div className="bg-[#1e293b]/30 rounded-3xl border border-gray-800 overflow-hidden shadow-xl">
                  <ResultBoard results={tournament.manualResults} config={tournament.resultTemplate} />
                </div>
              </div>
            )}

            {/* Prize Distribution Panel */}
            {tournament.prizeDistribution && tournament.prizeDistribution.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-500" /> Official Prize Pool Structure
                </h4>
                <div className="bg-[#1e293b]/30 rounded-2xl sm:rounded-3xl border border-gray-800 overflow-hidden shadow-xl p-4 sm:p-6">
                  <PrizeBoard
                    prizes={tournament.prizeDistribution}
                    currency={tournament.currency}
                    totalPrizePool={tournament.prizePool}
                  />
                </div>
              </div>
            )}

            {/* Official Results Screenshot */}
            {tournament.resultUrl && (
              <div className="space-y-4">
                <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                  <Star className="w-5 h-5 text-cyan-500" /> Official Post-Match Snapshot
                </h4>
                <div className="rounded-3xl overflow-hidden border border-gray-800 shadow-2xl relative group cursor-pointer">
                  <img
                    src={tournament.resultUrl}
                    alt="Match Results"
                    className="w-full h-auto object-cover transform transition duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(tournament.resultUrl);
                          showToast('Screenshot link copied!', 'success');
                        } catch {
                          showToast('Could not copy link', 'error');
                        }
                      }}
                      className="bg-white/10 hover:bg-white/20 text-white backdrop-blur-md px-6 py-3 rounded-full font-bold flex items-center gap-2 uppercase tracking-widest text-xs border border-white/20 transition-colors"
                    >
                      <Share2 className="w-4 h-4" /> Copy Screenshot Link
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Action Footer */}
          <div className="bg-[#0b1120] border-t border-gray-800 p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-xs text-gray-400 bg-card border border-gray-800 hover:bg-surface hover:text-white transition-colors"
            >
              Close Panel
            </button>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => window.print()}
                className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-xs text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" /> Download PDF
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(window.location.href);
                    showToast('Result link copied to clipboard', 'success');
                  } catch (error) {
                    showToast('Could not copy the result link', 'error');
                  }
                }}
                className="w-full sm:w-auto px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs text-white bg-gradient-to-r from-amber-500 to-brand-500 hover:from-amber-400 hover:to-brand-400 shadow-xl shadow-amber-500/20 transition-colors flex items-center justify-center gap-2 group"
              >
                Share Result <ArrowUpRight className="w-4 h-4 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default TournamentResultModal;
