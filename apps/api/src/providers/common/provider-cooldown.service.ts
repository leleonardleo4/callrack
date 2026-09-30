import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service.js';
import { ProviderError, ProviderErrorCode } from './provider.errors.js';

/** How long a provider sits out of the fallback chain after a given failure. */
function cooldownSecondsForError(error: ProviderError): number | undefined {
  switch (error.code) {
    case ProviderErrorCode.PROVIDER_RATE_LIMITED:
      return error.retryAfterMs !== undefined ? Math.max(1, Math.ceil(error.retryAfterMs / 1000)) : 60;
    case ProviderErrorCode.PROVIDER_UNAVAILABLE:
      return 30;
    case ProviderErrorCode.PROVIDER_TIMEOUT:
      return 20;
    // A misconfigured/expired key fails every request until someone fixes it -
    // cool down hard rather than retrying it every request in the meantime.
    case ProviderErrorCode.PROVIDER_AUTHENTICATION_FAILED:
      return 300;
    case ProviderErrorCode.PROVIDER_BAD_RESPONSE:
    case ProviderErrorCode.PROVIDER_UNKNOWN_ERROR:
      return 30;
    // Invalid-request failures are almost always specific to this one query,
    // not the provider's health - penalizing every other query for it would
    // be wrong, so this provider stays eligible for the next request.
    case ProviderErrorCode.PROVIDER_INVALID_REQUEST:
      return undefined;
    default:
      return 30;
  }
}

/**
 * Tracks which providers are temporarily unavailable, Redis-backed with a
 * process-local fallback. Mirrors CapabilityCacheService's posture: Redis
 * being unreachable degrades to "assume available" (never to "assume every
 * provider is down"), and every write also lands in the in-memory map so a
 * single process still self-throttles even without Redis.
 */
@Injectable()
export class ProviderCooldownService {
  private readonly logger = new Logger(ProviderCooldownService.name);
  private readonly memoryCooldowns = new Map<string, number>();

  constructor(private readonly redis: RedisService) {}

  async isCoolingDown(slug: string): Promise<boolean> {
    if (this.redis.isReady) {
      try {
        return await this.redis.cache.exists(this.key(slug));
      } catch (error) {
        this.logger.warn(`Cooldown read failed for "${slug}": ${(error as Error).message}`);
      }
    }
    const until = this.memoryCooldowns.get(slug);
    return until !== undefined && until > Date.now();
  }

  async markFailure(slug: string, error: ProviderError): Promise<void> {
    const ttlSeconds = cooldownSecondsForError(error);
    if (ttlSeconds === undefined) {
      return;
    }

    this.memoryCooldowns.set(slug, Date.now() + ttlSeconds * 1000);

    if (!this.redis.isReady) {
      return;
    }
    try {
      await this.redis.cache.set(this.key(slug), '1', ttlSeconds);
    } catch (error_) {
      this.logger.warn(`Cooldown write failed for "${slug}": ${(error_ as Error).message}`);
    }
  }

  private key(slug: string): string {
    return `provider:cooldown:${slug}`;
  }
}
