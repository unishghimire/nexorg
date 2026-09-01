import { auth } from '../config/firebase';
import { Tournament, TournamentGroup } from '../types/types';
import { formatCurrency, formatDate } from '../utils/utils';

export type DiscordCategory = 
  | 'announcement'
  | 'registration'
  | 'group'
  | 'matchSchedule'
  | 'result'
  | 'champion';

export type DiscordAnnouncementType =
  // Tournaments
  | 'tournament_published'
  | 'tournament_registration'
  | 'group_published'
  | 'game_start'
  | 'game_time'
  | 'tournament_live'
  | 'tournament_result'
  | 'tournament_completed'
  | 'tournament_champion'
  // Scrims
  | 'scrim_published'
  | 'scrim_registration'
  | 'scrim_group'
  | 'scrim_game_start'
  | 'scrim_game_time'
  | 'scrim_live'
  | 'scrim_result'
  | 'scrim_completed'
  | 'scrim_champion';

/**
 * Sends a Discord announcement via the secure server-side proxy.
 * The webhook URL is never exposed to the browser.
 */
async function sendAnnouncement(
    type: DiscordAnnouncementType,
    data: Record<string, any>,
    channel: 'tournaments' | 'scrims' = 'tournaments'
): Promise<{ success: boolean; message: string }> {
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
        return { success: false, message: 'Not authenticated.' };
    }

    try {
        const res = await fetch('/api/discord/announce', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ type, data, channel }),
        });

        const json = await res.json();
        return { success: json.success, message: json.message };
    } catch (e: any) {
        return { success: false, message: e.message || 'Failed to connect to Discord endpoint' };
    }
}

// ═══════════════════════════════════════════════════════════════
// 1. TOURNAMENT WEBHOOK HELPERS
// ═══════════════════════════════════════════════════════════════

/** 1. Tournament Announcement Webhook */
export const announceNewTournament = (t: Tournament) =>
    sendAnnouncement('tournament_published', {
        tournamentId: t.id,
        title: t.title,
        game: t.game,
        teamType: t.teamType,
        type: t.type,
        map: t.map,
        startTime: formatDate(t.startTime),
        prizePool: formatCurrency(t.prizePool),
        entryFee: t.entryFee === 0 ? 'FREE' : formatCurrency(t.entryFee),
        currentPlayers: t.currentPlayers || 0,
        slots: t.slots,
        bannerUrl: t.bannerUrl,
    }, 'tournaments');

/** 2. Registration Announcement Webhook */
export const announceTournamentRegistration = (t: Tournament, teamOrPlayerName: string, currentPlayers: number) =>
    sendAnnouncement('tournament_registration', {
        tournamentId: t.id,
        title: t.title,
        teamName: teamOrPlayerName,
        currentPlayers,
        slots: t.slots,
    }, 'tournaments');

/** 3. Group Draw Webhook */
export const announceGroupDraw = (t: Tournament, groups: TournamentGroup[]) =>
    sendAnnouncement('group_published', {
        tournamentId: t.id,
        title: t.title,
        groups: groups.map(g =>
            `${g.name} (${g.teams.length} teams): ${g.teams.map(team => team.name).join(', ')}`
        ),
    }, 'tournaments');

/** 4. Match Schedule & Room Details Webhook */
export const announceGameStart = (
    t: Tournament,
    groupName: string,
    map: string,
    roomId?: string,
    roomPass?: string
) =>
    sendAnnouncement('game_start', {
        tournamentId: t.id,
        title: t.title,
        groupName,
        map,
        roomId,
        roomPass,
    }, 'tournaments');

export const announceGameTime = (
    t: Tournament,
    groupName: string,
    startTime: string,
    timeLeft: string
) =>
    sendAnnouncement('game_time', {
        tournamentId: t.id,
        title: t.title,
        groupName,
        startTime,
        timeLeft,
        map: t.map,
    }, 'tournaments');

export const announceTournamentLive = (t: Tournament) =>
    sendAnnouncement('tournament_live', {
        tournamentId: t.id,
        title: t.title,
        game: t.game,
        currentPlayers: t.currentPlayers || 0,
        slots: t.slots,
        prizePool: formatCurrency(t.prizePool),
        map: t.map,
    }, 'tournaments');

/** 5. Results Webhook */
export const announceTournamentResult = (t: Tournament, groupName: string, resultsSummary: string) =>
    sendAnnouncement('tournament_result', {
        tournamentId: t.id,
        title: t.title,
        groupName,
        resultsSummary,
    }, 'tournaments');

