/**
 * Wallet Telemetry
 * Structured, privacy-safe analytics hooks for wallet connection events.
 * Sensitive fields (addresses, private keys, signatures) are intentionally excluded.
 */

export type WalletEvent =
  | 'wallet.connect.attempt'
  | 'wallet.connect.success'
  | 'wallet.connect.cancel'
  | 'wallet.connect.failure';

export interface WalletEventPayload {
  event: WalletEvent;
  /** ISO timestamp of the event */
  timestamp: string;
  /** Approximate duration in ms since the connection attempt started, when applicable */
  durationMs?: number;
  /** Human-readable reason for failure, if available. Must not contain key material. */
  errorMessage?: string;
}

/**
 * Emits a structured wallet telemetry event.
 * Replace the console.info call with your analytics provider (e.g. Segment, PostHog)
 * to ship events to a real backend. No sensitive user data is included.
 */
export function emitWalletEvent(payload: WalletEventPayload): void {
  // Ensure no address or key material ever leaks into telemetry
  const safePayload = {
    event: payload.event,
    timestamp: payload.timestamp,
    ...(payload.durationMs !== undefined && { durationMs: payload.durationMs }),
    ...(payload.errorMessage !== undefined && { errorMessage: payload.errorMessage }),
  };

  // In development, surface events in the console for easy debugging
  if (process.env.NODE_ENV !== 'production') {
    console.info('[wallet-telemetry]', safePayload);
  }

  // TODO: replace with your analytics provider, e.g.:
  // analytics.track(safePayload.event, safePayload);
}
