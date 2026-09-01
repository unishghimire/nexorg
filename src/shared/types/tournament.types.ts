export type TournamentStageType = 'registration' | 'qualifiers' | 'quarter_finals' | 'semi_finals' | 'grand_finals' | 'completed';
export type TournamentStatus = 'upcoming' | 'check_in' | 'live' | 'completed' | 'cancelled';
export type TournamentFormat = 'Battle Royale' | '5v5' | '1v1';

export interface TournamentStageConfig {
  stageNumber: number;
  name: string;               // e.g. "Group Stage", "Grand Finals"
  stageType: TournamentStageType;
  teamsCount: number;
  groupsCount: number;
  teamsPerGroup: number;      // Strict group limit: e.g. 12
  advancingPerGroup: number;  // Top N qualify for next stage
  status: 'pending' | 'active' | 'completed';
}

export interface TournamentGroupTeam {
  teamId: string;
  teamName: string;
  teamLogo?: string;
  captainUid: string;
  memberUids: string[];
  isQualified?: boolean;
  score?: number;
  rank?: number;
}

export interface TournamentGroup {
  id: string;                 // e.g. "stage1_groupA"
  tournamentId: string;
  stageNumber: number;
  name: string;               // "Group A"
  maxTeams: number;           // Strict limit: 12
  currentTeamsCount: number;
  teams: TournamentGroupTeam[];
  status: 'upcoming' | 'live' | 'completed';
  matches?: {
    id: string;
    round?: number;
    team1Id?: string;
    team2Id?: string;
    score1?: number;
    score2?: number;
    winnerId?: string;
    status: 'upcoming' | 'live' | 'completed';
    results?: any[];
  }[];
  results?: any[];
}

export interface Tournament {
  id: string;
  title: string;
  game: string;
  format: TournamentFormat;
  bannerUrl?: string;
  startTime: string | any;
  entryFee: number;
  prizePool: number;
  maxTeamsTotal: number;
  currentTeamsTotal?: number;
  currentPlayers?: number;
  currentStage?: number;
  stages?: TournamentStageConfig[];
  groups?: TournamentGroup[];
  status: TournamentStatus;
  hostUid: string;
  orgId?: string;
  rules?: string;
  ytLink?: string;
  winners?: { rank: number; userId: string; username: string; prize: number }[];
  payoutDistribution?: { rank: number; percentage: number; amount: number }[];
  createdAt?: string | any;
  updatedAt?: string | any;
}