/** 6. Champion Announcement Webhook */
export const announceTournamentCompleted = (t: Tournament, winner?: string) =>
    sendAnnouncement('tournament_completed', {
        tournamentId: t.id,
        title: t.title,
        prizePool: formatCurrency(t.prizePool),
        winner,
        bannerUrl: t.bannerUrl,
    }, 'tournaments');

export const announceTournamentChampion = (t: Tournament, winner: string, prizeAmount: string) =>
    sendAnnouncement('tournament_champion', {
        tournamentId: t.id,
        title: t.title,
        winner,
        prizeAmount,
    }, 'tournaments');

// ═══════════════════════════════════════════════════════════════
// 2. SCRIMS WEBHOOK HELPERS
// ═══════════════════════════════════════════════════════════════

/** 1. Scrim Announcement Webhook */
export const announceNewScrim = (t: Tournament) =>
    sendAnnouncement('scrim_published', {
        tournamentId: t.id,
        title: t.title,
        game: t.game,
        teamType: t.teamType,
        startTime: formatDate(t.startTime),
        prizePool: formatCurrency(t.prizePool),
        entryFee: t.entryFee === 0 ? 'FREE' : formatCurrency(t.entryFee),
        currentPlayers: t.currentPlayers || 0,
        slots: t.slots,
        bannerUrl: t.bannerUrl,
    }, 'scrims');

/** 2. Scrim Registration Webhook */
export const announceScrimRegistration = (t: Tournament, teamOrPlayerName: string, slotNumber: number, currentPlayers: number) =>
    sendAnnouncement('scrim_registration', {
        tournamentId: t.id,
        title: t.title,
        teamName: teamOrPlayerName,
        slotNumber,
        currentPlayers,
        slots: t.slots,
    }, 'scrims');

/** 3. Scrim Group / Lobby Webhook */
export const announceScrimGroup = (t: Tournament, slotsList: string[]) =>
    sendAnnouncement('scrim_group', {
        tournamentId: t.id,
        title: t.title,
        slotsList,
    }, 'scrims');

/** 4. Scrim Match Schedule & Room Details Webhook */
export const announceScrimGameStart = (t: Tournament, map: string, roomId?: string, roomPass?: string) =>
    sendAnnouncement('scrim_game_start', {
        tournamentId: t.id,
        title: t.title,
        map,
        roomId,
        roomPass,
    }, 'scrims');

export const announceScrimGameTime = (t: Tournament, startTime: string, timeLeft: string) =>
    sendAnnouncement('scrim_game_time', {
        tournamentId: t.id,
        title: t.title,
        startTime,
        timeLeft,
        map: t.map,
    }, 'scrims');

export const announceScrimLive = (t: Tournament) =>
    sendAnnouncement('scrim_live', {
        tournamentId: t.id,
        title: t.title,
        currentPlayers: t.currentPlayers || 0,
        slots: t.slots,
    }, 'scrims');

/** 5. Scrim Results Webhook */
export const announceScrimResult = (t: Tournament, resultsSummary: string) =>
    sendAnnouncement('scrim_result', {
        tournamentId: t.id,
        title: t.title,
        resultsSummary,
    }, 'scrims');

/** 6. Scrim Champion / Winner Webhook */
export const announceScrimCompleted = (t: Tournament, winner?: string, prizeAmount?: string) =>
    sendAnnouncement('scrim_completed', {
        tournamentId: t.id,
        title: t.title,
        winner,
        prizeAmount,
    }, 'scrims');

// ═══════════════════════════════════════════════════════════════
// 3. TESTING HELPERS
// ═══════════════════════════════════════════════════════════════

/** Test a specific Discord Webhook Category */
export const testSpecificDiscordWebhook = async (
    channel: 'tournaments' | 'scrims',
    category: DiscordCategory,
    webhookUrl?: string
): Promise<{ success: boolean; message: string }> => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return { success: false, message: 'Not authenticated.' };

    try {
        const res = await fetch('/api/discord/test', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ channel, category, webhookUrl }),
        });
        const json = await res.json();
        return { success: json.success, message: json.message };
    } catch (err: any) {
        return { success: false, message: err.message || 'Failed to connect to backend test endpoint' };
    }
};

/** Backward compatibility alias */
export const testDiscordWebhook = (webhookUrl?: string) =>
    testSpecificDiscordWebhook('tournaments', 'announcement', webhookUrl);
