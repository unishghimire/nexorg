import { Timestamp } from 'firebase/firestore';
import { TournamentMode, RewardConfig, RewardSnapshot, PlayerKillReward, RewardAuditEntry } from './per-kill';

export interface UserProfile {
    uid: string;
    email: string;
    username: string;
    role: 'player' | 'organizer' | 'admin';
    isPowerOrganizer?: boolean;
    balance: number;
    totalEarnings: number;
    xp: number;
    level: number;
    inGameId: string;
    inGameName?: string;
    teamName: string;
    teamId?: string;
    isVerified?: boolean;
    isChampion?: boolean;
    rank?: string;
    points?: number;
    wins?: number;
    tournamentsPlayed?: number;
    winRate?: number;
    rankChange?: number;
    phone: string;
    isBanned: boolean;
    banReason?: string;
    createdAt: Timestamp | any;
    orgStatus?: 'pending' | 'approved' | 'rejected';
    orgName?: string;
    isOrganizer?: boolean;
    discord?: string;
    youtube?: string;
    whatsapp?: string;
    bio?: string;
    profilePicUrl?: string;
    bannerUrl?: string;
    contactInfo?: string;
    skills?: string[];
    status?: 'online' | 'idle' | 'dnd' | 'offline';
    customActivity?: string;
    lastActive?: Timestamp | any;
    orgPendingEarnings?: number;
    orgWalletBalance?: number;
    reservedBalance?: number;
    stats?: {
        totalMatches: number;
        wins: number;
        losses: number;
    };
    resultPresets?: { id: string; name: string; config: ResultTemplateConfig }[];
}

export interface PrizeDistribution {
    id: string; // Unique ID for drag-and-drop
    rank: number;
    label: string; // e.g., "1st", "MVP"
    amount: number;
}

export interface ManualResult {
    id: string;
    team: string;
    rank: number;
    score: number;
    status: string;
    kills?: number;
}

export interface ResultTemplateConfig {
    template: 'classic' | 'esports' | 'highlight' | 'compact' | 'custom';
    theme: {
        primaryColor: string;
        background: string;
    };
    showFields: {
        rank: boolean;
        team: boolean;
        score: boolean;
        status: boolean;
    };
}

export type TournamentStage = 'registration' | 'group_stage' | 'knockout' | 'completed';
export type TournamentFormat = 'single_elimination' | 'double_elimination' | 'round_robin' | 'swiss' | 'hybrid';

export interface TournamentGroup {
    id: string;
    name: string;
    teamLimit: number;
    teams: Team[]; 
    matches: Match[]; 
    isPublic: boolean;
    passCode?: string;
    inviteLink?: string;
    roomId?: string;
    roomPass?: string;
    // ─── Engine fields (optional, backward compat) ───
    status?: 'draft' | 'preview' | 'locked' | 'active' | 'completed';
    roundNumber?: number;
}

export interface RoundConfig {
    roundNumber: number;
    numGroups: number;
    qualificationRule: number;
    maps: string[];
    stageName?: string;
    status?: 'upcoming' | 'current' | 'completed';
    description?: string;
    date?: any;
    // ─── Tournament engine fields (optional, backward compat) ───
    teamsPerGroup?: number;
    matchesPerGroup?: number;
    qualificationType?: 'top_n_per_group' | 'total_top_n' | 'final_ranking';
    distributionMethod?: 'random' | 'seeded' | 'balanced';
    groupNamingStyle?: 'alpha' | 'numeric';
    locked?: boolean;
}

export interface MatchChangeLog {
    timestamp: Timestamp | any;
    oldTime: Timestamp | any;
    newTime: Timestamp | any;
    reason?: string;
    changedBy: string;
}

export interface Match {
    id: string;
    tournamentId?: string;
    groupId?: string;
    round: number;
    matchNumber?: number;
    team1Id?: string;
    team2Id?: string;
    score1?: number;
    score2?: number;
    status: 'scheduled' | 'live' | 'completed';
    map?: string;
    scheduledTime?: Timestamp | any;
    rescheduledTime?: Timestamp | any; // Added
    changeHistory?: MatchChangeLog[]; // Added
    winnerId?: string;
    replayLink?: string;
    // Battle Royale results — populated by ResultUploader (stores full ScoredResult with breakdown)
    // ponytail: type is TeamMatchResult[] for backward compat, but actual data includes placementPoints, killPoints, scoringVersion
    results?: TeamMatchResult[];
    screenshotUrl?: string;
}

