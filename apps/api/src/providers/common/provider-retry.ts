import { isRetryableProviderError, ProviderError } from './provider.errors.js';

export interface RetryPolicy {
  /** Number of retry attempts after the initial try. Default: 2. */
  maxAttempts?: number;
  /** Base delay in ms used for exponential backoff. Default: 150. */
  baseDelayMs?: number;
  /** Upper bound for any computed backoff delay. Default: 2000. */
  maxDelayMs?: number;
}

const DEFAULT_RETRY_POLICY: Required<RetryPolicy> = {
  maxAttempts: 2,
  baseDelayMs: 150,
  maxDelayMs: 2000,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeBackoffDelay(attempt: number, policy: Required<RetryPolicy>): number {
  const exponential = policy.baseDelayMs * 2 ** attempt;
  return Math.min(exponential, policy.maxDelayMs);
}

/**
 * Runs `fn`, retrying a bounded number of times only for errors that are
 * known to be transient (see `isRetryableProviderError`). Never retries
 * invalid-request, authentication, or malformed-response failures.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  policy: RetryPolicy = {},
): Promise<T> {
  const resolvedPolicy: Required<RetryPolicy> = { ...DEFAULT_RETRY_POLICY, ...policy };
  let attempt = 0;

  for (;;) {
    try {
      return await fn();
    } catch (error) {
      const isProviderError = error instanceof ProviderError;
      const canRetry =
        isProviderError && isRetryableProviderError(error) && attempt < resolvedPolicy.maxAttempts;

      if (!canRetry) {
        throw error;
      }

      const delay =
        isProviderError && error.retryAfterMs !== undefined
          ? error.retryAfterMs
          : computeBackoffDelay(attempt, resolvedPolicy);

      await sleep(delay);
      attempt += 1;
    }
  }
}

/** Parses the standard HTTP `Retry-After` header (seconds or HTTP-date form). */
export function parseRetryAfterMs(headerValue: string | null): number | undefined {
  if (!headerValue) {
    return undefined;
  }

  const seconds = Number(headerValue);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const dateMs = Date.parse(headerValue);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }

  return undefined;
}
