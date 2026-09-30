import { describe, expect, it, vi } from 'vitest';
import { ProviderCooldownService } from '../../../src/providers/common/provider-cooldown.service.js';
import { ProviderError, ProviderErrorCode } from '../../../src/providers/common/provider.errors.js';
import type { RedisService } from '../../../src/redis/redis.service.js';

function fakeRedisService(overrides: {
  isReady?: boolean;
  exists?: ReturnType<typeof vi.fn>;
  set?: ReturnType<typeof vi.fn>;
}): RedisService {
  return {
    isReady: overrides.isReady ?? true,
    cache: {
      exists: overrides.exists ?? vi.fn().mockResolvedValue(false),
      set: overrides.set ?? vi.fn().mockResolvedValue(undefined),
    },
  } as unknown as RedisService;
}

function rateLimited(retryAfterMs?: number): ProviderError {
  return new ProviderError({ code: ProviderErrorCode.PROVIDER_RATE_LIMITED, message: 'x', providerSlug: 'p', retryAfterMs });
}

describe('ProviderCooldownService', () => {
  it('is not cooling down by default', async () => {
    const service = new ProviderCooldownService(fakeRedisService({}));
    expect(await service.isCoolingDown('news.gdelt')).toBe(false);
  });

  it('writes a Redis cooldown key with a TTL derived from retryAfterMs', async () => {
    const set = vi.fn().mockResolvedValue(undefined);
    const service = new ProviderCooldownService(fakeRedisService({ set }));

    await service.markFailure('news.gdelt', rateLimited(2_500));

    expect(set).toHaveBeenCalledWith('provider:cooldown:news.gdelt', '1', 3);
  });

  it('reports cooling down via Redis when the key exists', async () => {
    const service = new ProviderCooldownService(fakeRedisService({ exists: vi.fn().mockResolvedValue(true) }));

    await service.markFailure('news.gdelt', rateLimited());
    expect(await service.isCoolingDown('news.gdelt')).toBe(true);
  });

  it('never cools down on an invalid-request error, since that is request-specific, not provider health', async () => {
    const set = vi.fn();
    const service = new ProviderCooldownService(fakeRedisService({ set }));

    await service.markFailure(
      'news.gdelt',
      new ProviderError({ code: ProviderErrorCode.PROVIDER_INVALID_REQUEST, message: 'x', providerSlug: 'news.gdelt' }),
    );

    expect(set).not.toHaveBeenCalled();
    expect(await service.isCoolingDown('news.gdelt')).toBe(false);
  });

  it('falls back to an in-memory cooldown when Redis is unreachable', async () => {
    const service = new ProviderCooldownService(fakeRedisService({ isReady: false }));

    await service.markFailure('news.gdelt', rateLimited());

    expect(await service.isCoolingDown('news.gdelt')).toBe(true);
  });

  it('degrades to "assume available" when a Redis read throws', async () => {
    const exists = vi.fn().mockRejectedValue(new Error('redis down'));
    const service = new ProviderCooldownService(fakeRedisService({ exists }));

    expect(await service.isCoolingDown('news.gdelt')).toBe(false);
  });
});