export interface Team {
    id: string;
    name: string;
    tag?: string;
    description?: string;
    logoUrl?: string;
    bannerUrl?: string;
    ownerId?: string;
    createdAt?: Timestamp | any;
    region?: string;
    formationDate?: Timestamp | any;
    ranking?: number;
    rankChange?: number;
    points?: number;
    wins?: number;
    totalEarnings?: number;
    players?: string[]; // Array of user IDs
    members?: string[]; // Array of user IDs or member usernames
    captainId?: string;
    stats?: {
        wins: number;
        losses: number;
        draws: number;
        points: number;
    };
}

export interface PointRule {
    placementPoints: { rank: number; points: number }[];
    pointsPerKill: number;
    winnerBonus?: number;
    consistencyBonus?: number;
    bonusPoints?: { condition: string; points: number }[];
}

export interface MatchResultUpload {
    id: string;
    tournamentId: string;
    roundId: string;
    groupId: string;
    teamResults: TeamMatchResult[];
    screenshotUrl: string;
    uploadedBy: string;
    verified: boolean;
    createdAt: Timestamp | any;
}

export interface TeamMatchResult {
    teamId: string;
    teamName: string;
    placement: number;
    kills: number;
    totalPoints: number; // Calculated
}

export interface Scrim {
    id: string;
    title: string;
    game: string;
    type: 'open' | 'invite' | 'daily' | 'weekly';
    startTime: Timestamp | any;
    slots: number;
    filledSlots: number;
    status: 'open' | 'closed' | 'live' | 'completed';
    orgId: string;
    rules?: string;
    resultUrl?: string;
    // Fields from Tournament when mixed
    tournamentId?: string;
    bannerUrl?: string;
    time?: Timestamp | any;
    entryFee?: number;
    prizePool?: number;
    currentSlots?: number;
    matchType?: 'scrims' | 'tournament';
}

export interface Tournament {
    id: string;
    title: string;
    game: string;
    bannerUrl?: string;
    isFeatured?: boolean;
    prizePool: number;
    currency?: string; 
    prizeDistribution?: PrizeDistribution[];
    entryFee: number;
    slots: number;
    currentPlayers: number;
    type: string;
    matchType?: 'scrims' | 'tournament';
    scheduleType?: 'auto' | 'manual';
    teamSize: number;
    teamType: 'solo' | 'duo' | 'squad';
    map?: string;
    startTime: Timestamp | any;
    rules?: string;
    status: 'upcoming' | 'live' | 'completed' | 'cancelled' | 'draft' | 'published' | 'paused' | 'pending_funding';
    stage?: TournamentStage;
    format?: TournamentFormat;
    groups?: TournamentGroup[];
    bracketMatches?: Match[];
    hostUid: string;
    hostName?: string;
    createdAt: Timestamp | any;
    roomId?: string;
    roomPass?: string;
    ytLink?: string;
    uploadLink?: string;
    resultUrl?: string;
    winners?: { uid: string; amount: number; rank: number; username?: string }[];
    distributedAmount?: number;
    manualResults?: ManualResult[];
    resultTemplate?: ResultTemplateConfig;
    roadmap?: RoundConfig[];
    currentRound?: number;
    pointSystem?: PointRule; // Multi-match points
    registrationType?: 'auto' | 'manual';
    // ─── Funding & Prize Reserve Fields ───
    fundingStatus?: TournamentFundingStatus;
    requiredFunding?: number;
    reservedFunding?: number;
    fundingReservedAt?: Timestamp | any;
    // ─── Engine fields (optional, backward compat) ───
    participantMode?: 'team' | 'solo';
    // Frozen scoring snapshot — inherited from game at creation, never changes
    scoringSnapshot?: {
        gameId: string;
        gameName: string;
        killPoints: number;
        placementPoints: Record<string, number>;
        maxPlacement?: number;
        scoringVersion: number;
        source: 'game-default' | 'custom';
        snapshotAt: Timestamp | any;
    };
    // ─── Per-Kill Reward fields (optional, backward compat) ───
    tournamentMode?: TournamentMode;           // 'POINTS' (default) | 'PER_KILL_REWARD'
    rewardSnapshot?: RewardSnapshot;           // Frozen reward config from game defaults
    // Individual kill ledger — one entry per player per match
    killRewards?: PlayerKillReward[];
    // Audit trail for reward changes
    rewardAuditLog?: RewardAuditEntry[];
    // ─── Audit log — tracks all major tournament operations ───
    auditLog?: {
        timestamp: Timestamp | any;
        userId: string;
        userName: string;
        action: string;
        details?: string;
        roundNumber?: number;
        targetId?: string;
    }[];
}

