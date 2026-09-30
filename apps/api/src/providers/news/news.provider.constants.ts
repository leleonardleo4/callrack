/**
 * Shared tuning for every news fallback provider (everything except GDELT,
 * which keeps its own deliberately-tuned 6s/1-retry config - see
 * gdelt.provider.ts). Fallback providers fail fast with zero internal
 * retries: resilience now comes from moving to the next provider in the
 * chain, not from retrying one provider multiple times, since either would
 * eat into the same overall time budget (see NEWS_SEARCH_FALLBACK_BUDGET_MS
 * in news.service.ts) that exists to protect the x402 payment-signature
 * validity window.
 */
export const FALLBACK_PROVIDER_TIMEOUT_MS = 4_000;
export const FALLBACK_PROVIDER_RETRY = { maxAttempts: 0 } as const;
