import { ProviderError } from './provider.errors.js';
import type { ProviderCooldownService } from './provider-cooldown.service.js';

export interface ProviderChainAttempt<T> {
  slug: string;
  run: () => Promise<T>;
}

export interface ProviderChainOptions<T> {
  /** A successful-but-empty result is treated as a miss and falls through to the next provider (unless it's the last one). */
  isEmpty?: (result: T) => boolean;
  /**
   * Total time budget across the whole chain, not per provider. Once elapsed
   * time exceeds this and at least one attempt has already failed, no further
   * providers are started - whatever error/empty result is already in hand is
   * returned/thrown rather than starting another slow hop. Existing capability
   * services (e.g. compare/evidence) already depend on staying inside the
   * x402 payment-signature validity window, and a deep fallback chain must not
   * blow that window just because it kept finding new providers to try.
   */
  overallTimeoutMs?: number;
  cooldown?: ProviderCooldownService;
}

export interface ProviderChainOutcome<T> {
  result: T;
  providerSlug: string;
}

/**
 * Tries each attempt in order, falling through to the next on any normalized
 * provider error (mirroring AcademicService's original OpenAlex->Crossref
 * pattern, generalized to an arbitrary ordered list). A provider currently in
 * cooldown is skipped unless it's the last attempt left - resilience means
 * always trying *something* rather than short-circuiting to a hard failure
 * purely because every candidate looked unhealthy.
 */
export async function runProviderChain<T>(
  attempts: ProviderChainAttempt<T>[],
  options: ProviderChainOptions<T> = {},
): Promise<ProviderChainOutcome<T>> {
  if (attempts.length === 0) {
    throw new Error('runProviderChain requires at least one provider attempt');
  }

  const deadline = options.overallTimeoutMs !== undefined ? Date.now() + options.overallTimeoutMs : undefined;
  let lastError: unknown;
  let lastEmptyOutcome: ProviderChainOutcome<T> | undefined;

  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i]!;
    const isLast = i === attempts.length - 1;

    if (deadline !== undefined && lastError !== undefined && Date.now() >= deadline) {
      break;
    }

    if (!isLast && options.cooldown && (await options.cooldown.isCoolingDown(attempt.slug))) {
      continue;
    }

    try {
      const result = await attempt.run();
      const outcome: ProviderChainOutcome<T> = { result, providerSlug: attempt.slug };

      if (!isLast && options.isEmpty?.(result)) {
        lastEmptyOutcome = outcome;
        continue;
      }

      return outcome;
    } catch (error) {
      if (!(error instanceof ProviderError)) {
        throw error;
      }
      lastError = error;
      if (options.cooldown) {
        await options.cooldown.markFailure(attempt.slug, error);
      }
    }
  }

  if (lastEmptyOutcome) {
    return lastEmptyOutcome;
  }
  throw lastError;
}
