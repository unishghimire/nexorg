import React, { useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../shared/context/AuthContext';
import { auth } from '../../../shared/config/firebase';
import { useNotification } from '../../../shared/context/NotificationContext';
import DashboardLayout from '../../../shared/components/layouts/DashboardLayout';
import TournamentCreateModal from '../../tournaments/components/TournamentCreateModal';
import ScrimCreateModal from '../../scrims/components/ScrimCreateModal';
import {
  LayoutDashboard, Trophy, Gamepad2, Radio, Users,
  Wallet, Settings as SettingsIcon, Menu, X, ShieldAlert
} from 'lucide-react';
import { useOrgData } from '../hooks/useOrgData';
import { OrgOverlayManager, OverlayType } from '../components/OrgOverlayManager';
import { Seo } from '../../../shared/components/Seo';
import TabErrorBoundary from '../../../shared/components/TabErrorBoundary';
import { fetchRoomCredentials } from '../../../shared/services/roomCredentials';
import { normalizeScrimSlots, countFilledScrimSlots } from '../../../shared/utils/scrimSlots';
import { resolveSlotTeam, fetchDedicatedTeams } from '../../../shared/utils/teamUtils';

// Lazy-load tab components
const OverviewTab = React.lazy(() => import('../components/OverviewTab'));
const TournamentsTab = React.lazy(() => import('../components/TournamentsTab'));
const ScrimsHubTab = React.lazy(() => import('../components/ScrimsHubTab'));
const MatchRoomsTab = React.lazy(() => import('../components/MatchRoomsTab'));
const DisputesTab = React.lazy(() => import('../components/DisputesTab'));
const TeamsRostersTab = React.lazy(() => import('../components/TeamsRostersTab'));
const WalletPayoutsTab = React.lazy(() => import('../components/WalletPayoutsTab'));
const SettingsStreamTab = React.lazy(() => import('../components/SettingsStreamTab'));

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'tournaments', label: 'Tournaments', icon: Trophy },
  { id: 'scrims', label: 'Scrims Hub', icon: Gamepad2 },
  { id: 'rooms', label: 'Match Rooms', icon: Radio },
  { id: 'disputes', label: 'Disputes', icon: ShieldAlert },
  { id: 'teams', label: 'Teams & Rosters', icon: Users },
  { id: 'wallet', label: 'Wallet & Payouts', icon: Wallet },
  { id: 'settings', label: 'Settings & Stream', icon: SettingsIcon },
] as const;

type TabId = typeof NAV_ITEMS[number]['id'];
const DEFAULT_TAB: TabId = 'overview';

const TAB_ALIASES: Record<string, TabId> = {
  matchrooms: 'rooms',
  matchroom: 'rooms',
  room: 'rooms',
  roster: 'teams',
  rosters: 'teams',
  payout: 'wallet',
  payouts: 'wallet',
  stream: 'settings',
  setting: 'settings',
  tournament: 'tournaments',
  scrim: 'scrims',
};

const getActiveTab = (search: string): TabId => {
  const requestedTab = (new URLSearchParams(search).get('tab') || '').toLowerCase();
  if (requestedTab && TAB_ALIASES[requestedTab]) {
    return TAB_ALIASES[requestedTab];
  }
  return NAV_ITEMS.some(item => item.id === requestedTab) ? requestedTab as TabId : DEFAULT_TAB;
};

