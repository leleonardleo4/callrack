/**
 * Cache TTLs (seconds), chosen per capability based on how quickly the
 * underlying data actually changes:
 * - Academic search/work metadata changes rarely, so it can be cached longer.
 * - News search and trend data go stale quickly, so TTLs stay short.
 * - Crypto prices/markets move constantly, so TTLs stay very short.
 * - FX current rates update a few times a day; historical rates for a fixed
 *   past date never change once published, so they can be cached for a long
 *   time.
 * - Weather forecasts drift quickly, so the TTL stays short.
 * - Geocoding results (an address's coordinates) and public holidays for a
 *   given country/year are effectively immutable, so both can be cached for
 *   a long time.
 * - Wikidata entity labels/descriptions change infrequently, so a moderate
 *   TTL balances freshness against load on Wikimedia's infrastructure.
 * - Published Census estimates for a given dataset/year never change, so
 *   they can be cached for a long time.
 * - Research combines sources with different freshness (e.g. live news
 *   alongside stable knowledge/academic data), so it uses one conservative,
 *   moderate TTL for the whole aggregated result rather than the longer TTL
 *   any single contributing source might otherwise get on its own.
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
  WEATHER: 60 * 10, // 10 minutes
  GEOCODE: 60 * 60 * 24 * 30, // 30 days
  HOLIDAYS: 60 * 60 * 24 * 30, // 30 days
  KNOWLEDGE_SEARCH: 60 * 60 * 6, // 6 hours
  CENSUS: 60 * 60 * 24 * 7, // 7 days
  RESEARCH: 60 * 15, // 15 minutes
} as const;
