import { beforeEach } from 'vitest';
import { createRedisClient } from '@callrack/redis';

/**
 * Every e2e spec here boots a real, unmocked `CapabilityCacheService`
 * against whatever `REDIS_URL` is configured. `safeGet`/`safeSet` fail
 * open (silently no-op) whenever Redis is unreachable - which is every
 * local/sandboxed run, since nothing here ever provisions one - so caching
 * has effectively never been exercised in that environment. It IS exercised
 * the moment Redis is actually reachable, which is exactly true in CI
 * (ci.yml / ship.yml's `preflight` job both run a real `redis:7-alpine`
 * service).
 *
 * With a live cache, several spec files across different capability
 * domains stub DIFFERENT provider responses behind the SAME request
 * parameters (e.g. `/v1/weather` for `latitude: 6.5244, longitude: 3.3792`
 * appears in weather.e2e.spec.ts, x402.e2e.spec.ts, discovery.e2e.spec.ts,
 * and cors.e2e.spec.ts; `/v1/academic/work` for one fixed DOI appears three
 * times in academic.e2e.spec.ts alone with three different expected
 * outcomes) - all sharing one cache key. Whichever test writes the cache
 * first "wins" for every other test that reuses those same parameters,
 * regardless of what that later test actually stubbed. This is invisible
 * wherever Redis is unreachable and a real, reproducible failure the
 * moment it isn't.
 *
 * Flushing the whole keyspace before every test removes the possibility
 * entirely, rather than chasing down and de-duplicating every colliding
 * fixture across the suite. A throwaway connection is used - deliberately
 * never the app's own RedisService - since each spec constructs its own
 * app instance independently and this must run before any of them exist.
 * Silently does nothing when Redis is unreachable, matching this suite's
 * existing fail-open behavior rather than turning a missing local Redis
 * into a new reason for tests to fail.
 */
beforeEach(async () => {
  const url = process.env.REDIS_URL;
  if (!url) return;

  const client = createRedisClient(url, { connectTimeout: 300 });
  try {
    await client.connect();
    await client.flushdb();
  } catch {
    // Unreachable here (e.g. a local sandbox with no Redis running) -
    // nothing to flush, and every cache read/write this run makes will
    // already fail open the same way it always has.
  } finally {
    client.disconnect();
  }
});
