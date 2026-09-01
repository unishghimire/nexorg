import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Calendar, Clock, Users, MapPin, Layers, Loader2 } from 'lucide-react';
import { TournamentAdminTabProps } from './types';
import Modal from '../../../../shared/components/Modal';
import ResultUploader from '../../../results/components/ResultUploader';
import PerKillResultUploader from '../../../tournaments/components/PerKillResultUploader';
import { isBRTournament } from '../../../../shared/services/tournamentEngine';
import { getMapsForGame } from '../../../../shared/constants/constants';

export const MatchesTab: React.FC<TournamentAdminTabProps> = (props) => {
    const {
        tournament, selectedGroup, selectedMatch, matchScore, newMatchData,
        isUpdateScoreModalOpen, isResultUploaderOpen, isAddMatchModalOpen,
        setSelectedMatch, setSelectedGroup, setMatchScore, setNewMatchData,
        setIsUpdateScoreModalOpen, setIsResultUploaderOpen, setIsAddMatchModalOpen,
        handleAddMatch, handleUpdateScore, getTeamName,
    } = props;

    const [isSubmitting, setIsSubmitting] = useState(false);
    const isBR = isBRTournament(tournament);
    const availableMaps = getMapsForGame(tournament.game);

    const onAddMatchClick = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            await handleAddMatch();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <motion.div
                key="matches"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4 sm:space-y-6"
            >
                <div className="flex justify-between items-center border-b border-gray-800 pb-3 sm:pb-4">
                    <div>
                        <h2 className="text-base sm:text-lg font-black uppercase tracking-widest text-white">Match Schedule</h2>
                        <p className="text-xs text-gray-500 font-bold mt-0.5">
                            {isBR ? 'Battle Royale Lobby Matches (Group-wide)' : '1v1 Head-to-Head Matches'}
                        </p>
                    </div>
                </div>

                {tournament.groups && tournament.groups.some(g => g.matches.length > 0) ? (
                    <div className="space-y-8">
                        {tournament.groups.map(group => group.matches.length > 0 && (
                            <div key={group.id} className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-black text-brand-500 uppercase tracking-widest flex items-center gap-2">
                                        <span>{group.name} Matches</span>
                                        <span className="text-xs font-bold text-gray-500 bg-dark px-2 py-0.5 rounded border border-gray-800">
                                            {group.matches.length} {group.matches.length === 1 ? 'Match' : 'Matches'}
                                        </span>
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedGroup(group);
                                            setIsAddMatchModalOpen(true);
                                        }}
                                        className="text-xs font-black text-brand-400 hover:text-brand-300 uppercase tracking-wider transition-colors"
                                    >
                                        + Add Match
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                                    {group.matches.map((match, mIdx) => {
                                        const team1 = group.teams.find(t => t.id === match.team1Id);
                                        const team2 = group.teams.find(t => t.id === match.team2Id);
                                        return (
                                            <div key={match.id} className="bg-surface border border-gray-800 rounded-xl p-3 sm:p-4 shadow-lg hover:border-brand-500/20 transition-colors flex flex-col justify-between">
                                                <div className="flex justify-between items-center mb-3">
                                                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                                        R{match.round || tournament.currentRound || 1} • Match #{match.matchNumber || mIdx + 1}
                                                    </span>
                                                    {match.map && (
                                                        <span className="text-[10px] font-black text-brand-500 uppercase tracking-widest ml-2 bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/10">
                                                            {match.map}
                                                        </span>
                                                    )}
                                                </div>

                                                {isBR ? (
                                                    <div className="space-y-2.5 mb-4">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-black text-white uppercase tracking-wider">
                                                                {group.name} Lobby
                                                            </span>
                                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                                                                match.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                                                match.status === 'live' ? 'bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse' :
                                                                'bg-gray-800 text-gray-400'
                                                            }`}>
                                                                {match.status}
                                                            </span>
                                                        </div>
                                                        <div className="bg-dark p-2.5 rounded-lg border border-gray-800 flex items-center justify-between text-xs font-bold text-gray-400">
                                                            <span className="flex items-center gap-1.5 text-white">
                                                                <Users className="w-3.5 h-3.5 text-brand-400" />
                                                                {group.teams.length} Teams in Lobby
                                                            </span>
                                                            {match.scheduledTime && (
                                                                <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                                                    <Clock className="w-3 h-3" />
                                                                    {new Date(match.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-3 mb-4">
                                                        <div className="flex justify-between items-center bg-dark p-2 rounded-lg border border-gray-800">
                                                            <span className="text-[11px] font-bold text-white truncate max-w-[80px] sm:max-w-[120px] uppercase tracking-tight">{team1?.name || 'TBD'}</span>
                                                            <span className="text-md font-black text-brand-500">{match.score1}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center bg-dark p-2 rounded-lg border border-gray-800">
                                                            <span className="text-[11px] font-bold text-white truncate max-w-[80px] sm:max-w-[120px] uppercase tracking-tight">{team2?.name || 'TBD'}</span>
                                                            <span className="text-md font-black text-brand-500">{match.score2}</span>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="grid grid-cols-2 gap-2 mt-auto pt-4 border-t border-gray-800">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedMatch({ groupId: group.id, match });
                                                            setMatchScore({ score1: match.score1, score2: match.score2, status: match.status, map: match.map || '' });
                                                            setIsUpdateScoreModalOpen(true);
                                                        }}
                                                        className="bg-dark hover:bg-surface text-gray-400 py-2.5 min-h-[44px] rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors border border-gray-800"
                                                    >
                                                        {isBR ? 'Details' : 'Score'}
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            const g = tournament.groups?.find(gr => gr.id === group.id);
                                                            if (g) {
                                                                setSelectedGroup(g);
                                                                setSelectedMatch({ groupId: group.id, match });
                                                                setIsResultUploaderOpen(true);
                                                            }
                                                        }}
                                                        className="bg-brand-600/10 hover:bg-brand-600 text-brand-500 hover:text-white py-2.5 min-h-[44px] rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors border border-brand-500/20"
                                                    >
                                                        Result
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-400 font-medium">No matches scheduled.</p>
                        <p className="text-sm text-gray-500 mt-2">Generate matches from the Groups tab or add matches directly.</p>
                    </div>
                )}
            </motion.div>

            {/* Update Score / Details Modal */}
            <Modal isOpen={isUpdateScoreModalOpen} onClose={() => setIsUpdateScoreModalOpen(false)} title={isBR ? "Update Match Details" : "Update Match Score"}>
                {selectedMatch && (
                    <div className="space-y-4 sm:space-y-6">
                        {!isBR && (
                            <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                <div className="bg-dark p-4 rounded-xl border border-gray-800 text-center">
                                    <p className="text-xs font-bold text-gray-500 uppercase mb-2">
                                        {getTeamName(selectedMatch.match.team1Id || 'TBD')}
                                    </p>
                                    <input
                                        type="number"
                                        value={matchScore.score1}
                                        onChange={(e) => setMatchScore({...matchScore, score1: parseInt(e.target.value) || 0})}
                                        className="w-full bg-surface border border-gray-700 text-white text-center text-2xl font-black rounded-lg p-2 focus:border-brand-500 focus-visible:outline-none transition"
                                    />
                                </div>
                                <div className="bg-dark p-4 rounded-xl border border-gray-800 text-center">
                                    <p className="text-xs font-bold text-gray-500 uppercase mb-2">
                                        {getTeamName(selectedMatch.match.team2Id || 'TBD')}
                                    </p>
                                    <input
                                        type="number"
                                        value={matchScore.score2}
                                        onChange={(e) => setMatchScore({...matchScore, score2: parseInt(e.target.value) || 0})}
                                        className="w-full bg-surface border border-gray-700 text-white text-center text-2xl font-black rounded-lg p-2 focus:border-brand-500 focus-visible:outline-none transition"
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <label htmlFor="map-name" className="block text-xs font-bold text-gray-500 uppercase mb-2">Map Name</label>
                            <input
                                type="text"
                                value={matchScore.map || ''}
                                onChange={(e) => setMatchScore({...matchScore, map: e.target.value})}
                                placeholder={`e.g., ${availableMaps[0] || 'Bermuda'}`}
                                className="w-full bg-dark border border-gray-800 text-white rounded-xl p-3 focus:border-brand-500 focus-visible:outline-none transition"
                            />
                        </div>

                        <div>
                            <label htmlFor="match-status" className="block text-xs font-bold text-gray-500 uppercase mb-2">Match Status</label>
                            <select
                                value={matchScore.status}
                                onChange={(e) => setMatchScore({...matchScore, status: e.target.value as any})}
                                className="w-full bg-dark border border-gray-800 text-white rounded-xl p-3 focus:border-brand-500 focus-visible:outline-none transition"
                            >
                                <option value="scheduled">Scheduled</option>
                                <option value="live">Live</option>
                                <option value="completed">Completed</option>
                            </select>
                        </div>

                        <div className="pt-4 flex gap-3">
                            <button
                                onClick={() => setIsUpdateScoreModalOpen(false)}
                                className="flex-1 bg-dark hover:bg-surface text-white py-3 rounded-xl font-bold transition border border-gray-800"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdateScore}
                                className="flex-1 bg-brand-600 hover:bg-brand-500 text-white py-3 rounded-xl font-bold transition"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Result Uploader */}
            {selectedMatch && selectedGroup && isResultUploaderOpen && (
                (tournament as any).tournamentMode === 'PER_KILL_REWARD' ? (
                    <PerKillResultUploader
                        isOpen={isResultUploaderOpen}
                        onClose={() => setIsResultUploaderOpen(false)}
                        tournament={tournament}
                        group={selectedGroup}
                        match={selectedMatch.match}
                        onSuccess={() => setIsResultUploaderOpen(false)}
                    />
                ) : (
                    <ResultUploader
                        isOpen={isResultUploaderOpen}
                        onClose={() => setIsResultUploaderOpen(false)}
                        tournament={tournament}
                        group={selectedGroup}
                        match={selectedMatch.match}
                        onSuccess={() => setIsResultUploaderOpen(false)}
                    />
                )
            )}

            {/* Add Match Modal */}
            <Modal isOpen={isAddMatchModalOpen} onClose={() => !isSubmitting && setIsAddMatchModalOpen(false)} title={`Add Match to ${selectedGroup?.name}`}>
                {selectedGroup && (
                    <div className="space-y-4">
                        {isBR ? (
                            /* Battle Royale Match Configuration */
                            <>
                                <div className="bg-brand-500/10 border border-brand-500/20 rounded-xl p-3.5 flex items-start gap-3">
                                    <Users className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" />
                                    <div className="text-xs space-y-1">
                                        <p className="font-black text-white uppercase tracking-wider">Battle Royale Group Match</p>
                                        <p className="text-gray-400">
                                            All <span className="text-brand-400 font-bold">{selectedGroup.teams.length} teams</span> registered in <span className="text-white font-bold">{selectedGroup.name}</span> will participate together in this lobby match.
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                    <div>
                                        <label htmlFor="br-map" className="block text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1">
                                            <MapPin className="w-3.5 h-3.5 text-brand-400" /> Map
                                        </label>
                                        <select
                                            id="br-map"
                                            value={newMatchData.map || availableMaps[0]}
                                            onChange={(e) => setNewMatchData({ ...newMatchData, map: e.target.value })}
                                            className="w-full bg-dark border border-gray-800 text-white rounded-xl p-3 focus:border-brand-500 focus-visible:outline-none transition text-sm font-medium"
                                        >
                                            {availableMaps.map((mapName) => (
                                                <option key={mapName} value={mapName}>{mapName}</option>
                                            ))}
                                            <option value="Custom">Custom Map</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label htmlFor="br-count" className="block text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1">
                                            <Layers className="w-3.5 h-3.5 text-brand-400" /> Matches to Add
                                        </label>
                                        <input
                                            id="br-count"
                                            type="number"
                                            min="1"
                                            max="10"
                                            value={newMatchData.matchCount || 1}
                                            onChange={(e) => setNewMatchData({ ...newMatchData, matchCount: Math.max(1, parseInt(e.target.value) || 1) })}
                                            className="w-full bg-dark border border-gray-800 text-white rounded-xl p-3 focus:border-brand-500 focus-visible:outline-none transition text-sm font-medium"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                    <div>
                                        <label htmlFor="br-round" className="block text-xs font-bold text-gray-500 uppercase mb-2">Round</label>
                                        <input
                                            id="br-round"
                                            type="number"
                                            min="1"
                                            value={newMatchData.round || tournament.currentRound || 1}
                                            onChange={(e) => setNewMatchData({ ...newMatchData, round: parseInt(e.target.value) || 1 })}
                                            className="w-full bg-dark border border-gray-800 text-white rounded-xl p-3 focus:border-brand-500 focus-visible:outline-none transition text-sm font-medium"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="br-time" className="block text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1">
                                            <Clock className="w-3.5 h-3.5 text-brand-400" /> Match Time (Optional)
                                        </label>
                                        <input
                                            id="br-time"
                                            type="datetime-local"
                                            value={newMatchData.scheduledTime || ''}
                                            onChange={(e) => setNewMatchData({ ...newMatchData, scheduledTime: e.target.value })}
                                            className="w-full bg-dark border border-gray-800 text-white rounded-xl p-3 focus:border-brand-500 focus-visible:outline-none transition text-sm font-medium"
                                        />
                                    </div>
                                </div>
                            </>
                        ) : (
                            /* 1v1 / Head-to-Head Match Configuration */
                            <>
                                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                    <div>
                                        <label htmlFor="team-1" className="block text-xs font-bold text-gray-500 uppercase mb-2">Team 1</label>
                                        <select
                                            id="team-1"
                                            value={newMatchData.team1Id}
                                            onChange={(e) => setNewMatchData({...newMatchData, team1Id: e.target.value})}
                                            className="w-full bg-dark border border-gray-800 text-white rounded-xl p-3 focus:border-brand-500 focus-visible:outline-none transition"
                                        >
                                            <option value="">Select Team</option>
                                            <option value="TBD">TBD</option>
                                            {selectedGroup.teams.map(team => (
                                                <option key={team.id} value={team.id}>{team.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="team-2" className="block text-xs font-bold text-gray-500 uppercase mb-2">Team 2</label>
                                        <select
                                            id="team-2"
                                            value={newMatchData.team2Id}
                                            onChange={(e) => setNewMatchData({...newMatchData, team2Id: e.target.value})}
                                            className="w-full bg-dark border border-gray-800 text-white rounded-xl p-3 focus:border-brand-500 focus-visible:outline-none transition"
                                        >
                                            <option value="">Select Team</option>
                                            <option value="TBD">TBD</option>
                                            {selectedGroup.teams.map(team => (
                                                <option key={team.id} value={team.id}>{team.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                    <div>
                                        <label htmlFor="match-round" className="block text-xs font-bold text-gray-500 uppercase mb-2">Round</label>
                                        <input
                                            id="match-round"
                                            type="number"
                                            value={newMatchData.round}
                                            onChange={(e) => setNewMatchData({...newMatchData, round: parseInt(e.target.value) || 1})}
                                            className="w-full bg-dark border border-gray-800 text-white rounded-xl p-3 focus:border-brand-500 focus-visible:outline-none transition"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="match-map" className="block text-xs font-bold text-gray-500 uppercase mb-2">Map</label>
                                        <input
                                            id="match-map"
                                            type="text"
                                            value={newMatchData.map}
                                            onChange={(e) => setNewMatchData({...newMatchData, map: e.target.value})}
                                            placeholder={`e.g., ${availableMaps[0] || 'Bermuda'}`}
                                            className="w-full bg-dark border border-gray-800 text-white rounded-xl p-3 focus:border-brand-500 focus-visible:outline-none transition"
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        <div className="pt-4 flex gap-3">
                            <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => setIsAddMatchModalOpen(false)}
                                className="flex-1 bg-dark hover:bg-surface text-white py-3 rounded-xl font-bold transition border border-gray-800 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={onAddMatchClick}
                                disabled={isSubmitting || (!isBR && (!newMatchData.team1Id || !newMatchData.team2Id))}
                                className="flex-1 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold transition flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Adding...</span>
                                    </>
                                ) : (
                                    <span>{isBR ? `Create Match${(newMatchData.matchCount || 1) > 1 ? 'es' : ''}` : 'Create Match'}</span>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );
};
