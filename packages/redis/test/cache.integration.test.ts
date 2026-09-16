import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { createRedisClient, RedisCache } from '../src/index.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function isRedisReachable(): Promise<boolean> {
  const client = createRedisClient(REDIS_URL);
  client.on('error', () => {});
  try {
    await client.connect();
    await client.quit();
    return true;
  } catch {
    client.disconnect();
    return false;
  }
}

const reachable = await isRedisReachable();

describe.skipIf(!reachable)('packages/redis cache (integration)', () => {
  const client = createRedisClient(REDIS_URL);
  const cache = new RedisCache(client);
  const testKey = `test:redis:${randomUUID()}`;

  afterAll(async () => {
    await client.del(testKey);
    await client.quit();
  });

  it('connects to Redis', async () => {
    await client.connect();
    expect(await client.ping()).toBe('PONG');
  });

  it('sets and gets a value', async () => {
    await cache.set(testKey, 'hello');
    expect(await cache.get(testKey)).toBe('hello');
  });

  it('reports existence correctly', async () => {
    expect(await cache.exists(testKey)).toBe(true);
    expect(await cache.exists(`${testKey}:missing`)).toBe(false);
  });

  it('honors a TTL', async () => {
    await cache.set(testKey, 'expiring', 60);
    const ttl = await cache.ttl(testKey);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60);
  });

  it('deletes a value', async () => {
    await cache.delete(testKey);
    expect(await cache.exists(testKey)).toBe(false);
  });
});
