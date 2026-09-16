import Redis from 'ioredis';

export type RedisClientType = Redis;

const DEFAULT_REDIS_URL = 'redis://localhost:6379';

export function createRedisClient(url: string = process.env.REDIS_URL || DEFAULT_REDIS_URL): RedisClientType {
  return new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
  });
}
