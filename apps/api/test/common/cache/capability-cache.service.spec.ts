import { describe, expect, it, vi } from 'vitest';
import { CapabilityCacheService } from '../../../src/common/cache/capability-cache.service.js';
import type { RedisService } from '../../../src/redis/redis.service.js';

function fakeRedisService(overrides: {
  isReady?: boolean;
  get?: ReturnType<typeof vi.fn>;
  set?: ReturnType<typeof vi.fn>;
}): RedisService {
  return {
    isReady: overrides.isReady ?? true,
    cache: {
      get: overrides.get ?? vi.fn().mockResolvedValue(null),
      set: overrides.set ?? vi.fn().mockResolvedValue(undefined),
    },
  } as unknown as RedisService;
}

describe('CapabilityCacheService', () => {
  it('bypasses Redis entirely when it is not ready', async () => {
    const get = vi.fn();
    const set = vi.fn();
    const redis = fakeRedisService({ isReady: false, get, set });
    const service = new CapabilityCacheService(redis);
    const loader = vi.fn().mockResolvedValue({ hello: 'world' });

    const result = await service.getOrSet('key', 60, loader);

    expect(result).toEqual({ value: { hello: 'world' }, cacheHit: false });
    expect(loader).toHaveBeenCalledOnce();
    expect(get).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it('calls the loader and writes through on a cache miss', async () => {
    const set = vi.fn().mockResolvedValue(undefined);
    const redis = fakeRedisService({ get: vi.fn().mockResolvedValue(null), set });
    const service = new CapabilityCacheService(redis);
    const loader = vi.fn().mockResolvedValue({ hello: 'world' });

    const result = await service.getOrSet('key', 60, loader);

    expect(result).toEqual({ value: { hello: 'world' }, cacheHit: false });
    expect(loader).toHaveBeenCalledOnce();
    expect(set).toHaveBeenCalledWith('key', JSON.stringify({ hello: 'world' }), 60);
  });

  it('returns the cached value without calling the loader on a cache hit', async () => {
    const redis = fakeRedisService({ get: vi.fn().mockResolvedValue(JSON.stringify({ hello: 'world' })) });
    const service = new CapabilityCacheService(redis);
    const loader = vi.fn();

    const result = await service.getOrSet('key', 60, loader);

    expect(result).toEqual({ value: { hello: 'world' }, cacheHit: true });
    expect(loader).not.toHaveBeenCalled();
  });

  it('falls back to the loader when a cache read fails', async () => {
    const redis = fakeRedisService({ get: vi.fn().mockRejectedValue(new Error('connection reset')) });
    const service = new CapabilityCacheService(redis);
    const loader = vi.fn().mockResolvedValue('value');

    const result = await service.getOrSet('key', 60, loader);

    expect(result).toEqual({ value: 'value', cacheHit: false });
  });

  it('does not fail the request when a cache write fails', async () => {
    const redis = fakeRedisService({
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockRejectedValue(new Error('connection reset')),
    });
    const service = new CapabilityCacheService(redis);
    const loader = vi.fn().mockResolvedValue('value');

    await expect(service.getOrSet('key', 60, loader)).resolves.toEqual({ value: 'value', cacheHit: false });
  });

  it('never caches a loader error', async () => {
    const set = vi.fn();
    const redis = fakeRedisService({ get: vi.fn().mockResolvedValue(null), set });
    const service = new CapabilityCacheService(redis);
    const loader = vi.fn().mockRejectedValue(new Error('provider failed'));

    await expect(service.getOrSet('key', 60, loader)).rejects.toThrow('provider failed');
    expect(set).not.toHaveBeenCalled();
  });
});
