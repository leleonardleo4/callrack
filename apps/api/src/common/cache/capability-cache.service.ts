import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service.js';

export interface CacheResult<T> {
  value: T;
  cacheHit: boolean;
}

/**
 * Thin Redis-backed cache for capability services. This is the only place
 * capability code touches Redis — provider adapters never do. Failures are
 * always non-fatal: a cache miss/error simply falls through to `loader`, and
 * a rejected `loader` is never cached.
 */
@Injectable()
export class CapabilityCacheService {
  private readonly logger = new Logger(CapabilityCacheService.name);

  constructor(private readonly redis: RedisService) {}

  async getOrSet<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<CacheResult<T>> {
    const cached = await this.safeGet<T>(key);
    if (cached !== undefined) {
      return { value: cached, cacheHit: true };
    }

    const value = await loader();
    await this.safeSet(key, value, ttlSeconds);
    return { value, cacheHit: false };
  }

  private async safeGet<T>(key: string): Promise<T | undefined> {
    if (!this.redis.isReady) {
      return undefined;
    }
    try {
      const raw = await this.redis.cache.get(key);
      return raw === null ? undefined : (JSON.parse(raw) as T);
    } catch (error) {
      this.logger.warn(`Cache read failed for key "${key}": ${(error as Error).message}`);
      return undefined;
    }
  }

  private async safeSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.redis.isReady) {
      return;
    }
    try {
      await this.redis.cache.set(key, JSON.stringify(value), ttlSeconds);
    } catch (error) {
      this.logger.warn(`Cache write failed for key "${key}": ${(error as Error).message}`);
    }
  }
}
