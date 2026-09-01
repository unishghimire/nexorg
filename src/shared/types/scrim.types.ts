export type ScrimFormat = 'Squad' | 'Duo' | 'Solo';
export type ScrimStatus = 'open' | 'full' | 'credentials_sent' | 'live' | 'completed' | 'cancelled';

export interface ScrimSlot {
  slotNumber: number;          // 1..12 for Squad, 1..25 for Duo, 1..48 for Solo
  status: 'open' | 'reserved' | 'locked';
  teamId?: string | null;
  teamName?: string | null;
  captainUid?: string | null;
  captainDiscord?: string | null;
  joinedAt?: string | null;
}

export interface Scrim {
  id: string;
  title: string;
  game: string;                // 'Free Fire' | 'PUBG Mobile' | 'MLBB' | 'Valorant'
  format: ScrimFormat;
  map?: string;                // e.g. 'Bermuda', 'Erangel', 'Kalahari'
  startTime: string | any;
  entryFee: number;
  prizePool: number;
  totalSlots: number;          // Squad: 12, Duo: 25, Solo: 48
  filledSlots: number;
  slots: ScrimSlot[];
  status: ScrimStatus;
  hostUid: string;
  orgId?: string;
  rules?: string;
  ytLink?: string;
  payoutStatus?: 'unpaid' | 'paid';
  createdAt?: string | any;
  updatedAt?: string | any;
}

export interface ScrimCredentials {
  roomId: string;
  roomPass: string;
  streamUrl?: string;
  updatedAt?: string | any;
}

export interface ScrimResultEntry {
  rank: number;
  teamId?: string;
  teamName: string;
  teamLogo?: string;
  kills: number;
  placementPoints: number;
  killPoints: number;
  totalPoints: number;
  prizeAmount?: number;
}
