import { CACHE_TTL_SECONDS } from '../common/cache/index.js';
import { AcademicSearchRequestDto } from '../academic/dto/academic-search-request.dto.js';
import { AcademicWorkRequestDto } from '../academic/dto/academic-work-request.dto.js';
import { NewsSearchRequestDto } from '../news/dto/news-search-request.dto.js';
import { NewsTrendsRequestDto } from '../news/dto/news-trends-request.dto.js';
import { CryptoAssetsRequestDto } from '../crypto/dto/crypto-assets-request.dto.js';
import { FxRatesRequestDto } from '../fx/dto/fx-rates-request.dto.js';
import { WeatherRequestDto } from '../weather/dto/weather-request.dto.js';
import { GeocodeRequestDto } from '../geocode/dto/geocode-request.dto.js';
import { HolidaysRequestDto } from '../holidays/dto/holidays-request.dto.js';
import { KnowledgeSearchRequestDto } from '../knowledge/dto/knowledge-search-request.dto.js';
import { CensusQueryRequestDto } from '../government/dto/census-query-request.dto.js';
import { ResearchRequestDto } from '../research/dto/research-request.dto.js';
import type { CapabilityMetadata } from './capability.types.js';

/**
 * The single authoritative list of public Callrack capabilities. Every
 * route, provider mapping, and price key is declared here exactly once —
 * Phase 7 (x402) and any future discovery layer must read from this list
 * rather than re-deriving capability metadata elsewhere.
 *
 * Paths are the full route as actually served (assuming the default
 * `API_PREFIX=v1` URI-versioning configuration — see `bootstrap.ts`).
 */
