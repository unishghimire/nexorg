import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Team } from '../types/types';

export interface DedicatedTeamsLookup {
  teamById: Map<string, Team>;
  teamByUserId: Map<string, Team>;
}

// In-memory lookup cache to eliminate redundant Firestore queries and eliminate UI lag
const globalTeamCacheById = new Map<string, Team>();
const globalTeamCacheByUserId = new Map<string, Team>();
const cacheTimestamps = new Map<string, number>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

/**
 * Batched lookup for dedicated teams based on teamIds and userIds.
 * Resolves teams created via the dedicated Teams feature (teams collection, team_members, ownerId, captainId).
 * Uses in-memory caching to avoid Firestore query storming.
 */
export async function fetchDedicatedTeams(identifiers: {
  teamIds?: (string | null | undefined)[];
  userIds?: (string | null | undefined)[];
}): Promise<DedicatedTeamsLookup> {
  const teamById = new Map<string, Team>();
  const teamByUserId = new Map<string, Team>();

  try {
    const validTeamIds = Array.from(
      new Set(
        (identifiers.teamIds || [])
          .filter((id): id is string => typeof id === 'string' && id.trim().length > 0 && !id.startsWith('manual_'))
      )
    );

    const validUserIds = Array.from(
      new Set(
        (identifiers.userIds || [])
          .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      )
    );

    const now = Date.now();

    // 0. Populate from in-memory cache if fresh
    validTeamIds.forEach(id => {
      const cached = globalTeamCacheById.get(id);
      const ts = cacheTimestamps.get(`t_${id}`) || 0;
      if (cached && now - ts < CACHE_TTL_MS) {
        teamById.set(id, cached);
      }
    });

    validUserIds.forEach(uid => {
      const cached = globalTeamCacheByUserId.get(uid);
      const ts = cacheTimestamps.get(`u_${uid}`) || 0;
      if (cached && now - ts < CACHE_TTL_MS) {
        teamByUserId.set(uid, cached);
      }
    });

    // Determine missing IDs that need Firestore fetching
    const uncachedTeamIds = validTeamIds.filter(id => !teamById.has(id));
    const uncachedUserIds = validUserIds.filter(uid => !teamByUserId.has(uid));

    if (uncachedTeamIds.length === 0 && uncachedUserIds.length === 0) {
      return { teamById, teamByUserId };
    }

    // 1. Fetch teams by team document ID (chunks of up to 30)
    for (let i = 0; i < uncachedTeamIds.length; i += 30) {
      const chunk = uncachedTeamIds.slice(i, i + 30);
      try {
        const snap = await getDocs(query(collection(db, 'teams'), where('__name__', 'in', chunk)));
        snap.docs.forEach(d => {
          const team = { id: d.id, ...d.data() } as Team;
          teamById.set(d.id, team);
          globalTeamCacheById.set(d.id, team);
          cacheTimestamps.set(`t_${d.id}`, now);
          if (team.ownerId) {
            teamByUserId.set(team.ownerId, team);
            globalTeamCacheByUserId.set(team.ownerId, team);
            cacheTimestamps.set(`u_${team.ownerId}`, now);
          }
          if (team.captainId) {
            teamByUserId.set(team.captainId, team);
            globalTeamCacheByUserId.set(team.captainId, team);
            cacheTimestamps.set(`u_${team.captainId}`, now);
          }
        });
      } catch (err) {
        console.warn('Error fetching teams by __name__ chunk:', err);
      }
    }

    // 2. For users who might own/captain a team, fetch where ownerId in uncachedUserIds
    for (let i = 0; i < uncachedUserIds.length; i += 30) {
      const chunk = uncachedUserIds.slice(i, i + 30);
      try {
        const ownerSnap = await getDocs(query(collection(db, 'teams'), where('ownerId', 'in', chunk)));
        ownerSnap.docs.forEach(d => {
          const team = { id: d.id, ...d.data() } as Team;
          teamById.set(d.id, team);
          globalTeamCacheById.set(d.id, team);
          cacheTimestamps.set(`t_${d.id}`, now);
          if (team.ownerId) {
            teamByUserId.set(team.ownerId, team);
            globalTeamCacheByUserId.set(team.ownerId, team);
            cacheTimestamps.set(`u_${team.ownerId}`, now);
          }
          if (team.captainId) {
            teamByUserId.set(team.captainId, team);
            globalTeamCacheByUserId.set(team.captainId, team);
            cacheTimestamps.set(`u_${team.captainId}`, now);
          }
        });
      } catch (err) {
        console.warn('Error fetching teams by ownerId chunk:', err);
      }
    }

    // 3. For users who are members of dedicated teams (via team_members collection)
    const missingUserIds = uncachedUserIds.filter(uid => !teamByUserId.has(uid));
    const newlyDiscoveredTeamIds: string[] = [];

    for (let i = 0; i < missingUserIds.length; i += 30) {
      const chunk = missingUserIds.slice(i, i + 30);
      try {
        const memberSnap = await getDocs(query(collection(db, 'team_members'), where('userId', 'in', chunk)));
        memberSnap.docs.forEach(d => {
          const data = d.data();
          if (data.teamId && data.userId) {
            if (!teamById.has(data.teamId)) {
              newlyDiscoveredTeamIds.push(data.teamId);
            }
          }
        });
      } catch (err) {
        console.warn('Error fetching team_members by userId chunk:', err);
      }
    }

    // 4. Fetch newly discovered team IDs
    const uniqueNewIds = Array.from(new Set(newlyDiscoveredTeamIds)).filter(tid => !teamById.has(tid));
    for (let i = 0; i < uniqueNewIds.length; i += 30) {
      const chunk = uniqueNewIds.slice(i, i + 30);
      try {
        const snap = await getDocs(query(collection(db, 'teams'), where('__name__', 'in', chunk)));
        snap.docs.forEach(d => {
          const team = { id: d.id, ...d.data() } as Team;
          teamById.set(d.id, team);
          globalTeamCacheById.set(d.id, team);
          cacheTimestamps.set(`t_${d.id}`, now);
          if (team.ownerId) {
            teamByUserId.set(team.ownerId, team);
            globalTeamCacheByUserId.set(team.ownerId, team);
            cacheTimestamps.set(`u_${team.ownerId}`, now);
          }
          if (team.captainId) {
            teamByUserId.set(team.captainId, team);
            globalTeamCacheByUserId.set(team.captainId, team);
            cacheTimestamps.set(`u_${team.captainId}`, now);
          }
        });
      } catch (err) {
        console.warn('Error fetching newly discovered teams chunk:', err);
      }
    }

    // 5. Connect any remaining user memberships to their teams in teamByUserId
    for (const uid of validUserIds) {
      if (!teamByUserId.has(uid)) {
        for (const team of teamById.values()) {
          if (
            team.ownerId === uid ||
            team.captainId === uid ||
            (Array.isArray(team.members) && team.members.includes(uid)) ||
            (Array.isArray(team.players) && team.players.includes(uid))
          ) {
            teamByUserId.set(uid, team);
            globalTeamCacheByUserId.set(uid, team);
            cacheTimestamps.set(`u_${uid}`, now);
            break;
          }
        }
      }
    }
  } catch (err) {
    console.warn('fetchDedicatedTeams failed with error:', err);
  }

  return { teamById, teamByUserId };
}

