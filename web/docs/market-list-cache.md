# Market List Cache (First-Render Speedup)

The markets page uses a client-side cache stored in `localStorage` to avoid the loading spinner on first paint.

## What is cached

A serialized `ProcessedMarket[]` list, including computed fields used by the UI (odds, status, time remaining, etc.).

## Cache key

`predinex_market_list_v1`

## Freshness / invalidation rules

1. Each cached payload is tagged with:
   - `version`: allows invalidating all existing entries when the payload shape changes.
   - `cachedAt`: the time the list was last fetched and stored.
2. The cache is considered **fresh for 30 seconds** (`MARKET_LIST_CACHE_TTL_MS`).
3. If the cache is:
   - older than the TTL, or
   - the version does not match, or
   - the payload is malformed,
   it is removed and the hook falls back to live fetching.

## Refresh behavior

Even when cached data is fresh, the hook still performs a background fetch to update the list and overwrite the cache.
If that background refresh fails, the UI preserves the cached list (so the page does not regress to an error/empty state).

## Preloading / warm-up

In addition to the markets-page hook, the app root mounts a small client component (`MarketListPreloader`) that warms the cache during browser idle time when the cached payload is stale or missing.
This improves first navigation to `/markets` within the same browser session.

## Deployment compatibility

This strategy is per-browser and does not depend on server deployment features (SSR/ISR/route caching), so it works across typical deployment models.

