// Sponsored listing rules, shared by the server and the browser.
// Must match `min_price` in activate_premium_bid (supabase/migrations/premium_rank_by_price.sql).

/** Sponsored listings shown on the homepage; the rest are on /sponsored. */
export const HOME_SPONSORED = 10;

/** Lowest amount (USD) a sponsored listing can be bought for. */
export const MIN_BID_USD = 1;

/** Bids are whole dollars; beating a listing takes its bid plus this much. */
export const OUTBID_STEP_USD = 1;

/** Social links a sponsored listing can save and show, at any rank. */
export const MAX_SOCIAL_LINKS = 4;

/**
 * Rank a new bid would get among the current bids (sorted highest first).
 * Equal bids keep the earlier one ahead, so only a strictly higher bid passes them.
 */
export function rankForBid(bidUsd: number, currentBids: number[]): number {
  return currentBids.filter(b => b >= bidUsd).length + 1;
}

/** Lowest bid that reaches `rank` (1-based), given the current bids sorted highest first. */
export function bidForRank(rank: number, currentBids: number[]): number {
  const toBeat = currentBids[rank - 1];
  return toBeat == null ? MIN_BID_USD : Math.max(MIN_BID_USD, Math.floor(toBeat) + OUTBID_STEP_USD);
}
