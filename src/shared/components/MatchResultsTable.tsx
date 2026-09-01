import React, { useMemo } from 'react';
import { Trophy, Shield, Crosshair, Award } from 'lucide-react';

export interface TeamResultRow {
  teamId: string;
  teamName: string;
  teamLogo?: string;
  killPoints: number;
  placementPoints: number;
  totalPoints: number;
  rank?: number;
  isCurrentUser?: boolean;
}

interface MatchResultsTableProps {
  results: TeamResultRow[];
  groupName?: string;
  isLoading?: boolean;
}

/**
 * Match Results Table Component
 * Displays match standings in the exact column format:
 * [ # | LOGO | NAME | KILL | PLACEMENT | TOTAL ]
 * Sorted in descending order by TOTAL points, ties resolved by PLACEMENT, then KILL points.
 */
export const MatchResultsTable: React.FC<MatchResultsTableProps> = ({
  results,
  groupName = 'Match Standings',
  isLoading = false
}) => {
  // Sort standings with strict tie-breaker: 1. TOTAL (desc) -> 2. PLACEMENT (desc) -> 3. KILL (desc)
  const sortedStandings = useMemo(() => {
    return [...results].sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }
      if (b.placementPoints !== a.placementPoints) {
        return b.placementPoints - a.placementPoints;
      }
      return b.killPoints - a.killPoints;
    });
  }, [results]);

  if (isLoading) {
    return (
      <div className="w-full bg-[#0d1117] border border-gray-800 rounded-2xl p-8 text-center animate-pulse">
        <div className="h-6 bg-gray-800 rounded w-1/4 mx-auto mb-4"></div>
        <div className="h-10 bg-gray-800/50 rounded mb-2"></div>
        <div className="h-10 bg-gray-800/50 rounded mb-2"></div>
        <div className="h-10 bg-gray-800/50 rounded"></div>
      </div>
    );
  }

  return (
    <div className="w-full bg-[#0d1117] border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* Table Header / Title */}
      <div className="px-6 py-4 bg-[#161b22] border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
            <Trophy className="w-5 h-5" />
          </div>
          <h3 className="text-base font-black text-white uppercase tracking-wider">
            {groupName}
          </h3>
        </div>
        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest bg-black/40 px-3 py-1 rounded-full border border-gray-800">
          {sortedStandings.length} Teams
        </span>
      </div>

      {/* Results Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[620px]">
          <thead>
            <tr className="border-b border-gray-800 text-[11px] font-black uppercase tracking-wider text-gray-400 bg-[#12171f]">
              <th className="py-4 px-4 text-center w-14">#</th>
              <th className="py-4 px-4 w-16">LOGO</th>
              <th className="py-4 px-6">NAME</th>
              <th className="py-4 px-6 text-center">
                <span className="inline-flex items-center gap-1">
                  <Crosshair className="w-3.5 h-3.5 text-red-400" /> KILL
                </span>
              </th>
              <th className="py-4 px-6 text-center">
                <span className="inline-flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-blue-400" /> PLACEMENT
                </span>
              </th>
              <th className="py-4 px-6 text-right">
                <span className="inline-flex items-center gap-1 text-amber-400">
                  <Trophy className="w-3.5 h-3.5" /> TOTAL
                </span>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-800/60 font-mono text-sm">
            {sortedStandings.length > 0 ? (
              sortedStandings.map((team, idx) => {
                const rank = idx + 1;
                const isFirst = rank === 1;
                const isSecond = rank === 2;
                const isThird = rank === 3;

                const rankBadgeColor = isFirst
                  ? 'bg-amber-500 text-black font-black'
                  : isSecond
                  ? 'bg-gray-300 text-black font-black'
                  : isThird
                  ? 'bg-amber-700 text-white font-bold'
                  : 'text-gray-400 font-medium';

                return (
                  <tr
                    key={team.teamId || idx}
                    className={`transition-colors duration-150 hover:bg-gray-800/30 ${
                      team.isCurrentUser
                        ? 'bg-brand-500/10'
                        : isFirst
                        ? 'bg-amber-500/5'
                        : ''
                    }`}
                  >
                    {/* Rank Number */}
                    <td className="py-4 px-4 text-center font-sans">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs ${rankBadgeColor}`}
                      >
                        {rank}
                      </span>
                    </td>

                    {/* LOGO */}
                    <td className="py-4 px-4">
                      <div className="w-10 h-10 rounded-xl bg-gray-900 border border-gray-800 overflow-hidden flex items-center justify-center">
                        {team.teamLogo ? (
                          <img
                            src={team.teamLogo}
                            alt={team.teamName}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Shield className="w-5 h-5 text-gray-600" />
                        )}
                      </div>
                    </td>

                    {/* NAME */}
                    <td className="py-4 px-6 font-sans">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-white text-sm tracking-wide">
                          {team.teamName}
                        </span>
                        {team.isCurrentUser && (
                          <span className="bg-brand-500 text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">
                            YOU
                          </span>
                        )}
                      </div>
                      {isFirst && (
                        <span className="text-[10px] uppercase tracking-widest text-amber-400 font-bold">
                          Current Leader
                        </span>
                      )}
                    </td>

                    {/* KILL */}
                    <td className="py-4 px-6 text-center text-red-400 font-black text-base">
                      {team.killPoints}
                    </td>

                    {/* PLACEMENT */}
                    <td className="py-4 px-6 text-center text-blue-400 font-black text-base">
                      {team.placementPoints}
                    </td>

                    {/* TOTAL */}
                    <td className="py-4 px-6 text-right font-black text-lg text-amber-400">
                      {team.totalPoints}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="py-12 text-center text-gray-500 font-sans">
                  No match results recorded for this group yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MatchResultsTable;