export type TournamentFundingStatus =
    | 'NOT_REQUIRED'
    | 'PENDING_FUNDING'
    | 'RESERVED'
    | 'COMPLETED'
    | 'REFUNDED'
    | 'CANCELLED';

export interface TournamentFundingRecord {
    tournamentId: string;
    organizationId: string;
    requiredAmount: number;
    reservedAmount: number;
    releasedAmount: number;
    usedAmount: number;
    status: TournamentFundingStatus;
    currency: string;
    createdAt: Timestamp | any;
    updatedAt: Timestamp | any;
}

export interface Transaction {
    id: string;
    userId: string;
    username?: string;
    userEmail?: string;
    type:
        | 'deposit'
        | 'withdrawal'
        | 'withdraw'
        | 'prize'
        | 'refund'
        | 'entry_fee'
        | 'promo'
        | 'tournament_reservation'
        | 'tournament_release'
        | 'prize_payout'
        | 'admin_adjustment';
    amount: number;
    method: string;
    refId: string;
    status: 'pending' | 'success' | 'completed' | 'rejected' | 'refunded';
    timestamp: Timestamp | any;
    desc?: string;
    proofUrl?: string;
    rejectionReason?: string;
    accountDetails?: string;
    confirmedBy?: string;
    confirmedByUsername?: string;
    transactionCode?: string;
    tournamentId?: string;
}

export interface PaymentCategory {
    id: string;
    name: string;
    description: string;
    isActive: boolean;
    createdAt: Timestamp | any;
}

export interface PaymentMethod {
    id: string;
    categoryId: string; // Reference to PaymentCategory
    name: string;
    qrUrl: string;
    instructions: string;
    type: string; // Kept for backwards compatibility or specific provider name
    isActive: boolean;
    createdAt: Timestamp | any;
}

export interface Slide {
    id: string;
    imageUrl: string;
    title: string;
    description?: string;
    link: string;
    buttonText: string;
    isActive: boolean;
    createdAt: Timestamp | any;
}

export interface PromoCode {
    id: string;
    code: string;
    amount: number;
    maxUses: number;
    currentUses: number;
    isActive: boolean;
    createdAt: Timestamp | any;
}

export interface Notification {
    id: string;
    userId: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'alert' | 'invite';
    read: boolean;
    link?: string;
    timestamp: Timestamp | any;
}

export interface TeamMember {
    id: string;
    teamId: string;
    userId: string;
    username?: string;
    inGameName?: string;
    role: 'admin' | 'moderator' | 'member';
    roleInTeam?: 'Captain' | 'Fragger' | 'IGL' | 'Support' | 'Scout';
    joinedAt: Timestamp | any;
    user?: UserProfile; // Optional joined data
}

export interface TeamInvite {
    id: string;
    teamId: string;
    teamName: string;
    inviterId: string;
    inviteeId: string;
    status: 'pending' | 'accepted' | 'declined';
    createdAt: Timestamp | any;
}

export interface TeamActivity {
    id: string;
    teamId: string;
    userId: string;
    userName: string;
    action: string;
    details?: string;
    createdAt: Timestamp | any;
}

export interface MatchHistory {
    id: string;
    userId?: string;
    teamId?: string;
    tournamentId: string;
    tournamentName: string;
    result: 'victory' | 'defeat';
    kills: number;
    prize: number;
    timestamp: Timestamp | any;
}