const OrganizerPanel: React.FC = () => {
  const { profile } = useAuth();
  const { showToast } = useNotification();
  const location = useLocation();
  const navigate = useNavigate();

  const org = useOrgData();
  const activeTab = getActiveTab(location.search);

  // Mobile sidebar drawer
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Overlay state
  const [activeOverlay, setActiveOverlay] = useState<OverlayType>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [warningTeam, setWarningTeam] = useState<string | null>(null);
  const [warningReason, setWarningReason] = useState('');
  const [roomDispatchTarget, setRoomDispatchTarget] = useState<any>(null);
  const [scrimSlotTarget, setScrimSlotTarget] = useState<any>(null);
  const [disputeTarget, setDisputeTarget] = useState<string | null>(null);

  // Room dispatch form state
  const [roomId, setRoomId] = useState('');
  const [roomPass, setRoomPass] = useState('');
  const [streamUrl, setStreamUrl] = useState('');

  // Tournament & Scrim create modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editTournament, setEditTournament] = useState<any>(null);
  const [createMatchType, setCreateMatchType] = useState<'tournament' | 'scrims'>('tournament');

  const [showScrimCreateModal, setShowScrimCreateModal] = useState(false);
  const [editScrim, setEditScrim] = useState<any>(null);

  // Loading states for async operations
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingSlot, setIsTogglingSlot] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isResolvingDispute, setIsResolvingDispute] = useState(false);

  // --- Handlers ---

  const handleTabChange = (tabId: TabId) => {
    navigate(`?tab=${tabId}`);
    setMobileNavOpen(false);
  };

  const handleDelete = useCallback((id: string, title: string) => {
    setDeleteTarget({ id, title });
    setActiveOverlay('DELETE_CONFIRM');
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    try {
      await org.deleteTournament(deleteTarget.id);
      showToast(`"${deleteTarget.title || 'Event'}" deleted successfully`, 'success');
      setActiveOverlay(null);
      setDeleteTarget(null);
    } catch (err: any) {
      const msg = err?.message || 'Failed to delete';
      showToast(msg, 'error');
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, isDeleting, org, showToast]);

  const handleUpdateStatus = useCallback(async (id: string, status: string) => {
    if (isUpdatingStatus) return;
    const target = org.hostedTournaments.find(t => t.id === id);
    if (status === 'completed' && target && Number(target.prizePool) > 0) {
      const isPayoutDone = Boolean((target as any).payoutCompleted || (target as any).payoutStatus === 'paid' || (Array.isArray(target.winners) && target.winners.length > 0));
      if (!isPayoutDone) {
        showToast('Cannot finalize match until prize payment is distributed to winners! Redirecting to winner declaration...', 'warning');
        navigate(`/organizer/scrim/${id}`);
        return;
      }
    }

    setIsUpdatingStatus(true);
    try {
      await org.updateTournamentStatus(id, status as any);
      showToast(status === 'completed' ? 'Match finalized & all lobby slots released!' : `Tournament status: ${status.toUpperCase()}`, 'success');
    } catch {
      showToast('Failed to update status — you may not own this tournament', 'error');
    } finally {
      setIsUpdatingStatus(false);
    }
  }, [org, showToast, isUpdatingStatus, navigate]);

  const handleCreateTournament = useCallback((matchType: 'tournament' | 'scrims' = 'tournament') => {
    setEditTournament(null);
    setCreateMatchType(matchType);
    setShowCreateModal(true);
  }, []);

  const handleManageTournament = useCallback((id: string, matchType?: string) => {
    if (matchType === 'scrims') {
      navigate(`/organizer/scrim/${id}`);
    } else {
      navigate(`/tournament-admin/${id}`);
    }
  }, [navigate]);

  const handleActivateTournament = useCallback(async (id: string) => {
    try {
      await org.activateTournament(id);
      showToast('Tournament activated and open for registrations!', 'success');
      org.fetchHostedTournaments();
    } catch (err: any) {
      showToast(err.message || 'Failed to activate tournament', 'error');
    }
  }, [org, showToast]);

  const handleEditTournament = useCallback((tournament: any) => {
    setEditTournament(tournament);
    setShowCreateModal(true);
  }, []);

  const handleViewScrimDetails = useCallback((scrimId: string) => {
    navigate(`/organizer/scrim/${scrimId}`);
  }, [navigate]);

  const handleOpenRoomDispatch = useCallback(async (target: any) => {
    setRoomDispatchTarget(target);
    const targetId = target.id || target.tournamentId;
    const isScrim = target.isScrim === true || target.matchType === 'scrims' || target.type === 'scrim';
    const credentials = await fetchRoomCredentials(targetId, undefined, isScrim ? 'scrims' : 'tournaments');
    setRoomId(credentials?.roomId || target?.roomId || '');
    setRoomPass(credentials?.roomPass || target?.roomPass || '');
    setStreamUrl(target?.ytLink || target?.streamUrl || credentials?.streamUrl || '');
    setActiveOverlay('ROOM_DISPATCH');
  }, []);

  const handleBroadcastRoom = useCallback(async () => {
    if (!roomDispatchTarget) return;
    try {
      const targetId = roomDispatchTarget.id || roomDispatchTarget.tournamentId;
      const isScrim = roomDispatchTarget.isScrim === true || roomDispatchTarget.matchType === 'scrims' || roomDispatchTarget.type === 'scrim';
      await org.broadcastLobby(targetId, roomId, roomPass, streamUrl, isScrim ? 'scrims' : 'tournaments');
      showToast('Room credentials broadcasted to all players', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to broadcast room details', 'error');
    } finally {
      setActiveOverlay(null);
      setRoomDispatchTarget(null);
    }
  }, [roomDispatchTarget, roomId, roomPass, streamUrl, org, showToast]);

  const handleOpenSlotGrid = useCallback(async (scrim: any) => {
    if (!scrim) return;
    const scrimParts = org.participants.filter(p => p.tournamentId === scrim.id);
    const normalizedSlots = normalizeScrimSlots(scrim.slots, scrim.totalSlots, scrim.filledSlots ?? scrim.currentPlayers);

    const isTeamFormat = (scrim.teamType || scrim.format || '').toLowerCase().includes('duo') ||
                         (scrim.teamType || scrim.format || '').toLowerCase().includes('squad') ||
                         (scrim.teamType || '').toLowerCase() !== 'solo';

    const teamIds: string[] = [];
    const userIds: string[] = [];
    normalizedSlots.forEach((s: any) => {
      if (s?.teamId) teamIds.push(s.teamId);
      if (s?.userId) userIds.push(s.userId);
    });
    scrimParts.forEach((p: any) => {
      if (p?.teamId) teamIds.push(p.teamId);
      if (p?.userId) userIds.push(p.userId);
    });

    let teamsLookup = { teamById: new Map(), teamByUserId: new Map() };
    if (teamIds.length > 0 || userIds.length > 0) {
      try {
        teamsLookup = await fetchDedicatedTeams({ teamIds, userIds });
      } catch (e) {
        console.warn('Failed to fetch dedicated teams for slot manager', e);
      }
    }
    
    // Merge live registered participants into slot grid
    const mergedSlots = normalizedSlots.map((slot, idx) => {
      const part = scrimParts.find(p => (p as any).slotNumber === slot.slotNumber) || scrimParts[idx];
      const isFilled = Boolean(part) || slot.status === 'filled' || Boolean(slot.teamName);
      if (isFilled) {
        const resolved = resolveSlotTeam(slot, part, teamsLookup, isTeamFormat);
        return {
          ...slot,
          status: 'filled' as const,
          teamName: resolved.teamName,
          teamTag: resolved.teamTag,
          isDedicatedTeam: resolved.isDedicatedTeam,
          teamId: resolved.teamId || slot.teamId,
          userId: part?.userId || slot.userId,
          leader: resolved.leader,
          inGameId: resolved.inGameId,
        };
      }
      return slot;
    });

    setScrimSlotTarget({ ...scrim, slots: mergedSlots });
    setActiveOverlay('SCRIM_SLOTS');
  }, [org.participants]);

  const handleToggleSlot = useCallback(async (scrimIdOrSlotNumber: string | number, requestedSlotNumber?: number) => {
    const scrimId = requestedSlotNumber === undefined ? scrimSlotTarget?.id : String(scrimIdOrSlotNumber);
    const slotNumber = requestedSlotNumber ?? Number(scrimIdOrSlotNumber);
    if (!scrimId || !Number.isInteger(slotNumber) || slotNumber < 1 || isTogglingSlot) return;
    setIsTogglingSlot(true);
    try {
      await org.toggleScrimSlot(scrimId, slotNumber);
      showToast(`Slot ${slotNumber} toggled`, 'info');
      setScrimSlotTarget((prev: any) => {
        if (!prev || prev.id !== scrimId) return prev;
        const currentSlots = normalizeScrimSlots(prev.slots, prev.totalSlots, prev.filledSlots ?? prev.currentPlayers);
        const newSlots = currentSlots.map((s: any) => {
          if (s.slotNumber !== slotNumber) return s;
          if (s.status === 'filled') return { ...s, status: 'open', teamName: null, teamId: null };
          return { ...s, status: 'filled', teamName: 'Reserved', teamId: null };
        });
        const filled = countFilledScrimSlots(newSlots);
        return { ...prev, slots: newSlots, filledSlots: filled, currentPlayers: filled };
      });
    } catch (err: any) {
      showToast(err?.message || 'Failed to toggle slot', 'error');
    } finally {
      setIsTogglingSlot(false);
    }
  }, [scrimSlotTarget, isTogglingSlot, org, showToast]);

  const handleToggleRosterLock = useCallback(async (teamId: string) => {
    try {
      await org.toggleRosterLock(teamId);
      showToast(`Roster lock toggled for ${teamId}`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to toggle roster lock', 'error');
    }
  }, [org, showToast]);

  const handleIssueWarning = useCallback((teamName: string) => {
    setWarningTeam(teamName);
    setActiveOverlay('TEAM_WARNING');
  }, []);

  const confirmWarning = useCallback(async () => {
    if (!warningTeam || !warningReason.trim()) {
      showToast('Please enter a violation description', 'error');
      return;
    }
    try {
      await org.issueWarning(warningTeam, warningReason);
      showToast(`Warning issued to ${warningTeam}`, 'success');
      setActiveOverlay(null);
      setWarningTeam(null);
      setWarningReason('');
    } catch (err: any) {
      showToast(err?.message || 'Failed to issue warning', 'error');
    }
  }, [warningTeam, warningReason, org, showToast]);

  const handleBanTeam = useCallback(async (teamId: string, teamName: string) => {
    try {
      await org.toggleBanTeam(teamId, teamName);
      showToast(`${teamName} ban toggled`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to ban team', 'error');
    }
  }, [org, showToast]);

  const handleOpenDisputeOverlay = useCallback((disputeId: string) => {
    setDisputeTarget(disputeId);
    setActiveOverlay('DISPUTE_RESOLVER');
  }, []);

  const handleResolveDispute = useCallback(async (disputeIdOrAction: string, actionParam?: 'warn' | 'ban' | 'dismiss') => {
    const disputeId = actionParam ? disputeIdOrAction : disputeTarget;
    const action = actionParam || (disputeIdOrAction as 'warn' | 'ban' | 'dismiss');
    if (!disputeId || isResolvingDispute) return;
    setIsResolvingDispute(true);
    try {
      await org.resolveDispute(disputeId, action);
      showToast(`Dispute ${action === 'dismiss' ? 'dismissed' : `resolved — ${action} issued`}`, 'success');
      setActiveOverlay(null);
      setDisputeTarget(null);
    } catch (err: any) {
      showToast(err?.message || 'Failed to resolve dispute', 'error');
    } finally {
      setIsResolvingDispute(false);
    }
  }, [disputeTarget, isResolvingDispute, org, showToast]);

  const handleRequestWithdraw = useCallback(async (amount: number, method: string, details: string) => {
    try {
      await org.requestWithdrawal(amount, method, details);
      showToast('Withdrawal request submitted', 'success');
    } catch {
      showToast('Failed to process withdrawal', 'error');
    }
  }, [org, showToast]);

  const handleSaveSettings = useCallback(async (settings: any) => {
    try {
      await org.saveOrgSettings(settings);
      showToast('Organization settings saved', 'success');
    } catch {
      showToast('Failed to save settings', 'error');
    }
  }, [org, showToast]);

  // Tab content renderer
  const renderTab = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <TabErrorBoundary tabName="Overview Tab" resetKey={activeTab}>
            <OverviewTab
              kpis={org.kpis}
              activityFeed={org.activityFeed}
              hostedTournaments={org.hostedTournaments}
            />
          </TabErrorBoundary>
        );
      case 'tournaments':
        return (
          <TabErrorBoundary tabName="Tournaments Tab" resetKey={activeTab}>
            <TournamentsTab
              hostedTournaments={org.tournamentsOnly}
              onDelete={handleDelete}
              onUpdateStatus={handleUpdateStatus}
              onCreateTournament={() => handleCreateTournament('tournament')}
              onOpenRoomDispatch={handleOpenRoomDispatch}
              onManageTournament={handleManageTournament}
              onEditTournament={handleEditTournament}
              onActivateTournament={handleActivateTournament}
            />
          </TabErrorBoundary>
        );
      case 'scrims':
        return (
          <TabErrorBoundary tabName="Scrims Hub Tab" resetKey={activeTab}>
            <ScrimsHubTab
              scrims={org.scrims}
              participants={org.participants}
              onOpenSlotGrid={handleOpenSlotGrid}
              onToggleSlot={handleToggleSlot}
              onViewDetails={handleViewScrimDetails}
              onCreateScrim={() => { setEditScrim(null); setShowScrimCreateModal(true); }}
              onEditScrim={(scrim) => { setEditScrim(scrim); setShowScrimCreateModal(true); }}
              onDeleteScrim={handleDelete}
              onUpdateStatus={handleUpdateStatus}
              onOpenRoomDispatch={handleOpenRoomDispatch}
            />
          </TabErrorBoundary>
        );
      case 'rooms':
        return (
          <TabErrorBoundary tabName="Match Rooms Tab" resetKey={activeTab}>
            <MatchRoomsTab
              matchRooms={org.matchRooms}
              disputes={org.disputes}
              onOpenRoomDispatch={handleOpenRoomDispatch}
              onResolveDispute={handleResolveDispute}
              onOpenDisputeOverlay={handleOpenDisputeOverlay}
            />
          </TabErrorBoundary>
        );
      case 'disputes':
        return (
          <TabErrorBoundary tabName="Disputes Tab" resetKey={activeTab}>
            <DisputesTab
              disputes={org.disputes}
              onResolveDispute={handleResolveDispute}
              onOpenDisputeOverlay={handleOpenDisputeOverlay}
            />
          </TabErrorBoundary>
        );
      case 'teams':
        return (
          <TabErrorBoundary tabName="Teams & Rosters Tab" resetKey={activeTab}>
            <TeamsRostersTab
              teams={org.teams}
              onToggleRosterLock={handleToggleRosterLock}
              onIssueWarning={handleIssueWarning}
              onBanTeam={handleBanTeam}
            />
          </TabErrorBoundary>
        );
      case 'wallet':
        return (
          <TabErrorBoundary tabName="Wallet & Payouts Tab" resetKey={activeTab}>
            <WalletPayoutsTab
              kpis={org.kpis}
              transactions={org.transactions}
              onRequestWithdraw={handleRequestWithdraw}
            />
          </TabErrorBoundary>
        );
      case 'settings':
        return (
          <TabErrorBoundary tabName="Settings & Stream Tab" resetKey={activeTab}>
            <SettingsStreamTab
              profile={profile}
              onSaveSettings={handleSaveSettings}
            />
          </TabErrorBoundary>
        );
      default:
        return <TabErrorBoundary tabName="Organizer Panel">Unable to load this panel.</TabErrorBoundary>;
    }
  };

  if (org.loading) {
    return (
      <DashboardLayout title="Loading...">
        <div className="flex flex-col items-center justify-center min-h-[40vh]">
          <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-xs text-gray-500 font-medium uppercase tracking-widest">Loading Organizer Panel...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (org.error && hostedTournamentsEmpty(org)) {
    return (
      <DashboardLayout title="Organizer Panel">
        <Seo title="Organizer Panel | NexPlay" description="Tournament organizer dashboard" noindex />
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
          <p className="text-red-400 font-medium mb-4">{org.error}</p>
          <button
            onClick={() => org.fetchHostedTournaments()}
            className="bg-brand-500 hover:bg-brand-400 text-white rounded-lg px-6 py-2 text-sm font-medium transition-colors min-h-[44px]"
          >
            Retry
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Organizer Panel">
      <Seo title="Organizer Panel | NexPlay" description="Tournament organizer dashboard" noindex />
      {/* Mobile nav toggle */}
      <button
        onClick={() => setMobileNavOpen(!mobileNavOpen)}
        className="lg:hidden flex items-center justify-between bg-card p-4 rounded-2xl border border-gray-800 w-full mb-4"
      >
        <span className="font-bold text-white text-sm uppercase tracking-widest">Organizer Menu</span>
        {mobileNavOpen ? <X className="w-5 h-5 text-gray-400" /> : <Menu className="w-5 h-5 text-gray-400" />}
      </button>

      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
        {/* Sidebar Navigation */}
        <aside className={`w-full lg:w-60 flex-shrink-0 ${mobileNavOpen ? 'block' : 'hidden lg:block'}`}>
          <nav aria-label="Organizer panel navigation" className="space-y-2 bg-card p-4 rounded-2xl border border-gray-800 h-fit lg:sticky lg:top-24">
            {NAV_ITEMS.map((item) => {
              const pendingCount = item.id === 'disputes' ? org.disputes.filter(d => (d.status || 'pending') === 'pending').length : 0;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-full text-xs font-black uppercase tracking-widest transition-colors shrink-0 min-h-[44px] ${
                    activeTab === item.id
                      ? 'bg-brand-500 text-white shadow-xl shadow-brand-500/20'
                      : 'text-gray-400 hover:bg-surface/50 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className={`w-4 h-4 flex-shrink-0 ${activeTab === item.id ? 'text-white' : 'text-gray-500'}`} />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </div>
                  {pendingCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-600 text-white animate-pulse">
                      {pendingCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 overflow-x-hidden">
          <React.Suspense
            fallback={<div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>}
          >
            {renderTab()}
          </React.Suspense>
        </main>
      </div>

      {/* Unified Overlay Manager */}
      <OrgOverlayManager
        activeOverlay={activeOverlay}
        onClose={() => { setActiveOverlay(null); setDeleteTarget(null); setWarningTeam(null); setRoomDispatchTarget(null); setScrimSlotTarget(null); setDisputeTarget(null); }}
        deleteTarget={deleteTarget?.title}
        isDeleting={isDeleting}
        onConfirmDelete={confirmDelete}
        teamName={warningTeam}
        warningReason={warningReason}
        setWarningReason={setWarningReason}
        onIssueWarning={confirmWarning}
        roomId={roomId}
        setRoomId={setRoomId}
        roomPass={roomPass}
        setRoomPass={setRoomPass}
        streamUrl={streamUrl}
        setStreamUrl={setStreamUrl}
        onBroadcastRoom={handleBroadcastRoom}
        disputeId={disputeTarget ?? undefined}
        onResolveDispute={handleResolveDispute}
        scrimTitle={scrimSlotTarget?.title}
        slotGrid={scrimSlotTarget?.slots}
        onToggleSlot={handleToggleSlot}
      />

      {/* Tournament Create Modal */}
      {showCreateModal && (
        <TournamentCreateModal
          isOpen={showCreateModal}
          onClose={() => { setShowCreateModal(false); setEditTournament(null); }}
          onSuccess={() => { setShowCreateModal(false); setEditTournament(null); org.fetchHostedTournaments(); }}
          editTournament={editTournament}
          defaultMatchType={createMatchType}
        />
      )}

      {/* Scrim Create & Edit Modal */}
      {showScrimCreateModal && (
        <ScrimCreateModal
          isOpen={showScrimCreateModal}
          onClose={() => { setShowScrimCreateModal(false); setEditScrim(null); }}
          onSuccess={() => { setShowScrimCreateModal(false); setEditScrim(null); org.fetchHostedTournaments(); }}
          editScrim={editScrim}
        />
      )}
    </DashboardLayout>
  );
};

function hostedTournamentsEmpty(org: ReturnType<typeof useOrgData>): boolean {
  return org.hostedTournaments.length === 0;
}

export default OrganizerPanel;
