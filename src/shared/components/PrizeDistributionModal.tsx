import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Trophy,
  Award,
  Medal,
  Plus,
  Trash2,
  DollarSign,
  Users,
  Target,
  AlertCircle,
  CheckCircle2,
  Lock,
  Sparkles,
  Search,
} from 'lucide-react';
import Modal from './Modal';
import { useNotification } from '../context/NotificationContext';
import {
  WinnerPayoutEntry,
  executePrizeDistribution,
} from '../services/prizeDistributionService';

interface PrizeDistributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: any;
  eventType?: 'tournament' | 'scrim';
  participants?: any[];
  onSuccess?: () => void;
}

export const PrizeDistributionModal: React.FC<PrizeDistributionModalProps> = ({
  isOpen,
  onClose,
  event,
  eventType = 'tournament',
  participants = [],
  onSuccess,
}) => {
  const { showToast } = useNotification();
  const [submitting, setSubmitting] = useState(false);

  const totalPrizePool = Math.max(
    0,
    Number(
      event?.prizePool ??
      event?.totalPrizePool ??
      event?.prizes?.reduce?.((s: number, p: any) => s + (Number(p.amount) || 0), 0) ??
      0
    )
  );

  // Initialize winner tiers
  const [tiers, setTiers] = useState<WinnerPayoutEntry[]>([
    { rank: 1, teamName: '', teamId: '', userId: '', prize: Math.round(totalPrizePool * 0.5), kills: 0, points: 15 },
    { rank: 2, teamName: '', teamId: '', userId: '', prize: Math.round(totalPrizePool * 0.3), kills: 0, points: 12 },
    { rank: 3, teamName: '', teamId: '', userId: '', prize: Math.round(totalPrizePool * 0.2), kills: 0, points: 10 },
  ]);

  // Extract candidate teams/players from all possible sources
  const candidateOptions = useMemo(() => {
    const map = new Map<string, { label: string; teamName: string; teamId: string; userId: string; leader: string }>();

    // 1. From participants collection
    if (Array.isArray(participants)) {
      participants.forEach((p) => {
        const teamName = (p.teamName || p.username || 'Team').trim();
        const teamId = p.teamId || p.userId || teamName;
        const key = `${teamName}_${teamId}`.toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            label: teamName + (p.inGameId ? ` [ID: ${p.inGameId}]` : ''),
            teamName,
            teamId,
            userId: p.userId || '',
            leader: p.username || p.teamLeader || teamName,
          });
        }
      });
    }

    // 2. From event slots (scrims)
    if (Array.isArray(event?.slots)) {
      event.slots.forEach((s: any) => {
        if (s.teamName && s.status === 'filled') {
          const teamName = String(s.teamName).trim();
          const teamId = s.teamId || s.userId || teamName;
          const key = `${teamName}_${teamId}`.toLowerCase();
          if (!map.has(key)) {
            map.set(key, {
              label: `Slot #${s.slotNumber}: ${teamName}`,
              teamName,
              teamId,
              userId: s.userId || '',
              leader: s.leader || teamName,
            });
          }
        }
      });
    }

    // 3. From event groups (tournaments)
    if (Array.isArray(event?.groups)) {
      event.groups.forEach((g: any) => {
        if (Array.isArray(g.teams)) {
          g.teams.forEach((t: any) => {
            const teamName = (t.name || 'Team').trim();
            const teamId = t.id || teamName;
            const key = `${teamName}_${teamId}`.toLowerCase();
            if (!map.has(key)) {
              map.set(key, {
                label: `${teamName} (${g.name || 'Group'})`,
                teamName,
                teamId,
                userId: t.ownerId || '',
                leader: teamName,
              });
            }
          });
        }
      });
    }

    return Array.from(map.values());
  }, [participants, event]);

  // Reset or preset on open
  useEffect(() => {
    if (isOpen) {
      if (Array.isArray(event?.winners) && event.winners.length > 0) {
        setTiers(event.winners);
      } else {
        const pool = totalPrizePool;
        const usedKeys = new Set<string>();
        const defaultSplits = [0.5, 0.3, 0.2];
        const initialTiers: WinnerPayoutEntry[] = defaultSplits.map((pct, idx) => {
          const nextCandidate = candidateOptions.find((c) => {
            const k = (c.teamId || c.userId || c.teamName).toLowerCase();
            if (!usedKeys.has(k)) {
              usedKeys.add(k);
              return true;
            }
            return false;
          });

          return {
            rank: idx + 1,
            teamName: nextCandidate?.teamName || '',
            teamId: nextCandidate?.teamId || '',
            userId: nextCandidate?.userId || '',
            prize: Math.round(pool * pct),
            kills: 0,
            points: 15 - idx * 3,
          };
        });

        setTiers(initialTiers);
      }
    }
  }, [isOpen, event, totalPrizePool, candidateOptions]);

  const allocatedTotal = useMemo(() => {
    return tiers.reduce((sum, t) => sum + (Number(t.prize) || 0), 0);
  }, [tiers]);

  const remainingToAllocate = totalPrizePool - allocatedTotal;

  // Preset split logic
  const applyPreset = (preset: 'top3' | 'top2' | 'all' | 'top5' | 'equal') => {
    const pool = totalPrizePool;
    if (preset === 'top3') {
      setTiers([
        { rank: 1, teamName: tiers[0]?.teamName || '', teamId: tiers[0]?.teamId || '', userId: tiers[0]?.userId || '', prize: Math.round(pool * 0.5), kills: tiers[0]?.kills || 0, points: 15 },
        { rank: 2, teamName: tiers[1]?.teamName || '', teamId: tiers[1]?.teamId || '', userId: tiers[1]?.userId || '', prize: Math.round(pool * 0.3), kills: tiers[1]?.kills || 0, points: 12 },
        { rank: 3, teamName: tiers[2]?.teamName || '', teamId: tiers[2]?.teamId || '', userId: tiers[2]?.userId || '', prize: Math.round(pool * 0.2), kills: tiers[2]?.kills || 0, points: 10 },
      ]);
    } else if (preset === 'top2') {
      setTiers([
        { rank: 1, teamName: tiers[0]?.teamName || '', teamId: tiers[0]?.teamId || '', userId: tiers[0]?.userId || '', prize: Math.round(pool * 0.7), kills: tiers[0]?.kills || 0, points: 15 },
        { rank: 2, teamName: tiers[1]?.teamName || '', teamId: tiers[1]?.teamId || '', userId: tiers[1]?.userId || '', prize: Math.round(pool * 0.3), kills: tiers[1]?.kills || 0, points: 12 },
      ]);
    } else if (preset === 'all') {
      setTiers([
        { rank: 1, teamName: tiers[0]?.teamName || '', teamId: tiers[0]?.teamId || '', userId: tiers[0]?.userId || '', prize: pool, kills: tiers[0]?.kills || 0, points: 20 },
      ]);
    } else if (preset === 'top5') {
      setTiers([
        { rank: 1, teamName: tiers[0]?.teamName || '', teamId: tiers[0]?.teamId || '', userId: tiers[0]?.userId || '', prize: Math.round(pool * 0.4), kills: tiers[0]?.kills || 0, points: 15 },
        { rank: 2, teamName: tiers[1]?.teamName || '', teamId: tiers[1]?.teamId || '', userId: tiers[1]?.userId || '', prize: Math.round(pool * 0.25), kills: tiers[1]?.kills || 0, points: 12 },
        { rank: 3, teamName: tiers[2]?.teamName || '', teamId: tiers[2]?.teamId || '', userId: tiers[2]?.userId || '', prize: Math.round(pool * 0.15), kills: tiers[2]?.kills || 0, points: 10 },
        { rank: 4, teamName: tiers[3]?.teamName || '', teamId: tiers[3]?.teamId || '', userId: tiers[3]?.userId || '', prize: Math.round(pool * 0.10), kills: tiers[3]?.kills || 0, points: 8 },
        { rank: 5, teamName: tiers[4]?.teamName || '', teamId: tiers[4]?.teamId || '', userId: tiers[4]?.userId || '', prize: Math.round(pool * 0.10), kills: tiers[4]?.kills || 0, points: 6 },
      ]);
    } else if (preset === 'equal') {
      const count = Math.max(1, tiers.length);
      const split = Math.floor(pool / count);
      setTiers(tiers.map((t) => ({ ...t, prize: split })));
    }
  };

  const handleAddTier = () => {
    const nextRank = tiers.length + 1;
    setTiers([...tiers, { rank: nextRank, teamName: '', teamId: '', userId: '', prize: 0, kills: 0, points: 0 }]);
  };

  const handleRemoveTier = (index: number) => {
    if (tiers.length <= 1) return;
    const updated = tiers.filter((_, i) => i !== index).map((t, i) => ({ ...t, rank: i + 1 }));
    setTiers(updated);
  };

  const handleSelectTeam = (index: number, selectedValue: string) => {
    if (!selectedValue) {
      setTiers((prev) =>
        prev.map((t, i) => (i === index ? { ...t, teamName: '', teamId: '', userId: '' } : t))
      );
      return;
    }

    const found = candidateOptions.find((c) => c.teamName === selectedValue || c.teamId === selectedValue);
    const targetTeamName = found ? found.teamName : selectedValue;
    const targetTeamId = found?.teamId || '';
    const targetUserId = found?.userId || '';

    // Check if this candidate is already selected in another rank
    const alreadySelectedTier = tiers.find((t, i) => {
      if (i === index) return false;
      const sameId = targetTeamId && t.teamId && targetTeamId.toLowerCase() === t.teamId.toLowerCase();
      const sameUser = targetUserId && t.userId && targetUserId.toLowerCase() === t.userId.toLowerCase();
      const sameName = targetTeamName && t.teamName && targetTeamName.trim().toLowerCase() === t.teamName.trim().toLowerCase();
      return Boolean(sameId || sameUser || sameName);
    });

    if (alreadySelectedTier) {
      showToast(
        `"${targetTeamName}" is already selected for Rank #${alreadySelectedTier.rank}! Each team or player can only be assigned to one winning rank.`,
        'error'
      );
      return;
    }

    setTiers((prev) =>
      prev.map((t, i) => {
        if (i !== index) return t;
        if (found) {
          return { ...t, teamName: found.teamName, teamId: found.teamId, userId: found.userId };
        }
        return { ...t, teamName: selectedValue, teamId: `custom_${Date.now()}`, userId: '' };
      })
    );
  };

  const handleUpdateTier = (index: number, field: keyof WinnerPayoutEntry, val: any) => {
    setTiers((prev) =>
      prev.map((t, i) => (i === index ? { ...t, [field]: val } : t))
    );
  };

  const handleDistribute = async () => {
    const validTiers = tiers.filter(
      (t) => (t.teamName.trim() || t.userId) && Number(t.prize) > 0
    );

    if (validTiers.length === 0) {
      showToast('Please assign at least one winning team with a prize amount greater than 0', 'error');
      return;
    }

    // Strict validation: Ensure no user or team is selected more than once
    const seenUsers = new Set<string>();
    const seenTeams = new Set<string>();
    const seenNames = new Set<string>();

    for (const t of validTiers) {
      const userKey = (t.userId || '').trim().toLowerCase();
      const teamIdKey = (t.teamId || '').trim().toLowerCase();
      const nameKey = (t.teamName || '').trim().toLowerCase();

      if (userKey && seenUsers.has(userKey)) {
        showToast(
          `Duplicate winner detected: Player "${t.teamName || t.username || userKey}" is selected multiple times (Rank #${t.rank}). Each user can only receive one rank prize.`,
          'error'
        );
        return;
      }
      if (teamIdKey && seenTeams.has(teamIdKey)) {
        showToast(
          `Duplicate winner detected: Team "${t.teamName}" is selected multiple times (Rank #${t.rank}). Each team can only win one rank prize.`,
          'error'
        );
        return;
      }
      if (nameKey && seenNames.has(nameKey)) {
        showToast(
          `Duplicate winner detected: "${t.teamName}" is selected multiple times (Rank #${t.rank}). Please select unique winners for each prize rank.`,
          'error'
        );
        return;
      }

      if (userKey) seenUsers.add(userKey);
      if (teamIdKey) seenTeams.add(teamIdKey);
      if (nameKey) seenNames.add(nameKey);
    }

    if (totalPrizePool > 0 && Math.abs(allocatedTotal - totalPrizePool) > 0.01) {
      if (allocatedTotal > totalPrizePool) {
        showToast(`Total allocated (Rs. ${allocatedTotal.toLocaleString()}) exceeds prize pool (Rs. ${totalPrizePool.toLocaleString()})`, 'error');
        return;
      }
      if (!window.confirm(`Distributed amount (Rs. ${allocatedTotal.toLocaleString()}) is less than the total prize pool (Rs. ${totalPrizePool.toLocaleString()}). Proceed with partial payout?`)) {
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await executePrizeDistribution({
        eventId: event.id,
        eventType: eventType || (event.matchType === 'scrims' || event.isScrim ? 'scrim' : 'tournament'),
        eventTitle: event.title || 'Esports Match',
        prizePool: totalPrizePool,
        currency: event.currency || 'NPR',
        winners: validTiers,
        participants,
      });

      showToast(res.message, 'success');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('[PrizeDistributionModal] Distribution error:', err);
      showToast(err.message || 'Failed to distribute prizes', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Finalize Results & Distribute Prizes" maxWidth="max-w-4xl">
      <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-1">
        {/* Header Summary */}
        <div className="rounded-2xl bg-gradient-to-r from-amber-500/10 via-brand-500/10 to-purple-500/10 border border-amber-500/30 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-tight">
                {event?.title || 'Esports Competition'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Assign winners and credit prize money directly into players' NexPlay wallets.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
            <div className="bg-dark/80 px-4 py-2 rounded-xl border border-gray-800 text-right">
              <span className="block text-[10px] text-gray-500 font-black uppercase tracking-widest">Total Prize Pool</span>
              <span className="text-base sm:text-lg font-black text-amber-400">
                Rs. {totalPrizePool.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-brand-400" /> Quick Split Presets
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'top3', label: 'Top 3 (50 / 30 / 20%)' },
              { id: 'top2', label: 'Top 2 (70 / 30%)' },
              { id: 'all', label: 'Winner Takes All (100%)' },
              { id: 'top5', label: 'Top 5 (40/25/15/10/10%)' },
              { id: 'equal', label: 'Equal Split' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id as any)}
                className="px-3 py-1.5 rounded-lg bg-surface hover:bg-card border border-gray-700/80 text-xs font-semibold text-gray-200 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Winner Tiers Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black uppercase tracking-widest text-gray-400">
              Winner Standings & Prize Allocation
            </label>
            <button
              type="button"
              onClick={handleAddTier}
              className="inline-flex items-center gap-1 text-xs font-bold text-brand-400 hover:text-brand-300"
            >
              <Plus className="w-3.5 h-3.5" /> Add Rank Tier
            </button>
          </div>

          <div className="space-y-2.5">
            {tiers.map((tier, idx) => (
              <div
                key={idx}
                className="bg-dark/80 border border-gray-800 rounded-xl p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center hover:border-gray-700 transition-colors"
              >
                {/* Rank Badge */}
                <div className="sm:col-span-2 flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                      tier.rank === 1
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        : tier.rank === 2
                        ? 'bg-slate-300/20 text-slate-300 border border-slate-300/40'
                        : tier.rank === 3
                        ? 'bg-amber-700/20 text-amber-600 border border-amber-700/40'
                        : 'bg-surface text-gray-400 border border-gray-800'
                    }`}
                  >
                    #{tier.rank}
                  </div>
                  <span className="text-xs font-bold text-gray-400 sm:hidden">Rank #{tier.rank}</span>
                </div>

                {/* Team / Player Selector */}
                <div className="sm:col-span-5">
                  <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1 sm:hidden">
                    Select Winner Team / Player
                  </label>
                  {candidateOptions.length > 0 ? (
                    <select
                      value={tier.teamName}
                      onChange={(e) => handleSelectTeam(idx, e.target.value)}
                      className="w-full bg-surface border border-gray-700 rounded-lg px-3 py-2 text-xs font-semibold text-white focus:border-brand-500 focus-visible:outline-none"
                    >
                      <option value="">-- Choose Registered Team / Player --</option>
                      {candidateOptions.map((c, ci) => {
                        const alreadyRank = tiers.find((t, i) => {
                          if (i === idx) return false;
                          const sameId = c.teamId && t.teamId && c.teamId.toLowerCase() === t.teamId.toLowerCase();
                          const sameUser = c.userId && t.userId && c.userId.toLowerCase() === t.userId.toLowerCase();
                          const sameName = c.teamName && t.teamName && c.teamName.trim().toLowerCase() === t.teamName.trim().toLowerCase();
                          return Boolean(sameId || sameUser || sameName);
                        })?.rank;

                        const isSelectedElsewhere = typeof alreadyRank === 'number';

                        return (
                          <option
                            key={ci}
                            value={c.teamName}
                            disabled={isSelectedElsewhere}
                            className={isSelectedElsewhere ? 'text-gray-500 bg-gray-900/90 italic' : 'text-white bg-surface'}
                          >
                            {c.label} {isSelectedElsewhere ? `(Selected: Rank #${alreadyRank})` : ''}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={tier.teamName}
                      onChange={(e) => handleUpdateTier(idx, 'teamName', e.target.value)}
                      placeholder="Enter winning team name..."
                      className="w-full bg-surface border border-gray-700 rounded-lg px-3 py-2 text-xs font-semibold text-white focus:border-brand-500 focus-visible:outline-none"
                    />
                  )}
                </div>

                {/* Prize Amount */}
                <div className="sm:col-span-3">
                  <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1 sm:hidden">
                    Prize Amount (Rs.)
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-bold">
                      Rs.
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={tier.prize || ''}
                      onChange={(e) => handleUpdateTier(idx, 'prize', Number(e.target.value) || 0)}
                      className="w-full bg-surface border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-xs font-bold text-emerald-400 focus:border-emerald-500 focus-visible:outline-none"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Score & Remove */}
                <div className="sm:col-span-2 flex items-center justify-end gap-2">
                  <input
                    type="number"
                    min="0"
                    value={tier.kills || ''}
                    onChange={(e) => handleUpdateTier(idx, 'kills', Number(e.target.value) || 0)}
                    placeholder="Kills"
                    title="Kills"
                    className="w-16 bg-surface border border-gray-700 rounded-lg px-2 py-2 text-xs text-center text-gray-300 focus:border-brand-500 focus-visible:outline-none"
                  />
                  {tiers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTier(idx)}
                      className="p-2 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                      title="Remove tier"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Allocation Status Indicator */}
        <div className="rounded-xl p-4 bg-dark border border-gray-800 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
            <span className="text-gray-400">
              Total Allocated: <strong className="text-white">Rs. {allocatedTotal.toLocaleString()}</strong> / Rs. {totalPrizePool.toLocaleString()}
            </span>
            {remainingToAllocate === 0 ? (
              <span className="text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" /> Exactly Allocated (100%)
              </span>
            ) : remainingToAllocate > 0 ? (
              <span className="text-amber-400 flex items-center gap-1 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20">
                <AlertCircle className="w-3.5 h-3.5" /> Rs. {remainingToAllocate.toLocaleString()} remaining to allocate
              </span>
            ) : (
              <span className="text-rose-400 flex items-center gap-1 bg-rose-500/10 px-2.5 py-1 rounded-md border border-rose-500/20">
                <AlertCircle className="w-3.5 h-3.5" /> Allocated exceeds pool by Rs. {Math.abs(remainingToAllocate).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2.5 rounded-xl border border-gray-700 hover:bg-surface text-gray-300 text-xs font-bold transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDistribute}
            disabled={submitting || (totalPrizePool > 0 && allocatedTotal > totalPrizePool)}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider transition-colors shadow-lg shadow-emerald-600/20 flex items-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Distributing Prizes...</span>
              </>
            ) : (
              <>
                <Award className="w-4 h-4" />
                <span>Confirm & Distribute Prizes</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
