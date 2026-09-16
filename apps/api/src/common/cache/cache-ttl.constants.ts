/**
 * Cache TTLs (seconds), chosen per capability based on how quickly the
 * underlying data actually changes:
 * - Academic search/work metadata changes rarely, so it can be cached longer.
 * - News search and trend data go stale quickly, so TTLs stay short.
 * - Crypto prices/markets move constantly, so TTLs stay very short.
 * - FX current rates update a few times a day; historical rates for a fixed
 *   past date never change once published, so they can be cached for a long
 *   time.
 */
export const CACHE_TTL_SECONDS = {
  ACADEMIC_SEARCH: 60 * 30, // 30 minutes
  ACADEMIC_WORK: 60 * 60 * 24, // 24 hours
  NEWS_SEARCH: 60 * 10, // 10 minutes
  NEWS_TRENDS: 60 * 5, // 5 minutes
  CRYPTO_PRICE: 60, // 1 minute
  CRYPTO_MARKET: 60, // 1 minute
  FX_CURRENT: 60 * 15, // 15 minutes
  FX_HISTORICAL: 60 * 60 * 24 * 7, // 7 days
} as const;
