import { auth, db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
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

export function getCategoryForType(type: DiscordAnnouncementType): DiscordCategory {
  switch (type) {
    case 'tournament_published':
    case 'scrim_published':
      return 'announcement';
    case 'tournament_registration':
    case 'scrim_registration':
      return 'registration';
    case 'group_published':
    case 'scrim_group':
      return 'group';
    case 'game_start':
    case 'game_time':
    case 'scrim_game_start':
    case 'scrim_game_time':
    case 'tournament_live':
    case 'scrim_live':
      return 'matchSchedule';
    case 'tournament_result':
    case 'scrim_result':
      return 'result';
    case 'tournament_completed':
    case 'tournament_champion':
    case 'scrim_completed':
    case 'scrim_champion':
      return 'champion';
    default:
      return 'announcement';
  }
}

/**
 * Builds fallback Discord embed if proxy is unreachable.
 */
function buildFallbackEmbed(type: DiscordAnnouncementType, data: Record<string, any>) {
  const isScrim = type.startsWith('scrim_');
  const title = data.title || (isScrim ? 'Practice Scrim' : 'Esports Tournament');
  const appUrl = window.location.origin;
  const link = isScrim
    ? `${appUrl}/organizer/scrim/${data.tournamentId || ''}`
    : `${appUrl}/tournaments/${data.tournamentId || ''}`;

  switch (type) {
    case 'tournament_published':
      return {
        title: `🏆 New Tournament Announced: ${title}`,
        description: `**Game:** ${data.game || 'Esports'}\n**Prize Pool:** ${data.prizePool || 'Rs. 0'}\n**Entry Fee:** ${data.entryFee || 'FREE'}\n**Start Time:** ${data.startTime || 'TBD'}\n\n[Register Now on NexPlay](${link})`,
        color: 0x6366f1,
        footer: { text: 'NexPlay Esports • Official Tournament' },
        timestamp: new Date().toISOString(),
      };
    case 'scrim_published':
      return {
        title: `🔥 New Practice Scrim Opened: ${title}`,
        description: `**Game:** ${data.game || 'Esports'}\n**Format:** ${data.teamType || 'Squad'}\n**Entry Fee:** ${data.entryFee || 'FREE'}\n**Slots:** ${data.slots || 12}\n\n[Book Your Slot Now](${link})`,
        color: 0x10b981,
        footer: { text: 'NexPlay Scrims Hub • Instant Match Lobby' },
        timestamp: new Date().toISOString(),
      };
    case 'scrim_game_start':
    case 'game_start':
      return {
        title: `⚔️ Match Starting Now — ${title}`,
        description: `**Map:** ${data.map || 'TBD'}\n**Room ID:** \`${data.roomId || 'Check app'}\`\n**Password:** \`${data.roomPass || 'Check app'}\`\n\n[Open Match Lobby](${link})`,
        color: 0xef4444,
        footer: { text: isScrim ? 'NexPlay Scrims • Room Dispatch' : 'NexPlay Esports • Room Dispatch' },
        timestamp: new Date().toISOString(),
      };
    case 'scrim_live':
    case 'tournament_live':
      return {
        title: `🔴 Match is LIVE — ${title}`,
        description: `**Participants:** ${data.currentPlayers || 0}/${data.slots || 0}\n\n[Follow Live Scoring](${link})`,
        color: 0x22c55e,
        footer: { text: 'NexPlay Live Broadcast' },
        timestamp: new Date().toISOString(),
      };
    case 'scrim_completed':
    case 'tournament_completed':
      return {
        title: `👑 Match Finalized — ${title}`,
        description: `🏆 **Winner:** **${data.winner || 'Champion'}**\n💰 **Prize Distributed:** ${data.prizeAmount || data.prizePool || 'Rs. 0'}\n\nGGs to all participants!`,
        color: 0xf59e0b,
        footer: { text: 'NexPlay Hall of Champions' },
        timestamp: new Date().toISOString(),
      };
    default:
      return {
        title: `📢 ${title}`,
        description: `Update broadcasted for **${title}**.\n\n[View Details](${link})`,
        color: 0x5865f2,
        timestamp: new Date().toISOString(),
      };
  }
}

/**
 * Sends a Discord announcement via the secure server-side proxy.
 * Falls back to direct webhook post if server-side proxy is unavailable.
 */
async function sendAnnouncement(
    type: DiscordAnnouncementType,
    data: Record<string, any>,
    channel: 'tournaments' | 'scrims' = 'tournaments'
): Promise<{ success: boolean; message: string }> {
    const token = await auth.currentUser?.getIdToken().catch(() => null);

    // 1. Try server-side proxy first
    if (token) {
        try {
            const res = await fetch('/api/discord/announce', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ type, data, channel }),
            });

            if (res.ok) {
                const json = await res.json().catch(() => null);
                if (json?.success) return json;
            }
        } catch {}
    }

    // 2. Resilient Client-Side Fallback directly to Discord webhook configured in Firestore
    try {
        const category = getCategoryForType(type);
        const settingsSnap = await getDoc(doc(db, 'settings', 'site')).catch(() => null);
        if (settingsSnap && settingsSnap.exists()) {
            const sData = settingsSnap.data();
            const autoAnnounce = sData?.discordWebhooks?.autoAnnounce;
            if (autoAnnounce?.[channel] === false || (channel === 'tournaments' && sData?.autoDiscordTournamentAnnouncements === false)) {
                return { success: true, message: 'Discord announcements disabled in settings.' };
            }

            const channelWebhooks = sData?.discordWebhooks?.[channel];
            let webhookUrl = channelWebhooks?.[category]?.trim() || channelWebhooks?.announcement?.trim();
            if (!webhookUrl) {
                webhookUrl = channel === 'tournaments'
                    ? sData?.discordWebhookTournaments?.trim()
                    : sData?.discordWebhookScrims?.trim();
            }

            if (webhookUrl && (webhookUrl.startsWith('https://discord.com/api/webhooks/') || webhookUrl.startsWith('https://discordapp.com/api/webhooks/'))) {
                const embed = buildFallbackEmbed(type, data);
                const postRes = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ embeds: [embed] }),
                });
                if (postRes.ok) {
                    return { success: true, message: `Direct Discord broadcast dispatched to [${category}]` };
                }
            }
        }
    } catch (fallbackErr) {
        console.warn('[DiscordService] Fallback broadcast failed:', fallbackErr);
    }

    return { success: false, message: 'Discord announcement endpoint unreachable' };
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
