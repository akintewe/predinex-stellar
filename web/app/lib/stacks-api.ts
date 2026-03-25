/**
 * @deprecated Use @/lib/stacks-api instead
 * This file is kept for backward compatibility - all exports re-export from the canonical source
 */
export {
  getPoolCount,
  getPool,
  fetchActivePools,
  getUserBet,
  getUserActivity,
  getMarkets,
  getTotalVolume,
  getClaimInfo,
  Pool,
  UserBetInfo,
  ClaimInfo,
  ActivityItem,
  ActivityEvent,
} from '@/lib/stacks-api';
