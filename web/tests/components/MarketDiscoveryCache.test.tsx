import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useMarketDiscovery } from '../../app/lib/hooks/useMarketDiscovery';
import {
  writeMarketListCache,
  MARKET_LIST_CACHE_TTL_MS
} from '../../app/lib/market-list-cache';
import type { ProcessedMarket, PoolData } from '../../app/lib/market-types';

vi.mock('../../app/lib/enhanced-stacks-api', () => ({
  fetchAllPools: vi.fn()
}));

vi.mock('../../app/lib/market-utils', () => ({
  getCurrentBlockHeight: vi.fn(() => 150000),
  processMarketData: vi.fn()
}));

import { fetchAllPools } from '../../app/lib/enhanced-stacks-api';
import { processMarketData } from '../../app/lib/market-utils';

function MarketsDiscoveryHarness() {
  const { isLoading, allMarkets } = useMarketDiscovery();
  return <div>{isLoading ? 'loading' : 'loaded'}-{allMarkets.length}</div>;
}

describe('Market discovery cache', () => {
  const baseNow = new Date('2026-01-01T00:00:00.000Z').getTime();

  const cachedMarket: ProcessedMarket = {
    poolId: 1,
    title: 'Cached Market',
    description: 'Cached data for first-render test.',
    outcomeA: 'A',
    outcomeB: 'B',
    totalVolume: 123,
    oddsA: 60,
    oddsB: 40,
    status: 'active',
    timeRemaining: 10,
    createdAt: 1700000000,
    creator: 'ST123'
  };

  const poolMock: PoolData = {
    poolId: 1,
    creator: 'ST123',
    title: 'Pool title',
    description: 'Pool description',
    outcomeAName: 'A',
    outcomeBName: 'B',
    totalA: 1n,
    totalB: 1n,
    settled: false,
    winningOutcome: null,
    createdAt: 1700000000,
    settledAt: null,
    expiry: 999999
  };

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(baseNow));

    vi.mocked(fetchAllPools).mockResolvedValue([poolMock]);
    vi.mocked(processMarketData).mockReturnValue(cachedMarket);
  });

  it('uses fresh cached data on first render (no loading state)', () => {
    writeMarketListCache([cachedMarket], baseNow);

    render(<MarketsDiscoveryHarness />);

    expect(screen.getByText('loaded-1')).toBeInTheDocument();
  });

  it('treats stale cached data as invalid and refreshes', async () => {
    writeMarketListCache([cachedMarket], baseNow);

    // Move time beyond TTL before render so the cache reads as stale.
    vi.setSystemTime(new Date(baseNow + MARKET_LIST_CACHE_TTL_MS + 10_000));

    render(<MarketsDiscoveryHarness />);
    expect(screen.getByText('loading-0')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('loaded-1')).toBeInTheDocument();
    });
  });
});

