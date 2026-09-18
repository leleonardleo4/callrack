import Redis from 'ioredis';

export type RedisClientType = Redis;

const DEFAULT_REDIS_URL = 'redis://localhost:6379';

export function createRedisClient(url: string = process.env.REDIS_URL || DEFAULT_REDIS_URL): RedisClientType {
  return new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    // Every caller of this client already checks readiness before issuing a
    // command (see CapabilityCacheService.safeGet/safeSet, RedisService's
    // own try/catch'd isHealthy/ping) or needs a command to fail instantly
    // rather than wait (see @fastify/rate-limit's `redis` option in
    // bootstrap.ts, paired with its own `skipOnError: true` — that only
    // works if the command actually rejects instead of queuing through
    // reconnect retries first). With ioredis's default (offline queueing
    // enabled), a command issued while disconnected waits through up to
    // `maxRetriesPerRequest` reconnect attempts before rejecting, which
    // would otherwise add real per-request latency to every request while
    // Redis is down — exactly the failure mode a rate limiter must not have.
    enableOfflineQueue: false,
  });
}
