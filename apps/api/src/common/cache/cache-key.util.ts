export type CacheKeyParams = Record<string, string | number | boolean | undefined>;

/**
 * Builds a deterministic, collision-resistant cache key from a namespace and
 * request parameters. Keys are sorted so parameter order never matters, and
 * string values are trimmed/lowercased so trivial formatting differences
 * don't create duplicate cache entries.
 */
export function buildCacheKey(namespace: string, params: CacheKeyParams): string {
  const parts = Object.keys(params)
    .filter((key) => params[key] !== undefined)
    .sort()
    .map((key) => {
      const rawValue = params[key];
      const value = typeof rawValue === 'string' ? rawValue.trim().toLowerCase() : rawValue;
      return `${key}=${String(value)}`;
    });

  return `callrack:${namespace}:${parts.join('&')}`;
}
