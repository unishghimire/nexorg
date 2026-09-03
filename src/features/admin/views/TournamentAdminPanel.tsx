import {useParams, useNavigate} from 'react-router-dom';
import { useNotification } from '../../../shared/context/NotificationContext';
import {Settings, Users, Calendar, Trophy, ArrowLeft, ArrowRight, ShieldCheck, Download} from 'lucide-react';
import { AnimatePresence } from 'motion/react';

import { OverviewTab, GroupsTab, MatchesTab, BracketsTab, SettingsTab, ParticipantsTab } from './tournament-admin-tabs';
import { useTournamentAdmin } from '../hooks/useTournamentAdmin';
import TabErrorBoundary from '../../../shared/components/TabErrorBoundary';

export default function TournamentAdminPanel() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showToast } = useNotification();
    
    const { activeTab, discordSending, fetchingParticipants, gameStartGroupId, handleAdvanceRound, handleAssignTeam, handleAutoGenerateGroups, handleCreateGroup, handleDeleteGroup, handleSetGroupRoom, handleDiscord, handleRemoveTeam, handleUpdateStage, handleUpdateStatus, isAddMatchModalOpen, isCreateGroupModalOpen, isManageTeamsModalOpen, isResultUploaderOpen, isUpdateScoreModalOpen, loading, matchScore, newGroup, newMatchData, participants, selectedGroup, selectedMatch, setActiveTab, setGameStartGroupId, setIsAddMatchModalOpen, setIsCreateGroupModalOpen, setIsManageTeamsModalOpen, setIsResultUploaderOpen, setIsUpdateScoreModalOpen, setMatchScore, setNewGroup, setNewMatchData, setParticipants, setSelectedGroup, setSelectedMatch, tournamentEarning, tournament, setTournament, handleAddMatch, handleUpdateScore, handleGenerateBracket, handleGenerateGroupMatches, getTeamName } = useTournamentAdmin(id, navigate, showToast);

    if (loading) {
        return (
            <div className="min-h-[100dvh] pt-24 pb-12 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-brand-500/30 border-t-brand-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!tournament) return null;

    const isScrim = Boolean(tournament.matchType === 'scrims' || (tournament as any).isScrim);

    const tabProps = {
        tournament, setTournament, setParticipants, tournamentEarning, participants, fetchingParticipants, selectedGroup, selectedMatch, setSelectedMatch, matchScore, newGroup, newMatchData, gameStartGroupId, discordSending, isCreateGroupModalOpen, isManageTeamsModalOpen, isUpdateScoreModalOpen, isResultUploaderOpen, isAddMatchModalOpen, setNewGroup, setSelectedGroup, setGameStartGroupId, setMatchScore, setNewMatchData, setIsCreateGroupModalOpen, setIsManageTeamsModalOpen, setIsUpdateScoreModalOpen, setIsResultUploaderOpen, setIsAddMatchModalOpen, handleUpdateStatus, handleUpdateStage, handleAdvanceRound, handleAutoGenerateGroups, handleCreateGroup, handleDeleteGroup, handleSetGroupRoom, handleAssignTeam, handleRemoveTeam, handleDiscord, handleAddMatch, handleUpdateScore, handleGenerateBracket, handleGenerateGroupMatches, getTeamName, showToast
    };

    return (
        <div className="min-h-[100dvh] pt-20 sm:pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col gap-4 mb-6 sm:mb-8">
                {/* Top row: back button + title */}
                <div className="flex items-center gap-3 sm:gap-6">
                    <button type="button" 
                        onClick={() => navigate(`/tournaments/${tournament.id}`)}
                        className="p-2.5 sm:p-3 bg-dark border border-gray-800 rounded-full text-gray-400 hover:text-white hover:border-brand-500 transition-colors hover:bg-card shrink-0 touch-target"
                        aria-label="Back to tournament"
                    >
                        <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <div className="min-w-0 flex-1">
                        <h1 className="text-xl sm:text-2xl lg:text-3xl font-black uppercase tracking-tighter text-white flex items-center gap-2 sm:gap-4">
                            <Settings className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-brand-500 shrink-0" />
                            <span className="truncate">Admin Panel</span>
                        </h1>
                        <p className="text-xs sm:text-sm text-gray-500 font-bold tracking-wide uppercase mt-1 truncate">{tournament.title}</p>
                    </div>
                </div>

                {/* Bottom row: status badges + export — wraps on mobile */}
                <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                    <button type="button" 
                        onClick={() => {
                            const headers = "Team Name,Username,In-Game ID,In-Game Name,Status\n";
                            const rows = participants.map(p => 
                              `"${(p.teamName || 'Solo').replace(/"/g, '""')}","${(p.username || '').replace(/"/g, '""')}","${(p.inGameId || '').replace(/"/g, '""')}","${(p.inGameName || '').replace(/"/g, '""')}","${p.status || ''}"`
                            ).join("\n");
                            const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement("a");
                            link.setAttribute("href", url);
                            link.setAttribute("download", `${(tournament.title || 'tournament').replace(/[^a-zA-Z0-9]/g, '_')}_participants.csv`);
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            URL.revokeObjectURL(url);
                        }}
                        className="bg-dark border border-gray-800 hover:border-brand-500 text-gray-500 hover:text-white p-2.5 sm:p-3 rounded-full transition-colors touch-target flex items-center justify-center"
                        title="Export Participants"
                        aria-label="Export participants"
                    >
                        <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <span className={`px-3 sm:px-5 py-2 rounded-full text-xs font-black uppercase tracking-widest ${
                        tournament.status === 'live' ? 'bg-green-500/10 text-green-500 border border-green-500/30' :
                        tournament.status === 'completed' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/30' :
                        'bg-yellow-500/10 text-yellow-500 border border-yellow-500/30'
                    }`}>
                        {tournament.status}
                    </span>
                    <span className="px-3 sm:px-5 py-2 rounded-full text-xs font-black uppercase tracking-widest bg-brand-500/10 text-brand-400 border border-brand-500/30">
                        {tournament.stage || 'registration'}
                    </span>
                    {(tournament.matchType === 'scrims' || (tournament as any).isScrim) && (
                        <button type="button"
                            onClick={() => navigate(`/organizer/scrim/${tournament.id}`)}
                            className="px-3 sm:px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 transition-colors flex items-center gap-1.5"
                        >
                            <span>Scrim Slot View</span>
                            <ArrowRight className="w-3 h-3" />
                        </button>
                    )}
                </div>
            </div>

            {/* Navigation Tabs — scrollable on mobile, wrap on desktop */}
            <div className="flex overflow-x-auto gap-2 sm:gap-3 mb-6 sm:mb-8 pb-2 custom-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
                {(isScrim ? [
                    { id: 'overview', label: 'Overview', icon: Settings },
                    { id: 'matches', label: 'Match Schedule', icon: Calendar },
                    { id: 'participants', label: 'Registrations', icon: ShieldCheck },
                    { id: 'settings', label: 'Settings', icon: Settings },
                ] : [
                    { id: 'overview', label: 'Overview', icon: Settings },
                    { id: 'groups', label: 'Groups & Teams', icon: Users },
                    { id: 'matches', label: 'Match Schedule', icon: Calendar },
                    { id: 'brackets', label: 'Brackets', icon: Trophy },
                    { id: 'settings', label: 'Settings', icon: Settings },
                    { id: 'participants', label: 'Registrations', icon: ShieldCheck },
                ]).map(tab => (
                    <button type="button"
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-4 sm:px-6 lg:px-8 py-3 sm:py-4 rounded-full text-xs sm:text-xs font-black uppercase tracking-widest whitespace-nowrap transition-colors shrink-0 ${
                            activeTab === tab.id 
                                ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' 
                                : 'bg-dark/50 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
                        }`}
                    >
                        <tab.icon className="w-4 h-4" /> {tab.label}
                    </button>
                ))}
            </div>

            {/* ponytail: shared tabProps — built once, spread to each tab */}
            <div className="bg-dark/50 rounded-2xl sm:rounded-[2rem] border border-gray-800 p-4 sm:p-6 lg:p-8">
                <AnimatePresence mode="wait">
                    {activeTab === 'overview' && <TabErrorBoundary tabName="Overview Tab" resetKey={activeTab}><OverviewTab {...tabProps} /></TabErrorBoundary>}
                    {!isScrim && activeTab === 'groups' && <TabErrorBoundary tabName="Groups Tab" resetKey={activeTab}><GroupsTab {...tabProps} /></TabErrorBoundary>}
                    {activeTab === 'matches' && <TabErrorBoundary tabName="Matches Tab" resetKey={activeTab}><MatchesTab {...tabProps} /></TabErrorBoundary>}
                    {!isScrim && activeTab === 'brackets' && <TabErrorBoundary tabName="Brackets Tab" resetKey={activeTab}><BracketsTab {...tabProps} /></TabErrorBoundary>}
                    {activeTab === 'settings' && <TabErrorBoundary tabName="Settings Tab" resetKey={activeTab}><SettingsTab {...tabProps} /></TabErrorBoundary>}
                    {activeTab === 'participants' && <TabErrorBoundary tabName="Participants Tab" resetKey={activeTab}><ParticipantsTab {...tabProps} /></TabErrorBoundary>}
                </AnimatePresence>
            </div>
        </div>
    );
}
