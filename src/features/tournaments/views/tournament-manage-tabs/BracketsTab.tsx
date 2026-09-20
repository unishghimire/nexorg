import React from 'react';
import { motion } from 'motion/react';
import {
    Trophy, } from 'lucide-react';
import { TournamentAdminTabProps } from './types';

export const BracketsTab: React.FC<TournamentAdminTabProps> = (props) => {
    const {
        tournament, setSelectedMatch, setMatchScore, setIsUpdateScoreModalOpen, handleGenerateBracket,
        getTeamName, } = props;
    return (
                        <motion.div 
                            key="brackets"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-4 sm:space-y-6"
                        >
                            <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                                <h2 className="text-lg font-black uppercase tracking-widest text-white">Knockout Brackets</h2>
                                <button type="button" 
                                    onClick={handleGenerateBracket}
                                    disabled={tournament.bracketMatches && tournament.bracketMatches.length > 0}
                                    className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Generate Bracket
                                </button>
                            </div>
                            
                            {tournament.bracketMatches && tournament.bracketMatches.length > 0 ? (
                                <div className="overflow-x-auto pb-4 sm:pb-8 custom-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
                                    <div className="flex gap-12 min-w-max">
                                        {/* Group matches by round */}
                                        {Array.from(new Set(tournament.bracketMatches.map(m => m.round))).sort().map(round => {
                                            const roundMatches = tournament.bracketMatches!.filter(m => m.round === round);
                                            return (
                                                <div key={round} className="flex flex-col gap-8 justify-center min-w-[250px]">
                                                    <h3 className="text-center text-sm font-black text-gray-500 uppercase tracking-widest mb-4">
                                                        {round === Math.max(...tournament.bracketMatches!.map(m => m.round)) ? 'Finals' : 
                                                         round === Math.max(...tournament.bracketMatches!.map(m => m.round)) - 1 ? 'Semi-Finals' : 
                                                         `Round ${round}`}
                                                    </h3>
                                                    {roundMatches.map(match => {
                                                        const team1Name = getTeamName(match.team1Id || 'TBD');
                                                        const team2Name = getTeamName(match.team2Id || 'TBD');

                                                        return (
                                                            <div key={match.id} className="bg-surface border border-gray-800 rounded-xl p-4 relative">
                                                                {/* Connector lines could be added here using pseudo-elements or SVGs */}
                                                                <div className="space-y-2">
                                                                    <div className="flex justify-between items-center bg-dark p-2 rounded-lg border border-gray-800">
                                                                        <span className="text-sm font-bold text-white truncate max-w-[100px] sm:max-w-[150px]">{team1Name}</span>
                                                                        <span className="text-lg font-black text-brand-500">{match.score1}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center bg-dark p-2 rounded-lg border border-gray-800">
                                                                        <span className="text-sm font-bold text-white truncate max-w-[100px] sm:max-w-[150px]">{team2Name}</span>
                                                                        <span className="text-lg font-black text-brand-500">{match.score2}</span>
                                                                    </div>
                                                                </div>
                                                                <button type="button" 
                                                                    onClick={() => {
                                                                        setSelectedMatch({ groupId: 'bracket', match });
                                                                        setMatchScore({ score1: match.score1, score2: match.score2, status: match.status, map: match.map || '' });
                                                                        setIsUpdateScoreModalOpen(true);
                                                                    }}
                                                                    className="w-full mt-3 bg-dark hover:bg-surface text-gray-400 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors border border-gray-800"
                                                                >
                                                                    Update
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                                    <p className="text-gray-400 font-medium">Bracket not generated.</p>
                                    <p className="text-sm text-gray-500 mt-2">Advance teams from the group stage to generate the knockout bracket.</p>
                                </div>
                            )}
                        </motion.div>
    );
};
