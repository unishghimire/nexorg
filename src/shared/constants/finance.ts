/**
 * Centralized financial constants for NexPlay.
 * All revenue splits, fees, and limits live here — never hardcode percentages elsewhere.
 */
export const REVENUE_SPLIT = {
  ORGANIZER_SHARE: 0.85,
  PLATFORM_SHARE: 0.15,
} as const;

export const WALLET_LIMITS = {
  MIN_WITHDRAWAL: 100,       // Rs. 100
  MAX_DEPOSIT: 100000,       // Rs. 100,000
  MAX_WITHDRAWAL: 50000,     // Rs. 50,000
  MAX_SCREENSHOT_SIZE: 5 * 1024 * 1024, // 5MB
} as const;

export const RATE_LIMITS = {
  DEPOSIT: { windowMs: 15 * 60 * 1000, max: 5 },
  WITHDRAW: { windowMs: 15 * 60 * 1000, max: 3 },
  TX_HISTORY: { windowMs: 15 * 60 * 1000, max: 30 },
} as const;

export const TX_PAGE_SIZE = 10;

/** Calculate org and platform shares from profit. Returns integer paisa-free amounts. */
export function calculateRevenueSplit(profit: number) {
  if (profit <= 0) return { orgShare: 0, nexplayShare: 0 };
  return {
    orgShare: Math.round(profit * REVENUE_SPLIT.ORGANIZER_SHARE),
    nexplayShare: Math.round(profit * REVENUE_SPLIT.PLATFORM_SHARE),
  };
}

/**
 * Centralized Tournament Funding Calculation.
 * The platform NEVER subsidizes, lends, or advances prize pool money.
 * If prizePool > 0, the organization must secure 100% of the prize up-front.
 * If prizePool == 0 (free event without cash prize), required funding is 0.
 */
export function calculateTournamentRequiredFunding(
  tournament?: number | { prizePool?: number; entryFee?: number } | null
): number {
  if (typeof tournament === 'number') {
    return isNaN(tournament) ? 0 : Math.max(0, Math.round(tournament));
  }
  const prizePool = Number(tournament?.prizePool) || 0;
  return isNaN(prizePool) ? 0 : Math.max(0, Math.round(prizePool));
}

export interface FundingCalculationResult {
  required: number;
  available: number;
  shortage: number;
  isFunded: boolean;
}

/** Calculate shortage and funding status if available wallet balance is insufficient */
export function calculateFundingShortage(
  requiredAmount: number,
  availableBalance: number
): FundingCalculationResult {
  const req = Math.max(0, Math.round(Number(requiredAmount) || 0));
  const avail = Math.max(0, Math.round(Number(availableBalance) || 0));
  const shortage = Math.max(0, req - avail);
  return {
    required: req,
    available: avail,
    shortage,
    isFunded: avail >= req,
  };
}

