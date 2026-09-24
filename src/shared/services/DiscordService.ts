import { auth, db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Tournament, TournamentGroup } from '../types/types';
import { formatCurrency, formatDate } from '../utils/utils';
import { BASE_URL } from '../constants/constants';

// Canonical public domain for player access: https://www.nexplayorg.app
export const PUBLIC_APP_URL = BASE_URL || 'https://www.nexplayorg.app';

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
 * Builds resilient Discord embed for tournaments and scrims.
 * Ensures canonical public domain (https://www.nexplayorg.app) is used with tournament/scrim ID.
 */
function buildFallbackEmbed(type: DiscordAnnouncementType, data: Record<string, any>) {
  const isScrim = type.startsWith('scrim_');
  const title = data.title || (isScrim ? 'Practice Scrim' : 'Esports Tournament');
  const targetId = String(data.tournamentId || data.id || data.scrimId || '').trim();
  const domain = PUBLIC_APP_URL.replace(/\/+$/, '');

  const link = targetId
    ? (isScrim ? `${domain}/scrims/${targetId}` : `${domain}/tournaments/${targetId}`)
    : (isScrim ? `${domain}/scrims` : `${domain}/tournaments`);

  const eventLabel = isScrim ? '🎯 Scrim ID' : '🏆 Tournament ID';
  const idFields = targetId
    ? [
        { name: eventLabel, value: `\`${targetId}\``, inline: true },
        { name: '🔗 Official Link', value: `[Open on NexPlay](${link})`, inline: true },
      ]
    : [{ name: '🔗 Official Link', value: `[Open on NexPlay](${link})`, inline: true }];

  switch (type) {
    case 'tournament_published':
      return {
        title: `🏆 New Tournament Announced: ${title}`,
        url: link,
        description: `**Game:** ${data.game || 'Esports'}\n**Prize Pool:** ${data.prizePool || 'Rs. 0'}\n**Entry Fee:** ${data.entryFee || 'FREE'}\n**Start Time:** ${data.startTime || 'TBD'}\n\n[Register Now on NexPlay](${link})`,
        color: 0x6366f1,
        fields: idFields,
        image: data.bannerUrl ? { url: data.bannerUrl } : undefined,
        footer: { text: targetId ? `NexPlay Esports • Tournament ID: ${targetId}` : 'NexPlay Esports • Official Tournament' },
        timestamp: new Date().toISOString(),
      };

    case 'scrim_published':
      return {
        title: `🔥 New Practice Scrim Opened: ${title}`,
        url: link,
        description: `**Game:** ${data.game || 'Esports'}\n**Format:** ${data.teamType || 'Squad'}\n**Entry Fee:** ${data.entryFee || 'FREE'}\n**Slots:** ${data.slots || 12}\n\n[Book Your Slot Now](${link})`,
        color: 0x10b981,
        fields: idFields,
        image: data.bannerUrl ? { url: data.bannerUrl } : undefined,
        footer: { text: targetId ? `NexPlay Scrims Hub • Scrim ID: ${targetId}` : 'NexPlay Scrims Hub • Instant Match Lobby' },
        timestamp: new Date().toISOString(),
      };

    case 'tournament_registration':
    case 'scrim_registration':
      return {
        title: isScrim ? `🎯 Slot Booked — ${title}` : `📝 Team Registered — ${title}`,
        url: link,
        description: `**Participant:** **${data.teamName || 'Player/Team'}**\n${data.slotNumber ? `**Slot Assigned:** #${data.slotNumber}\n` : ''}**Current Registrations:** ${data.currentPlayers || 0}/${data.slots || 0}\n\n[View Event on NexPlay](${link})`,
        color: 0x06b6d4,
        fields: idFields,
        footer: { text: targetId ? `NexPlay • ID: ${targetId}` : 'NexPlay Esports' },
        timestamp: new Date().toISOString(),
      };

    case 'group_published':
    case 'scrim_group':
      return {
        title: isScrim ? `📋 Practice Lobby Slots — ${title}` : `📋 Group Draw Published — ${title}`,
        url: link,
        description: isScrim
          ? `Lobby slots have been refreshed for this practice scrim.\n\n[Open Scrim Lobby](${link})`
          : `Tournament brackets & groups are officially confirmed!\n\n[View Full Bracket & Groups](${link})`,
        color: 0x8b5cf6,
        fields: idFields,
        footer: { text: targetId ? `NexPlay • ID: ${targetId}` : 'NexPlay Esports' },
        timestamp: new Date().toISOString(),
      };

    case 'scrim_game_start':
    case 'game_start':
      return {
        title: `⚔️ Match Starting Now — ${title}`,
        url: link,
        description: `**Map:** ${data.map || 'TBD'}\n**Room ID:** \`${data.roomId || 'Check app'}\`\n**Password:** \`${data.roomPass || 'Check app'}\`\n\n[Open Match Lobby](${link})`,
        color: 0xef4444,
        fields: idFields,
        footer: { text: isScrim ? (targetId ? `NexPlay Scrims • ID: ${targetId}` : 'NexPlay Scrims • Room Dispatch') : (targetId ? `NexPlay Esports • ID: ${targetId}` : 'NexPlay Esports • Room Dispatch') },
        timestamp: new Date().toISOString(),
      };

    case 'game_time':
    case 'scrim_game_time':
      return {
        title: `⏰ Match Starting Soon — ${title}`,
        url: link,
        description: `**Start Time:** ${data.startTime || 'Soon'}\n**Time Remaining:** ${data.timeLeft || 'Check app'}\n${data.map ? `**Map:** ${data.map}\n` : ''}\n[Prepare in Match Lobby](${link})`,
        color: 0xeab308,
        fields: idFields,
        footer: { text: targetId ? `NexPlay • ID: ${targetId}` : 'NexPlay Esports' },
        timestamp: new Date().toISOString(),
      };

    case 'scrim_live':
    case 'tournament_live':
      return {
        title: `🔴 Match is LIVE — ${title}`,
        url: link,
        description: `**Participants:** ${data.currentPlayers || 0}/${data.slots || 0}\n\n[Follow Live Scoring](${link})`,
        color: 0x22c55e,
        fields: idFields,
        footer: { text: targetId ? `NexPlay • ID: ${targetId}` : 'NexPlay Live Broadcast' },
        timestamp: new Date().toISOString(),
      };

    case 'tournament_result':
    case 'scrim_result':
      return {
        title: `📊 Match Results Published — ${title}`,
        url: link,
        description: `${data.resultsSummary || 'Round scores have been calculated.'}\n\n[View Full Standings](${link})`,
        color: 0x3b82f6,
        fields: idFields,
        footer: { text: targetId ? `NexPlay • ID: ${targetId}` : 'NexPlay Results' },
        timestamp: new Date().toISOString(),
      };

    case 'scrim_completed':
    case 'tournament_completed':
    case 'tournament_champion':
    case 'scrim_champion':
      return {
        title: `👑 Match Finalized — ${title}`,
        url: link,
        description: `🏆 **Winner:** **${data.winner || 'Champion'}**\n💰 **Prize Distributed:** ${data.prizeAmount || data.prizePool || 'Rs. 0'}\n\nGGs to all participants!\n\n[View Full Standings & Podium](${link})`,
        color: 0xf59e0b,
        fields: idFields,
        image: data.bannerUrl ? { url: data.bannerUrl } : undefined,
        footer: { text: targetId ? `NexPlay Hall of Champions • ID: ${targetId}` : 'NexPlay Hall of Champions' },
        timestamp: new Date().toISOString(),
      };

    default:
      return {
        title: `📢 ${title}`,
        url: link,
        description: `Update broadcasted for **${title}**.\n\n[View Details](${link})`,
        color: 0x5865f2,
        fields: idFields,
        footer: { text: targetId ? `NexPlay • ID: ${targetId}` : 'NexPlay Platform' },
        timestamp: new Date().toISOString(),
      };
  }
}

/**
 * Sends a Discord announcement via the secure server-side proxy or direct webhook dispatch.
 * Enforces canonical domain (https://www.nexplayorg.app) and supports both site and organizer webhooks.
 */
async function sendAnnouncement(
    type: DiscordAnnouncementType,
    data: Record<string, any>,
    channel: 'tournaments' | 'scrims' = 'tournaments'
): Promise<{ success: boolean; message: string }> {
    const isScrim = type.startsWith('scrim_') || channel === 'scrims';
    const targetId = String(data.tournamentId || data.id || data.scrimId || '').trim();
    const domain = PUBLIC_APP_URL.replace(/\/+$/, '');
    const link = targetId
        ? (isScrim ? `${domain}/scrims/${targetId}` : `${domain}/tournaments/${targetId}`)
        : (isScrim ? `${domain}/scrims` : `${domain}/tournaments`);

    const enrichedData = {
        ...data,
        tournamentId: targetId,
        url: link,
        link,
    };

    const token = await auth.currentUser?.getIdToken().catch(() => null);

    // 1. Try server-side proxy first (if available)
    if (token) {
        try {
            const res = await fetch('/api/discord/announce', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ type, data: enrichedData, channel }),
            });

            if (res.ok) {
                const json = await res.json().catch(() => null);
                if (json?.success) return json;
            }
        } catch {}
    }

    // 2. Resilient Direct Webhook Dispatch (Site Settings + Organizer Profile)
    try {
        const category = getCategoryForType(type);
        const embed = buildFallbackEmbed(type, enrichedData);
        const webhookUrls = new Set<string>();

        // Check site settings for global webhooks
        const settingsSnap = await getDoc(doc(db, 'settings', 'site')).catch(() => null);
        if (settingsSnap && settingsSnap.exists()) {
            const sData = settingsSnap.data();
            const autoAnnounce = sData?.discordWebhooks?.autoAnnounce;
            if (autoAnnounce?.[channel] === false || (channel === 'tournaments' && sData?.autoDiscordTournamentAnnouncements === false)) {
                return { success: true, message: 'Discord announcements disabled in settings.' };
            }

            const channelWebhooks = sData?.discordWebhooks?.[channel];
            let siteWebhook = channelWebhooks?.[category]?.trim() || channelWebhooks?.announcement?.trim();
            if (!siteWebhook) {
                siteWebhook = channel === 'tournaments'
                    ? sData?.discordWebhookTournaments?.trim()
                    : sData?.discordWebhookScrims?.trim();
            }

            if (siteWebhook && (siteWebhook.startsWith('https://discord.com/api/webhooks/') || siteWebhook.startsWith('https://discordapp.com/api/webhooks/'))) {
                webhookUrls.add(siteWebhook);
            }
        }

        // Also check if current organizer has an individual Discord webhook in their profile
        const userUid = auth.currentUser?.uid;
        if (userUid) {
            const userSnap = await getDoc(doc(db, 'users', userUid)).catch(() => null);
            if (userSnap && userSnap.exists()) {
                const uData = userSnap.data();
                const orgWebhook = (uData?.discordWebhook || uData?.discord || '').trim();
                if (orgWebhook.startsWith('https://discord.com/api/webhooks/') || orgWebhook.startsWith('https://discordapp.com/api/webhooks/')) {
                    webhookUrls.add(orgWebhook);
                }
            }
        }

        if (webhookUrls.size > 0) {
            let dispatchedCount = 0;
            for (const url of webhookUrls) {
                try {
                    const postRes = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ embeds: [embed] }),
                    });
                    if (postRes.ok) {
                        dispatchedCount++;
                    }
                } catch (postErr) {
                    console.warn('[DiscordService] Failed to post to webhook:', url, postErr);
                }
            }

            if (dispatchedCount > 0) {
                return {
                    success: true,
                    message: `Discord broadcast dispatched to ${dispatchedCount} webhook(s) [${category}] (${link})`,
                };
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
    // If a direct webhook URL is passed, test directly via client fetch
    if (webhookUrl && (webhookUrl.startsWith('https://discord.com/api/webhooks/') || webhookUrl.startsWith('https://discordapp.com/api/webhooks/'))) {
        try {
            const domain = PUBLIC_APP_URL.replace(/\/+$/, '');
            const testEmbed = {
                title: `🧪 NexPlay Discord Webhook Diagnostic`,
                url: domain,
                description: `Webhook test broadcast successfully received for channel **#${channel}** (category: **${category}**).\n\nTournaments and Scrims are officially hosted on [nexplayorg.app](${domain}).`,
                color: 0x6366f1,
                fields: [
                    { name: '🌐 Official Domain', value: `[${domain}](${domain})`, inline: true },
                    { name: '📡 Channel', value: channel, inline: true },
                    { name: '📂 Category', value: category, inline: true },
                ],
                footer: { text: 'NexPlay Esports Platform • Webhook Diagnostic' },
                timestamp: new Date().toISOString(),
            };
            const postRes = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ embeds: [testEmbed] }),
            });
            if (postRes.ok) {
                return { success: true, message: `Direct test broadcast delivered to Discord [${category}]!` };
            }
            return { success: false, message: `Discord rejected webhook: HTTP ${postRes.status}` };
        } catch (e: any) {
            return { success: false, message: e.message || 'Direct webhook test failed' };
        }
    }

    const token = await auth.currentUser?.getIdToken().catch(() => null);
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
