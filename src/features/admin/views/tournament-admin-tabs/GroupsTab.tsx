import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
    Plus, Trash2, Users, CheckCircle2, Key, Save,
} from 'lucide-react';
import { TournamentAdminTabProps } from './types';
import Modal from '../../../../shared/components/Modal';
import { isBRTournament } from '../../../../shared/services/tournamentEngine';

export const GroupsTab: React.FC<TournamentAdminTabProps> = (props) => {
    const {
        tournament, participants, fetchingParticipants,
        selectedGroup, newGroup, isCreateGroupModalOpen, isManageTeamsModalOpen,
        setNewGroup, setSelectedGroup, setIsCreateGroupModalOpen, setIsManageTeamsModalOpen,
        setIsAddMatchModalOpen,
        handleAutoGenerateGroups, handleCreateGroup, handleDeleteGroup,
        handleAssignTeam, handleRemoveTeam, handleGenerateGroupMatches,
        handleSetGroupRoom, } = props;

    // ponytail: compute available teams locally — moved from main file with the modal
    const groupedParticipants = participants.reduce((acc: any, p) => {
        const teamKey = p.teamId || p.userId;
        if (!acc[teamKey]) {
            acc[teamKey] = {
                id: teamKey,
                name: p.teamName || p.username,
                logoUrl: p.logoUrl,
                players: p.teammates ? [p.username, ...p.teammates] : [p.username],
                participantId: p.id
            };
        }
        return acc;
    }, {});

    const availableTeams = Object.values(groupedParticipants).filter((team: any) => {
        return !tournament?.groups?.some(g => g.teams.some(t => t.id === team.id));
    });
    return (<>
                        <motion.div 
                            key="groups"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-4 sm:space-y-6"
                        >
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-gray-800 pb-4">
                                <h2 className="text-base sm:text-lg font-black uppercase tracking-widest text-white">Groups Management</h2>
                                <div className="flex gap-2 flex-wrap">
                                    <button type="button" 
                                        onClick={handleAutoGenerateGroups}
                                        className="bg-purple-600 hover:bg-purple-500 text-white px-3 sm:px-4 py-2.5 min-h-[44px] rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-colors flex-1 sm:flex-none justify-center"
                                    >
                                        <CheckCircle2 className="w-4 h-4 shrink-0" /> <span className="truncate">Auto Generate</span>
                                    </button>
                                    <button type="button" 
                                        onClick={() => setIsCreateGroupModalOpen(true)}
                                        className="bg-brand-600 hover:bg-brand-500 text-white px-3 sm:px-4 py-2.5 min-h-[44px] rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-colors flex-1 sm:flex-none justify-center"
                                    >
                                        <Plus className="w-4 h-4 shrink-0" /> <span className="truncate">Create Group</span>
                                    </button>
                                </div>
                            </div>
                            
                            {tournament.groups && tournament.groups.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                                    {tournament.groups.map(group => (
                                        <GroupCard
                                            key={group.id}
                                            group={group}
                                            isBR={isBRTournament(tournament)}
                                            onDelete={handleDeleteGroup}
                                            onSetRoom={handleSetGroupRoom}
                                            onAddMatch={() => { setSelectedGroup(group); setIsAddMatchModalOpen(true); }}
                                            onManageTeams={() => { setSelectedGroup(group); setIsManageTeamsModalOpen(true); }}
                                            onGenerateMatches={(mode) => handleGenerateGroupMatches(group.id, mode)}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                                    <p className="text-gray-400 font-medium">No groups created yet.</p>
                                    <p className="text-sm text-gray-500 mt-2">Create groups to organize teams for the group stage.</p>
                                </div>
                            )}
                        </motion.div>

            {/* Create Group Modal */}
            <Modal isOpen={isCreateGroupModalOpen} onClose={() => setIsCreateGroupModalOpen(false)} title="Create New Group">
                <div className="space-y-4">
                    <div>
                        <label htmlFor="group-name" className="block text-xs font-bold text-gray-500 uppercase mb-2">Group Name</label>
                        <input 
                            type="text" 
                            value={newGroup.name}
                            onChange={(e) => setNewGroup({...newGroup, name: e.target.value})}
                            placeholder="e.g., Group A, Region East"
                            className="w-full bg-dark border border-gray-800 text-white rounded-xl p-3 focus:border-brand-500 focus-visible:outline-none transition"
                        />
                    </div>
                    <div>
                        <label htmlFor="team-limit" className="block text-xs font-bold text-gray-500 uppercase mb-2">Team Limit</label>
                        <input 
                            type="number" 
                            value={newGroup.teamLimit}
                            onChange={(e) => setNewGroup({...newGroup, teamLimit: parseInt(e.target.value) || 0})}
                            className="w-full bg-dark border border-gray-800 text-white rounded-xl p-3 focus:border-brand-500 focus-visible:outline-none transition"
                        />
                    </div>
                    <div className="flex items-center justify-between bg-dark p-3 rounded-xl border border-gray-800">
                        <div>
                            <p className="text-sm font-bold text-white">Public Group</p>
                            <p className="text-xs text-gray-500">Anyone can join if they have the link</p>
                        </div>
                        <button type="button" 
                            onClick={() => setNewGroup({...newGroup, isPublic: !newGroup.isPublic})}
                            className={`w-12 h-6 rounded-full transition-colors relative ${newGroup.isPublic ? 'bg-brand-500' : 'bg-surface'}`}
                        >
                            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${newGroup.isPublic ? 'translate-x-7' : 'translate-x-1'}`} />
                        </button>
                    </div>
                    {!newGroup.isPublic && (
                        <div>
                            <label htmlFor="group-passcode" className="block text-xs font-bold text-gray-500 uppercase mb-2">Passcode</label>
                            <input 
                                type="text" 
                                value={newGroup.passCode}
                                onChange={(e) => setNewGroup({...newGroup, passCode: e.target.value})}
                                placeholder="Enter a secure passcode"
                                className="w-full bg-dark border border-gray-800 text-white rounded-xl p-3 focus:border-brand-500 focus-visible:outline-none transition"
                            />
                        </div>
                    )}
                    <div className="pt-4 flex gap-3">
                        <button type="button" 
                            onClick={() => setIsCreateGroupModalOpen(false)}
                            className="flex-1 bg-dark hover:bg-surface text-white py-3 rounded-xl font-bold transition border border-gray-800"
                        >
                            Cancel
                        </button>
                        <button type="button" 
                            onClick={handleCreateGroup}
                            disabled={!newGroup.name.trim()}
                            className="flex-1 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold transition"
                        >
                            Create Group
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Manage Teams Modal */}
            <Modal isOpen={isManageTeamsModalOpen} onClose={() => setIsManageTeamsModalOpen(false)} title={`Manage Teams: ${selectedGroup?.name}`} maxWidth="max-w-4xl">
                {selectedGroup && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 h-[50vh] sm:h-[60vh]">
                        {/* Assigned Teams */}
                        <div className="flex flex-col h-full bg-dark rounded-xl border border-gray-800 overflow-hidden">
                            <div className="p-4 border-b border-gray-800 bg-surface flex justify-between items-center">
                                <h3 className="font-black text-white uppercase tracking-widest text-sm">Assigned Teams</h3>
                                <span className="text-xs font-bold text-gray-500">{selectedGroup.teams.length} / {selectedGroup.teamLimit}</span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                                {selectedGroup.teams.length > 0 ? (
                                    selectedGroup.teams.map(team => (
                                        <div key={team.id} className="flex justify-between items-center p-3 bg-surface rounded-lg border border-gray-800">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-surface overflow-hidden">
                                                    {team.logoUrl ? (
                                                        <img src={team.logoUrl} alt={team.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-500">
                                                            {team.name.charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-white">{team.name}</p>
                                                    <p className="text-[10px] text-gray-500">{team.players.length} Players</p>
                                                </div>
                                            </div>
                                            <button type="button" 
                                                onClick={() => handleRemoveTeam(team.id)}
                                                className="text-gray-500 hover:text-red-500 transition-colors p-2"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-500">
                                        <Users className="w-8 h-8 mb-2 opacity-50" />
                                        <p className="text-sm">No teams assigned yet</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Available Teams */}
                        <div className="flex flex-col h-full bg-dark rounded-xl border border-gray-800 overflow-hidden">
                            <div className="p-4 border-b border-gray-800 bg-surface flex justify-between items-center">
                                <h3 className="font-black text-white uppercase tracking-widest text-sm">Available Teams</h3>
                                <span className="text-xs font-bold text-gray-500">{availableTeams.length} Total</span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                                {fetchingParticipants ? (
                                    <div className="h-full flex items-center justify-center">
                                        <div className="w-6 h-6 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin"></div>
                                    </div>
                                ) : availableTeams.length > 0 ? (
                                    availableTeams.map((team: any) => (
                                        <div key={team.id} className="flex justify-between items-center p-3 bg-surface rounded-lg border border-gray-800">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-surface overflow-hidden">
                                                    {team.logoUrl ? (
                                                        <img src={team.logoUrl} alt={team.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-500">
                                                            {team.name.charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-white">{team.name}</p>
                                                    <p className="text-[10px] text-gray-500">{team.players.length} Players</p>
                                                </div>
                                            </div>
                                            <button type="button" 
                                                onClick={() => handleAssignTeam(team.participantId)}
                                                disabled={selectedGroup.teams.length >= selectedGroup.teamLimit}
                                                className="bg-brand-600/10 hover:bg-brand-600/20 text-brand-500 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-colors"
                                            >
                                                Assign
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-500">
                                        <Users className="w-8 h-8 mb-2 opacity-50" />
                                        <p className="text-sm text-center px-4">All registered teams have been assigned to groups.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            </>
        );
};

// ─── GroupCard with per-group room credentials ────────────────────────
interface GroupCardProps {
    group: import('../../../../shared/types/types').TournamentGroup;
    isBR?: boolean;
    onDelete: (groupId: string) => void;
    onSetRoom: (groupId: string, field: 'roomId' | 'roomPass', value: string) => void;
    onAddMatch: () => void;
    onManageTeams: () => void;
    onGenerateMatches: (mode: 'round-robin' | 'single') => void;
}

function GroupCard({ group, isBR, onDelete, onSetRoom, onAddMatch, onManageTeams, onGenerateMatches }: GroupCardProps) {
    const [showRoom, setShowRoom] = useState(false);
    const [roomId, setRoomId] = useState(group.roomId || '');
    const [roomPass, setRoomPass] = useState(group.roomPass || '');

    // Sync local state when group updates from Firestore
    React.useEffect(() => {
        setRoomId(group.roomId || '');
        setRoomPass(group.roomPass || '');
    }, [group.roomId, group.roomPass]);

    const saveRoom = () => {
        onSetRoom(group.id, 'roomId', roomId);
        onSetRoom(group.id, 'roomPass', roomPass);
        setShowRoom(false);
    };

    return (
        <div className="bg-surface border border-gray-800 rounded-2xl p-4 sm:p-5 hover:border-brand-500/20 transition-colors shadow-xl">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-md font-black text-white uppercase tracking-tight">{group.name}</h3>
                    <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-1 font-bold">
                        <Users className="w-3 h-3 text-brand-500" /> {group.teams.length} / {group.teamLimit} TEAMS
                    </div>
                </div>
                <button type="button" 
                    onClick={() => onDelete(group.id)}
                    className="p-2 text-gray-600 hover:text-red-500 transition-colors bg-dark rounded-lg border border-gray-800"
                >
                    <Trash2 className="w-3 h-3" />
                </button>
            </div>

            <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] bg-dark p-2 rounded-lg border border-gray-800 font-bold">
                    <span className="text-gray-500 flex items-center gap-1 uppercase">Access</span>
                    <span className={group.isPublic ? 'text-green-500' : 'text-yellow-500'}>
                        {group.isPublic ? 'PUBLIC' : 'PRIVATE'}
                    </span>
                </div>
                {group.passCode && (
                    <div className="flex items-center justify-between text-[10px] bg-dark p-2 rounded-lg border border-gray-800 font-bold">
                        <span className="text-gray-500 flex items-center gap-1 uppercase">Passcode</span>
                        <span className="text-white font-mono">{group.passCode}</span>
                    </div>
                )}

                {/* Room credentials status / editor */}
                <div className="bg-dark p-2 rounded-lg border border-gray-800">
                    <button
                        onClick={() => setShowRoom(s => !s)}
                        className="flex items-center justify-between w-full text-[10px] font-bold uppercase"
                    >
                        <span className="text-gray-500 flex items-center gap-1">
                            <Key className="w-3 h-3 text-brand-500" /> Room
                        </span>
                        <span className={group.roomId ? 'text-green-500' : 'text-gray-600'}>
                            {group.roomId ? 'SET ✓' : 'NOT SET'}
                        </span>
                    </button>

                    {showRoom && (
                        <div className="mt-2 space-y-2">
                            <input
                                type="text"
                                value={roomId}
                                onChange={e => setRoomId(e.target.value)}
                                placeholder="Room ID"
                                className="w-full bg-black border border-gray-800 text-white rounded-lg p-2 text-xs font-mono focus:border-brand-500 focus-visible:outline-none"
                            />
                            <input
                                type="text"
                                value={roomPass}
                                onChange={e => setRoomPass(e.target.value)}
                                placeholder="Password"
                                className="w-full bg-black border border-gray-800 text-white rounded-lg p-2 text-xs font-mono focus:border-brand-500 focus-visible:outline-none"
                            />
                            <button
                                onClick={saveRoom}
                                className="w-full bg-brand-600 hover:bg-brand-500 text-white py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition"
                            >
                                <Save className="w-3 h-3" /> Save Room
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-800 flex flex-wrap gap-2">
                <button type="button" 
                    onClick={onAddMatch}
                    className="flex-1 min-w-[80px] min-h-[44px] flex items-center justify-center bg-purple-600/10 hover:bg-purple-600/20 text-purple-500 py-2.5 rounded-lg text-[10px] sm:text-[10px] font-black uppercase tracking-widest transition-colors border border-purple-500/10"
                >
                    + Match
                </button>
                <button type="button" 
                    onClick={onManageTeams}
                    className="flex-1 min-w-[80px] min-h-[44px] flex items-center justify-center bg-brand-600/10 hover:bg-brand-600/20 text-brand-500 py-2.5 rounded-lg text-[10px] sm:text-[10px] font-black uppercase tracking-widest transition-colors border border-brand-500/10"
                >
                    Teams
                </button>
                <button type="button" 
                    onClick={() => {
                        if (isBR) {
                            onGenerateMatches('single');
                        } else {
                            if (window.confirm("Generate Round Robin matches? (1v1 for every pair)")) {
                                onGenerateMatches('round-robin');
                            }
                        }
                    }}
                    disabled={group.teams.length < 2}
                    className="w-full min-h-[44px] flex items-center justify-center bg-blue-600/10 hover:bg-blue-600/20 text-blue-500 disabled:opacity-50 disabled:cursor-not-allowed py-2.5 rounded-lg text-[10px] sm:text-[10px] font-black uppercase tracking-widest transition-colors border border-blue-500/10"
                >
                    {isBR ? 'GENERATE BR LOBBY MATCH' : 'GENERATE 1v1 MATCHES'}
                </button>
            </div>
        </div>
    );
}