export interface Game {
    id: string;
    name: string;
    logoUrl: string;
    modes: string[];
    isPublished: boolean;
    createdAt: Timestamp | any;
    // Game-level scoring config (admin configures, new tournaments inherit)
    scoring?: {
        enabled: boolean;
        killPoints: number;
        placementPoints: Record<string, number>;
        maxPlacement?: number;
        scoringVersion: number;
        updatedAt?: Timestamp | any;
        updatedBy?: string;
    };
}

export interface TournamentWebhooks {
    announcement?: string;    // Tournament Announcement Webhook
    registration?: string;    // Registration Announcement Webhook
    group?: string;           // Group Draw Webhook
    matchSchedule?: string;   // Match Schedule & Room Details Webhook
    result?: string;          // Match Results Webhook
    champion?: string;        // Champion Announcement Webhook
}

export interface ScrimWebhooks {
    announcement?: string;    // Scrim Announcement Webhook
    registration?: string;    // Scrim Registration / Slot Booking Webhook
    group?: string;           // Scrim Group / Lobby Webhook
    matchSchedule?: string;   // Scrim Match Schedule & Room Details Webhook
    result?: string;          // Scrim Results Webhook
    champion?: string;        // Scrim Champion / Winner Webhook
}

export interface DiscordWebhooksConfig {
    tournaments?: TournamentWebhooks;
    scrims?: ScrimWebhooks;
    autoAnnounce?: {
        tournaments?: boolean;
        scrims?: boolean;
    };
}

export interface SiteSettings {
    minWithdrawal: number;
    supportEmail: string;
    supportPhone: string;
    notice: string;
    isNoticeActive: boolean;
    isOrgFormOpen: boolean;
    orgFormDescription?: string;
    maintenanceMode?: boolean;
    discordWebhooks?: DiscordWebhooksConfig;
    discordWebhookTournaments?: string;
    discordWebhookScrims?: string;
    autoDiscordTournamentAnnouncements?: boolean;
    updatedAt: Timestamp | any;
}

export interface Participant {
    id: string;
    userId: string;
    tournamentId: string;
    username: string;
    inGameId: string;
    teamName: string;
    teamId?: string;
    teammates?: string[];
    status?: 'pending' | 'approved' | 'rejected';
    logoUrl?: string;
    timestamp: Timestamp | any;
    // ─── Check-in & eligibility ───
    checkedIn?: boolean;
    checkedInAt?: Timestamp | any;
    paymentStatus?: 'pending' | 'confirmed' | 'failed' | 'free';
    isDisqualified?: boolean;
    isWithdrawn?: boolean;
    // ─── Per-round progression (stored for history) ───
    progression?: {
        roundNumber: number;
        groupId: string;
        groupName: string;
        rank: number;
        kills: number;
        totalPoints: number;
        qualificationStatus: 'qualified' | 'eliminated' | 'pending' | 'disqualified' | 'withdrawn';
    }[];
}

export interface Media {
    id: string;
    userId: string;
    url: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    createdAt: Timestamp | any;
}

export interface OrgApplication {
    id: string;
    userId: string;
    username: string;
    name: string;
    orgName: string;
    whatsapp: string;
    email: string;
    proofLink: string;
    status: 'pending' | 'approved' | 'rejected';
    rejectReason?: string;
    timestamp: Timestamp | any;
}

export interface OrgPost {
    id: string;
    orgId: string;
    orgName: string;
    orgAvatar?: string;
    title: string;
    content: string;
    imageUrl?: string;
    createdAt: Timestamp | any;
    updatedAt?: Timestamp | any;
}

export interface ActivityLog {
    id: string;
    adminId: string;
    adminEmail?: string;
    action: string;
    details: string;
    timestamp: Timestamp | any;
}

export interface TournamentEarning {
    id: string;
    tournamentId: string;
    tournamentName: string;
    orgId: string;
    orgName: string;
    entryFeeTotal: number;
    prizePoolTotal: number;
    profit: number;
    orgShare: number;
    nexplayShare: number;
    status: 'pending' | 'released' | 'no_earnings';
    createdAt: Timestamp | any;
    releasedAt?: Timestamp | any;
}
