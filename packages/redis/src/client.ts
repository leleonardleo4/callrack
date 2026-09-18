import Redis from 'ioredis';

export type RedisClientType = Redis;

const DEFAULT_REDIS_URL = 'redis://localhost:6379';

export function createRedisClient(url: string = process.env.REDIS_URL || DEFAULT_REDIS_URL): RedisClientType {
  const { protocol, hostname } = new URL(url);
  // ioredis parses connection details (host/port/auth) from the URL string,
  // but does not reliably forward that hostname as the TLS SNI value once a
  // second options object is also passed (as we do here) - some managed
  // Redis providers (this project's included) route many databases through
  // one shared host:port purely by TLS SNI, and reject the handshake
  // outright without it ("ERR TLS SNI required..."). Setting it explicitly
  // is a no-op for a plain `redis://` (non-TLS) URL or self-hosted TLS
  // Redis that doesn't need SNI routing.
  const tls = protocol === 'rediss:' ? { servername: hostname } : undefined;

  return new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    ...(tls ? { tls } : {}),
    // Every caller of this client already checks readiness before issuing a
    // command (see CapabilityCacheService.safeGet/safeSet, RedisService's
    // own try/catch'd isHealthy/ping) or needs a command to fail instantly
    // rather than wait (see @fastify/rate-limit's `redis` option in
    // bootstrap.ts, paired with its own `skipOnError: true` - that only
    // works if the command actually rejects instead of queuing through
    // reconnect retries first). With ioredis's default (offline queueing
    // enabled), a command issued while disconnected waits through up to
    // `maxRetriesPerRequest` reconnect attempts before rejecting, which
    // would otherwise add real per-request latency to every request while
    // Redis is down - exactly the failure mode a rate limiter must not have.
    enableOfflineQueue: false,
  });
}