export const CAPABILITY_METADATA: readonly CapabilityMetadata[] = [
  {
    id: 'academic.search',
    name: 'Academic Search',
    description: 'Searches scholarly literature via OpenAlex, falling back to Crossref if needed.',
    category: 'academic',
    method: 'POST',
    path: '/v1/academic/search',
    provider: { kind: 'provider', slugs: ['academic.openalex', 'academic.crossref'] },
    priceKey: 'PRICE_ACADEMIC_SEARCH',
    cache: { ttlSeconds: CACHE_TTL_SECONDS.ACADEMIC_SEARCH },
    status: 'active',
    requestSchema: AcademicSearchRequestDto,
    responseSchemaName: 'AcademicSearchResponseData',
  },
  {
    id: 'academic.work',
    name: 'Academic Work Lookup',
    description: 'Retrieves a single scholarly work by DOI via OpenAlex, falling back to Crossref if needed.',
    category: 'academic',
    method: 'POST',
    path: '/v1/academic/work',
    provider: { kind: 'provider', slugs: ['academic.openalex', 'academic.crossref'] },
    priceKey: 'PRICE_ACADEMIC_WORK',
    cache: { ttlSeconds: CACHE_TTL_SECONDS.ACADEMIC_WORK },
    status: 'active',
    requestSchema: AcademicWorkRequestDto,
    responseSchemaName: 'AcademicWorkResponse',
  },
  {
    id: 'news.search',
    name: 'News Search',
    description: 'Searches recent news coverage via GDELT.',
    category: 'news',
    method: 'POST',
    path: '/v1/news/search',
    provider: { kind: 'provider', slugs: ['news.gdelt'] },
    priceKey: 'PRICE_NEWS_SEARCH',
    cache: { ttlSeconds: CACHE_TTL_SECONDS.NEWS_SEARCH },
    status: 'active',
    requestSchema: NewsSearchRequestDto,
    responseSchemaName: 'NewsSearchResponseData',
  },
  {
    id: 'news.trends',
    name: 'News Trends',
    description: 'Returns normalized news trend volume for a topic via GDELT.',
    category: 'news',
    method: 'POST',
    path: '/v1/news/trends',
    provider: { kind: 'provider', slugs: ['news.gdelt'] },
    priceKey: 'PRICE_NEWS_TRENDS',
    cache: { ttlSeconds: CACHE_TTL_SECONDS.NEWS_TRENDS },
    status: 'active',
    requestSchema: NewsTrendsRequestDto,
    responseSchemaName: 'NewsTrendsResponseData',
  },
  {
    id: 'crypto.price',
    name: 'Crypto Price',
    description: 'Returns current price and 24h change for one or more crypto assets via CoinGecko.',
    category: 'crypto',
    method: 'POST',
    path: '/v1/crypto/price',
    provider: { kind: 'provider', slugs: ['crypto.coingecko'] },
    priceKey: 'PRICE_CRYPTO_PRICE',
    cache: { ttlSeconds: CACHE_TTL_SECONDS.CRYPTO_PRICE },
    status: 'active',
    requestSchema: CryptoAssetsRequestDto,
    responseSchemaName: 'CryptoPriceResponseData',
  },
  {
    id: 'crypto.market',
    name: 'Crypto Market Data',
    description: 'Returns market cap, rank, volume, and supply data for one or more crypto assets via CoinGecko.',
    category: 'crypto',
    method: 'POST',
    path: '/v1/crypto/market',
    provider: { kind: 'provider', slugs: ['crypto.coingecko'] },
    priceKey: 'PRICE_CRYPTO_MARKET',
    cache: { ttlSeconds: CACHE_TTL_SECONDS.CRYPTO_MARKET },
    status: 'active',
    requestSchema: CryptoAssetsRequestDto,
    responseSchemaName: 'CryptoMarketResponseData',
  },
  {
    id: 'fx.rates',
    name: 'FX Reference Rates',
    description: 'Returns current or historical foreign exchange reference rates via Frankfurter (ECB data).',
    category: 'finance',
    method: 'POST',
    path: '/v1/fx/rates',
    provider: { kind: 'provider', slugs: ['fx.frankfurter'] },
    priceKey: 'PRICE_FX_RATES',
    // Historical (dated) queries are cached far longer (FX_HISTORICAL) once
    // resolved by the FX service — this describes the shorter, current-rate case.
    cache: { ttlSeconds: CACHE_TTL_SECONDS.FX_CURRENT },
    status: 'active',
    requestSchema: FxRatesRequestDto,
    responseSchemaName: 'FxRatesResponseData',
  },
  {
    id: 'weather',
    name: 'Weather Forecast',
    description: 'Returns current conditions and a daily forecast for a coordinate via Open-Meteo.',
    category: 'weather',
    method: 'POST',
    path: '/v1/weather',
    provider: { kind: 'provider', slugs: ['weather.openmeteo'] },
    priceKey: 'PRICE_WEATHER',
    cache: { ttlSeconds: CACHE_TTL_SECONDS.WEATHER },
    status: 'active',
    requestSchema: WeatherRequestDto,
    responseSchemaName: 'WeatherResponseData',
  },
  {
    id: 'geocode',
    name: 'Geocode',
    description: 'Forward or reverse geocodes a place name or coordinate via Photon.',
    category: 'geography',
    method: 'POST',
    path: '/v1/geocode',
    provider: { kind: 'provider', slugs: ['geocode.photon'] },
    priceKey: 'PRICE_GEOCODE',
    cache: { ttlSeconds: CACHE_TTL_SECONDS.GEOCODE },
    status: 'active',
    requestSchema: GeocodeRequestDto,
    responseSchemaName: 'GeocodeResponseData',
  },
  {
    id: 'holidays',
    name: 'Public Holidays',
    description: 'Returns public holidays for a country and year via Nager.Date.',
    category: 'calendar',
    method: 'POST',
    path: '/v1/holidays',
    provider: { kind: 'provider', slugs: ['holidays.nager'] },
    priceKey: 'PRICE_HOLIDAYS',
    cache: { ttlSeconds: CACHE_TTL_SECONDS.HOLIDAYS },
    status: 'active',
    requestSchema: HolidaysRequestDto,
    responseSchemaName: 'HolidaysResponseData',
  },
  {
    id: 'knowledge.search',
    name: 'Knowledge Search',
    description: 'Searches Wikidata for entities matching a free-text query.',
    category: 'knowledge',
    method: 'POST',
    path: '/v1/knowledge/search',
    provider: { kind: 'provider', slugs: ['knowledge.wikimedia'] },
    priceKey: 'PRICE_KNOWLEDGE_SEARCH',
    cache: { ttlSeconds: CACHE_TTL_SECONDS.KNOWLEDGE_SEARCH },
    status: 'active',
    requestSchema: KnowledgeSearchRequestDto,
    responseSchemaName: 'KnowledgeSearchResponseData',
  },
  {
    id: 'government.census',
    name: 'US Census Query',
    description: 'Queries a constrained subset of US Census Bureau statistical datasets.',
    category: 'government',
    method: 'POST',
    path: '/v1/government/census',
    provider: { kind: 'provider', slugs: ['government.census'] },
    priceKey: 'PRICE_GOVERNMENT_CENSUS',
    cache: { ttlSeconds: CACHE_TTL_SECONDS.CENSUS },
    status: 'active',
    requestSchema: CensusQueryRequestDto,
    responseSchemaName: 'CensusQueryResponseData',
  },
  {
    id: 'research',
    name: 'Research Composition',
    description:
      'Composes existing Callrack capabilities (academic, news, knowledge, and optionally government) into a ' +
      'single aggregated research result. A composition capability — not backed by any single external provider.',
    category: 'research',
    method: 'POST',
    path: '/v1/research',
    provider: { kind: 'composite' },
    priceKey: 'PRICE_RESEARCH',
    cache: { ttlSeconds: CACHE_TTL_SECONDS.RESEARCH },
    status: 'active',
    requestSchema: ResearchRequestDto,
    responseSchemaName: 'ResearchResponseData',
  },
] as const;