export interface ResolvedSlotDisplay {
  teamName: string;
  isDedicatedTeam: boolean;
  teamTag: string | null;
  teamLogoUrl: string | null;
  leader: string;
  inGameName: string | null;
  inGameId: string | null;
  teammates: any[];
  teamId: string | null;
}

/**
 * Resolves the display information for a scrim or tournament slot,
 * ensuring dedicated teams from the Teams feature take priority in Duo and Squad formats.
 */
export function resolveSlotTeam(
  slot: any,
  part: any,
  teamsData?: DedicatedTeamsLookup,
  isTeamFormat: boolean = true
): ResolvedSlotDisplay {
  const slotNum = slot.slotNumber;
  const rawTeamId = slot.teamId || part?.teamId;
  const rawUserId = slot.userId || part?.userId;

  // 1. Look up dedicated team from teams collection
  let dedicatedTeam: Team | undefined;
  if (teamsData) {
    if (rawTeamId && teamsData.teamById.has(rawTeamId)) {
      dedicatedTeam = teamsData.teamById.get(rawTeamId);
    } else if (rawUserId && teamsData.teamByUserId.has(rawUserId)) {
      dedicatedTeam = teamsData.teamByUserId.get(rawUserId);
    }
  }

  const leaderName = slot.leader || part?.username || part?.inGameName || 'Player';
  const inGameName = part?.inGameName || (part?.username && part.username !== leaderName ? part.username : null);
  const inGameId = slot.inGameId || part?.inGameId || part?.gameUid || null;
  const teammates = part?.teammates || part?.members || slot.teammates || [];

  if (dedicatedTeam && dedicatedTeam.name) {
    return {
      teamName: dedicatedTeam.name,
      isDedicatedTeam: true,
      teamTag: dedicatedTeam.tag || null,
      teamLogoUrl: dedicatedTeam.logoUrl || null,
      leader: leaderName,
      inGameName,
      inGameId,
      teammates,
      teamId: dedicatedTeam.id,
    };
  }

  // 2. If no dedicated team was fetched, evaluate stored teamName vs leader/player name
  const storedTeamName = (slot.teamName && slot.teamName !== 'Reserved' ? slot.teamName : null) ||
                         (part?.teamName && part.teamName !== 'Reserved' ? part.teamName : null);

  if (storedTeamName) {
    const isPlayerNameFallback =
      storedTeamName.trim().toLowerCase() === leaderName.trim().toLowerCase() ||
      (inGameName && storedTeamName.trim().toLowerCase() === inGameName.trim().toLowerCase());

    if (!isPlayerNameFallback) {
      // It's a real custom/entered team name
      return {
        teamName: storedTeamName,
        isDedicatedTeam: false,
        teamTag: null,
        teamLogoUrl: null,
        leader: leaderName,
        inGameName,
        inGameId,
        teammates,
        teamId: rawTeamId || rawUserId || null,
      };
    } else if (!isTeamFormat) {
      // For Solo matches, showing the player's name as participant name is expected
      return {
        teamName: storedTeamName,
        isDedicatedTeam: false,
        teamTag: null,
        teamLogoUrl: null,
        leader: leaderName,
        inGameName,
        inGameId,
        teammates,
        teamId: rawTeamId || rawUserId || null,
      };
    }
  }

  // 3. Fallback for Duo / Squad when only player name or no team name was recorded
  const fallbackTeamName = storedTeamName && !isTeamFormat
    ? storedTeamName
    : (slot.status === 'filled' || part ? `Team ${slotNum}` : `Slot ${slotNum}`);

  return {
    teamName: fallbackTeamName,
    isDedicatedTeam: false,
    teamTag: null,
    teamLogoUrl: null,
    leader: leaderName,
    inGameName,
    inGameId,
    teammates,
    teamId: rawTeamId || rawUserId || null,
  };
}
