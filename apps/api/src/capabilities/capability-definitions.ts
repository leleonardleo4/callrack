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
import { VerifyRequestDto } from '../information/dto/verify-request.dto.js';
import { EvidenceRequestDto } from '../information/dto/evidence-request.dto.js';
import { CompareRequestDto } from '../information/dto/compare-request.dto.js';
import type { CapabilityMetadata } from './capability.types.js';

/**
 * The single authoritative list of public Callrack capabilities. Every
 * route, provider mapping, price key, and discovery declaration is declared
 * here exactly once — Phase 7 (x402) and Phase 8 (Bazaar discovery) both
 * read from this list rather than re-deriving capability metadata elsewhere.
 *
 * Paths are the full route as actually served (assuming the default
 * `API_PREFIX=v1` URI-versioning configuration — see `bootstrap.ts`).
 *
 * `discovery.outputExample`/`outputSchema` describe the actual public
 * Callrack response envelope (`{ data, meta }`) — never a raw upstream
 * provider payload. Every field shown is a field the endpoint genuinely
 * returns today; update these alongside the response types if they change.
 */
export const CAPABILITY_METADATA: readonly CapabilityMetadata[] = [
  {
    id: 'academic.search',
    name: 'Academic Search',
    description:
      'Search scholarly literature via OpenAlex (falling back to Crossref) and return normalized works with ' +
      'titles, authors, publication years, DOIs, journals, citation counts, and open-access status.',
    category: 'academic',
    method: 'POST',
    path: '/v1/academic/search',
    provider: { kind: 'provider', slugs: ['academic.openalex', 'academic.crossref'] },
    priceKey: 'PRICE_ACADEMIC_SEARCH',
    cache: { ttlSeconds: CACHE_TTL_SECONDS.ACADEMIC_SEARCH },
    status: 'active',
    requestSchema: AcademicSearchRequestDto,
    responseSchemaName: 'AcademicSearchResponseData',
    discovery: {
      inputExample: { query: 'large language models healthcare', limit: 5 },
      outputExample: {
        data: {
          results: [
            {
              id: 'openalex:W2741809807',
              title: 'The state of OA',
              authors: ['Heather Piwowar'],
              publicationYear: 2018,
              doi: '10.7717/peerj.4375',
              url: 'https://doi.org/10.7717/peerj.4375',
              journal: 'PeerJ',
              citations: 391,
              openAccess: true,
              source: 'openalex',
            },
          ],
          meta: { count: 1 },
        },
        meta: { requestId: 'req_1a2b3c...' },
      },
      outputSchema: {
        properties: {
          data: {
            type: 'object',
            properties: {
              results: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    title: { type: 'string' },
                    authors: { type: 'array', items: { type: 'string' } },
                    publicationYear: { type: ['number', 'null'] },
                    doi: { type: ['string', 'null'] },
                    url: { type: ['string', 'null'] },
                    journal: { type: ['string', 'null'] },
                    citations: { type: ['number', 'null'] },
                    openAccess: { type: 'boolean' },
                    source: { type: 'string' },
                  },
                },
              },
              meta: { type: 'object', properties: { count: { type: 'number' } } },
            },
          },
          meta: { type: 'object', properties: { requestId: { type: 'string' } } },
        },
        required: ['data', 'meta'],
      },
    },
  },
  {
    id: 'academic.work',
    name: 'Academic Work Lookup',
    description:
      'Retrieve a single scholarly work by DOI via OpenAlex (falling back to Crossref) and return its ' +
      'normalized title, authors, publication year, journal, citation count, and open-access status.',
    category: 'academic',
    method: 'POST',
    path: '/v1/academic/work',
    provider: { kind: 'provider', slugs: ['academic.openalex', 'academic.crossref'] },
    priceKey: 'PRICE_ACADEMIC_WORK',
    cache: { ttlSeconds: CACHE_TTL_SECONDS.ACADEMIC_WORK },
    status: 'active',
    requestSchema: AcademicWorkRequestDto,
    responseSchemaName: 'AcademicWorkResponse',
    discovery: {
      inputExample: { doi: '10.7717/peerj.4375' },
      outputExample: {
        data: {
          id: 'openalex:W2741809807',
          title: 'The state of OA',
          authors: ['Heather Piwowar'],
          publicationYear: 2018,
          doi: '10.7717/peerj.4375',
          url: 'https://doi.org/10.7717/peerj.4375',
          journal: 'PeerJ',
          citations: 391,
          openAccess: true,
          source: 'openalex',
        },
        meta: { requestId: 'req_1a2b3c...' },
      },
      outputSchema: {
        properties: {
          data: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              authors: { type: 'array', items: { type: 'string' } },
              publicationYear: { type: ['number', 'null'] },
              doi: { type: ['string', 'null'] },
              url: { type: ['string', 'null'] },
              journal: { type: ['string', 'null'] },
              citations: { type: ['number', 'null'] },
              openAccess: { type: 'boolean' },
              source: { type: 'string' },
            },
          },
          meta: { type: 'object', properties: { requestId: { type: 'string' } } },
        },
        required: ['data', 'meta'],
      },
    },
  },
  {
    id: 'news.search',
    name: 'News Search',
    description:
      'Search recent news coverage via GDELT and return normalized articles with titles, URLs, source domains, ' +
      'publish dates, languages, and countries.',
    category: 'news',
    method: 'POST',
    path: '/v1/news/search',
    provider: { kind: 'provider', slugs: ['news.gdelt'] },
    priceKey: 'PRICE_NEWS_SEARCH',
    cache: { ttlSeconds: CACHE_TTL_SECONDS.NEWS_SEARCH },
    status: 'active',
    requestSchema: NewsSearchRequestDto,
    responseSchemaName: 'NewsSearchResponseData',
    discovery: {
      inputExample: { query: 'renewable energy Africa', limit: 5 },
      outputExample: {
        data: {
          results: [
            {
              title: 'Example headline',
              url: 'https://example.com/article',
              source: 'example.com',
              publishedAt: '2026-01-15T12:00:00Z',
              language: 'English',
              country: 'United States',
            },
          ],
        },
        meta: {
          requestId: 'req_1a2b3c...',
          attribution: 'News data provided by the GDELT Project (gdeltproject.org)',
        },
      },
      outputSchema: {
        properties: {
          data: {
            type: 'object',
            properties: {
              results: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    url: { type: 'string' },
                    source: { type: ['string', 'null'] },
                    publishedAt: { type: ['string', 'null'] },
                    language: { type: ['string', 'null'] },
                    country: { type: ['string', 'null'] },
                  },
                },
              },
            },
          },
          meta: {
            type: 'object',
            properties: { requestId: { type: 'string' }, attribution: { type: 'string' } },
          },
        },
        required: ['data', 'meta'],
      },
    },
  },
  {
    id: 'news.trends',
    name: 'News Trends',
    description:
      'Return normalized daily news-coverage volume for a topic, entity, or event via GDELT as a time series ' +
      'of dated volume points.',
    category: 'news',
    method: 'POST',
    path: '/v1/news/trends',
    provider: { kind: 'provider', slugs: ['news.gdelt'] },
    priceKey: 'PRICE_NEWS_TRENDS',
    cache: { ttlSeconds: CACHE_TTL_SECONDS.NEWS_TRENDS },
    status: 'active',
    requestSchema: NewsTrendsRequestDto,
    responseSchemaName: 'NewsTrendsResponseData',
    discovery: {
      inputExample: { query: 'renewable energy', timespan: '7d' },
      outputExample: {
        data: { term: 'renewable energy', points: [{ date: '20260101', volume: 12.3 }] },
        meta: {
          requestId: 'req_1a2b3c...',
          attribution: 'News data provided by the GDELT Project (gdeltproject.org)',
        },
      },
      outputSchema: {
        properties: {
          data: {
            type: 'object',
            properties: {
              term: { type: 'string' },
              points: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { date: { type: 'string' }, volume: { type: 'number' } },
                },
              },
            },
          },
          meta: {
            type: 'object',
            properties: { requestId: { type: 'string' }, attribution: { type: 'string' } },
          },
        },
        required: ['data', 'meta'],
      },
    },
  },
  {
    id: 'crypto.price',
    name: 'Crypto Price',
    description:
      'Get current price and 24-hour change for one or more cryptocurrency assets in a specified quote ' +
      'currency via CoinGecko.',
    category: 'crypto',
    method: 'POST',
    path: '/v1/crypto/price',
    provider: { kind: 'provider', slugs: ['crypto.coingecko'] },
    priceKey: 'PRICE_CRYPTO_PRICE',
    cache: { ttlSeconds: CACHE_TTL_SECONDS.CRYPTO_PRICE },
    status: 'active',
    requestSchema: CryptoAssetsRequestDto,
    responseSchemaName: 'CryptoPriceResponseData',
    discovery: {
      inputExample: { assets: ['bitcoin', 'ethereum'], currency: 'usd' },
      outputExample: {
        data: {
          assets: [{ id: 'bitcoin', symbol: 'btc', price: 104523.42, currency: 'usd', change24h: 2.31 }],
          missing: [],
        },
        meta: { requestId: 'req_1a2b3c...' },
      },
      outputSchema: {
        properties: {
          data: {
            type: 'object',
            properties: {
              assets: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    symbol: { type: 'string' },
                    price: { type: ['number', 'null'] },
                    currency: { type: 'string' },
                    change24h: { type: ['number', 'null'] },
                  },
                },
              },
              missing: { type: 'array', items: { type: 'string' } },
            },
          },
          meta: { type: 'object', properties: { requestId: { type: 'string' } } },
        },
        required: ['data', 'meta'],
      },
    },
  },
  {
    id: 'crypto.market',
    name: 'Crypto Market Data',
    description:
      'Get market capitalization, rank, 24h volume, and circulating/total/max supply for one or more ' +
      'cryptocurrency assets via CoinGecko.',
    category: 'crypto',
    method: 'POST',
    path: '/v1/crypto/market',
    provider: { kind: 'provider', slugs: ['crypto.coingecko'] },
    priceKey: 'PRICE_CRYPTO_MARKET',
    cache: { ttlSeconds: CACHE_TTL_SECONDS.CRYPTO_MARKET },
    status: 'active',
    requestSchema: CryptoAssetsRequestDto,
    responseSchemaName: 'CryptoMarketResponseData',
    discovery: {
      inputExample: { assets: ['bitcoin'], currency: 'usd' },
      outputExample: {
        data: {
          markets: [
            {
              id: 'bitcoin',
              symbol: 'btc',
              name: 'Bitcoin',
              price: 104523.42,
              currency: 'usd',
              marketCap: 2080000000000,
              marketCapRank: 1,
              volume24h: 42000000000,
              change24h: 2.31,
              circulatingSupply: 19800000,
              totalSupply: 21000000,
              maxSupply: 21000000,
            },
          ],
          missing: [],
        },
        meta: { requestId: 'req_1a2b3c...' },
      },
      outputSchema: {
        properties: {
          data: {
            type: 'object',
            properties: {
              markets: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    symbol: { type: 'string' },
                    name: { type: 'string' },
                    price: { type: ['number', 'null'] },
                    currency: { type: 'string' },
                    marketCap: { type: ['number', 'null'] },
                    marketCapRank: { type: ['number', 'null'] },
                    volume24h: { type: ['number', 'null'] },
                    change24h: { type: ['number', 'null'] },
                    circulatingSupply: { type: ['number', 'null'] },
                    totalSupply: { type: ['number', 'null'] },
                    maxSupply: { type: ['number', 'null'] },
                  },
                },
              },
              missing: { type: 'array', items: { type: 'string' } },
            },
          },
          meta: { type: 'object', properties: { requestId: { type: 'string' } } },
        },
        required: ['data', 'meta'],
      },
    },
  },
  {
    id: 'fx.rates',
    name: 'FX Reference Rates',
    description:
      'Get current or historical foreign exchange reference rates for a base currency against one or more ' +
      'target currencies via Frankfurter (ECB data).',
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
    discovery: {
      inputExample: { base: 'USD', currencies: ['EUR', 'GBP', 'NGN'] },
      outputExample: {
        data: { base: 'USD', date: '2026-09-15', rates: { EUR: 0.85, GBP: 0.74, NGN: 1530.22 } },
        meta: { requestId: 'req_1a2b3c...' },
      },
      outputSchema: {
        properties: {
          data: {
            type: 'object',
            properties: {
              base: { type: 'string' },
              date: { type: 'string' },
              rates: { type: 'object', additionalProperties: { type: 'number' } },
            },
          },
          meta: { type: 'object', properties: { requestId: { type: 'string' } } },
        },
        required: ['data', 'meta'],
      },
    },
  },
  {
    id: 'weather',
    name: 'Weather Forecast',
    description:
      'Get current conditions and a multi-day daily forecast (temperature, humidity, wind, precipitation) for ' +
      'a coordinate via Open-Meteo.',
    category: 'weather',
    method: 'POST',
    path: '/v1/weather',
    provider: { kind: 'provider', slugs: ['weather.openmeteo'] },
    priceKey: 'PRICE_WEATHER',
    cache: { ttlSeconds: CACHE_TTL_SECONDS.WEATHER },
    status: 'active',
    requestSchema: WeatherRequestDto,
    responseSchemaName: 'WeatherResponseData',
    discovery: {
      inputExample: { latitude: 6.5244, longitude: 3.3792, days: 3 },
      outputExample: {
        data: {
          location: { latitude: 6.5244, longitude: 3.3792, timezone: 'Africa/Lagos' },
          current: { time: '2026-09-16T12:00', temperature: 27.4, humidity: 80, windSpeed: 12.4, precipitation: 0, weatherCode: 3 },
          daily: [{ date: '2026-09-16', temperatureMax: 30.1, temperatureMin: 24.0, weatherCode: 3 }],
        },
        meta: { requestId: 'req_1a2b3c...' },
      },
      outputSchema: {
        properties: {
          data: {
            type: 'object',
            properties: {
              location: {
                type: 'object',
                properties: {
                  latitude: { type: 'number' },
                  longitude: { type: 'number' },
                  timezone: { type: ['string', 'null'] },
                },
              },
              current: {
                type: ['object', 'null'],
                properties: {
                  time: { type: 'string' },
                  temperature: { type: ['number', 'null'] },
                  humidity: { type: ['number', 'null'] },
                  windSpeed: { type: ['number', 'null'] },
                  precipitation: { type: ['number', 'null'] },
                  weatherCode: { type: ['number', 'null'] },
                },
              },
              daily: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    date: { type: 'string' },
                    temperatureMax: { type: ['number', 'null'] },
                    temperatureMin: { type: ['number', 'null'] },
                    weatherCode: { type: ['number', 'null'] },
                  },
                },
              },
            },
          },
          meta: { type: 'object', properties: { requestId: { type: 'string' } } },
        },
        required: ['data', 'meta'],
      },
    },
  },
  {
    id: 'geocode',
    name: 'Geocode',
    description:
      'Forward geocode a place name to coordinates, or reverse geocode coordinates to a place, via Photon, ' +
      'returning normalized address components.',
    category: 'geography',
    method: 'POST',
    path: '/v1/geocode',
    provider: { kind: 'provider', slugs: ['geocode.photon'] },
    priceKey: 'PRICE_GEOCODE',
    cache: { ttlSeconds: CACHE_TTL_SECONDS.GEOCODE },
    status: 'active',
    requestSchema: GeocodeRequestDto,
    responseSchemaName: 'GeocodeResponseData',
    discovery: {
      inputExample: { mode: 'forward', query: 'Lagos, Nigeria', limit: 5 },
      outputExample: {
        data: {
          results: [
            {
              id: '27565124',
              name: 'Lagos',
              street: null,
              houseNumber: null,
              city: 'Lagos',
              state: 'Lagos',
              country: 'Nigeria',
              countryCode: 'NG',
              postcode: null,
              latitude: 6.5244,
              longitude: 3.3792,
              type: 'city',
            },
          ],
        },
        meta: { requestId: 'req_1a2b3c...' },
      },
      outputSchema: {
        properties: {
          data: {
            type: 'object',
            properties: {
              results: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: ['string', 'null'] },
                    name: { type: ['string', 'null'] },
                    street: { type: ['string', 'null'] },
                    houseNumber: { type: ['string', 'null'] },
                    city: { type: ['string', 'null'] },
                    state: { type: ['string', 'null'] },
                    country: { type: ['string', 'null'] },
                    countryCode: { type: ['string', 'null'] },
                    postcode: { type: ['string', 'null'] },
                    latitude: { type: 'number' },
                    longitude: { type: 'number' },
                    type: { type: ['string', 'null'] },
                  },
                },
              },
            },
          },
          meta: { type: 'object', properties: { requestId: { type: 'string' } } },
        },
        required: ['data', 'meta'],
      },
    },
  },
  {
    id: 'holidays',
    name: 'Public Holidays',
    description:
      'Retrieve public holiday dates and names for a specified country and year via Nager.Date, including ' +
      'whether each holiday is observed nationwide.',
    category: 'calendar',
    method: 'POST',
    path: '/v1/holidays',
    provider: { kind: 'provider', slugs: ['holidays.nager'] },
    priceKey: 'PRICE_HOLIDAYS',
    cache: { ttlSeconds: CACHE_TTL_SECONDS.HOLIDAYS },
    status: 'active',
    requestSchema: HolidaysRequestDto,
    responseSchemaName: 'HolidaysResponseData',
    discovery: {
      inputExample: { country: 'NG', year: 2026 },
      outputExample: {
        data: {
          country: 'NG',
          year: 2026,
          holidays: [
            {
              date: '2026-10-01',
              name: 'National Day',
              localName: 'National Day',
              countryCode: 'NG',
              global: true,
              counties: null,
              types: ['Public'],
            },
          ],
        },
        meta: { requestId: 'req_1a2b3c...' },
      },
      outputSchema: {
        properties: {
          data: {
            type: 'object',
            properties: {
              country: { type: 'string' },
              year: { type: 'number' },
              holidays: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    date: { type: 'string' },
                    name: { type: 'string' },
                    localName: { type: 'string' },
                    countryCode: { type: 'string' },
                    global: { type: 'boolean' },
                    counties: { type: ['array', 'null'], items: { type: 'string' } },
                    types: { type: ['array', 'null'], items: { type: 'string' } },
                  },
                },
              },
            },
          },
          meta: { type: 'object', properties: { requestId: { type: 'string' } } },
        },
        required: ['data', 'meta'],
      },
    },
  },
  {
    id: 'knowledge.search',
    name: 'Knowledge Search',
    description:
      'Search Wikidata for entities matching a free-text query and return normalized entity names, ' +
      'descriptions, and reference URLs.',
    category: 'knowledge',
    method: 'POST',
    path: '/v1/knowledge/search',
    provider: { kind: 'provider', slugs: ['knowledge.wikimedia'] },
    priceKey: 'PRICE_KNOWLEDGE_SEARCH',
    cache: { ttlSeconds: CACHE_TTL_SECONDS.KNOWLEDGE_SEARCH },
    status: 'active',
    requestSchema: KnowledgeSearchRequestDto,
    responseSchemaName: 'KnowledgeSearchResponseData',
    discovery: {
      inputExample: { query: 'Lagos', limit: 5, language: 'en' },
      outputExample: {
        data: {
          results: [
            {
              id: 'Q8673',
              name: 'Lagos',
              description: 'city in Lagos State, Nigeria',
              url: 'https://www.wikidata.org/wiki/Q8673',
              source: 'wikimedia',
            },
          ],
        },
        meta: { requestId: 'req_1a2b3c...', attribution: 'Data from Wikidata, available under CC0' },
      },
      outputSchema: {
        properties: {
          data: {
            type: 'object',
            properties: {
              results: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    description: { type: ['string', 'null'] },
                    url: { type: 'string' },
                    source: { type: 'string' },
                  },
                },
              },
            },
          },
          meta: {
            type: 'object',
            properties: { requestId: { type: 'string' }, attribution: { type: 'string' } },
          },
        },
        required: ['data', 'meta'],
      },
    },
  },
  {
    id: 'government.census',
    name: 'US Census Query',
    description:
      'Query a constrained subset of US Census Bureau statistical datasets and return the requested variables ' +
      'as normalized rows for the specified geography.',
    category: 'government',
    method: 'POST',
    path: '/v1/government/census',
    provider: { kind: 'provider', slugs: ['government.census'] },
    priceKey: 'PRICE_GOVERNMENT_CENSUS',
    cache: { ttlSeconds: CACHE_TTL_SECONDS.CENSUS },
    status: 'active',
    requestSchema: CensusQueryRequestDto,
    responseSchemaName: 'CensusQueryResponseData',
    discovery: {
      inputExample: { dataset: 'acs/acs1', year: 2021, variables: ['NAME', 'B01001_001E'], forGeography: 'state:*' },
      outputExample: {
        data: {
          dataset: 'acs/acs1',
          year: 2021,
          columns: ['NAME', 'B01001_001E'],
          rows: [{ NAME: 'California', B01001_001E: '39029342' }],
        },
        meta: { requestId: 'req_1a2b3c...', source: 'us-census' },
      },
      outputSchema: {
        properties: {
          data: {
            type: 'object',
            properties: {
              dataset: { type: 'string' },
              year: { type: 'number' },
              columns: { type: 'array', items: { type: 'string' } },
              rows: { type: 'array', items: { type: 'object', additionalProperties: { type: 'string' } } },
            },
          },
          meta: {
            type: 'object',
            properties: { requestId: { type: 'string' }, source: { type: 'string' } },
          },
        },
        required: ['data', 'meta'],
      },
    },
  },
  {
    id: 'research',
    name: 'Research Composition',
    description:
      'Aggregate information from selected Callrack research capabilities (academic, news, knowledge, and ' +
      'optionally government) and return structured research evidence with per-source status; deterministic ' +
      'composition, not an AI-generated answer.',
    category: 'research',
    method: 'POST',
    path: '/v1/research',
    provider: { kind: 'composite' },
    priceKey: 'PRICE_RESEARCH',
    cache: { ttlSeconds: CACHE_TTL_SECONDS.RESEARCH },
    status: 'active',
    requestSchema: ResearchRequestDto,
    responseSchemaName: 'ResearchResponseData',
    discovery: {
      inputExample: { query: 'renewable energy investment in Africa', sources: ['academic', 'news', 'knowledge'] },
      outputExample: {
        data: {
          query: 'renewable energy investment in Africa',
          status: 'complete',
          sources: {
            academic: { status: 'success', data: { results: [], meta: { count: 0 } } },
            news: { status: 'success', data: { results: [] } },
            knowledge: { status: 'success', data: { results: [] } },
          },
          findings: [],
          disagreements: [],
          composition: {
            sourcesRequested: ['academic', 'news', 'knowledge'],
            sourcesSucceeded: ['academic', 'news', 'knowledge'],
            sourcesEmpty: [],
            sourcesFailed: [],
            retrievedAt: '2026-01-15T12:00:00Z',
          },
        },
        meta: { requestId: 'req_1a2b3c...', sourcesUsed: ['academic', 'news', 'knowledge'] },
      },
      outputSchema: {
        properties: {
          data: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              status: { type: 'string', enum: ['complete', 'partial', 'failed'] },
              sources: {
                type: 'object',
                properties: {
                  academic: { type: 'object' },
                  news: { type: 'object' },
                  knowledge: { type: 'object' },
                  government: { type: 'object' },
                },
              },
              findings: { type: 'array', items: { type: 'object' } },
              disagreements: { type: 'array', items: { type: 'object' } },
              composition: {
                type: 'object',
                properties: {
                  sourcesRequested: { type: 'array', items: { type: 'string' } },
                  sourcesSucceeded: { type: 'array', items: { type: 'string' } },
                  sourcesEmpty: { type: 'array', items: { type: 'string' } },
                  sourcesFailed: { type: 'array', items: { type: 'string' } },
                  retrievedAt: { type: 'string' },
                },
              },
            },
          },
          meta: {
            type: 'object',
            properties: {
              requestId: { type: 'string' },
              sourcesUsed: { type: 'array', items: { type: 'string' } },
            },
          },
        },
        required: ['data', 'meta'],
      },
    },
  },
  {
    id: 'information.verify',
    name: 'Verify',
    description:
      'Verify a claim against existing Callrack capabilities (academic, news, knowledge) and return a ' +
      'deterministic verdict — supported, contradicted, mixed, or insufficient — with the underlying evidence. ' +
      'Uses explainable lexical term-overlap and negation-cue heuristics, never an LLM or semantic entailment.',
    category: 'information',
    method: 'POST',
    path: '/v1/verify',
    provider: { kind: 'composite' },
    priceKey: 'PRICE_INFORMATION_VERIFY',
    cache: { ttlSeconds: CACHE_TTL_SECONDS.INFORMATION_VERIFY },
    status: 'active',
    requestSchema: VerifyRequestDto,
    responseSchemaName: 'VerifyResponseData',
    discovery: {
      inputExample: { claim: 'Nigeria is the most populous country in Africa.', sourceTypes: ['academic', 'news', 'knowledge'] },
      outputExample: {
        data: {
          claim: 'Nigeria is the most populous country in Africa.',
          verdict: 'supported',
          confidence: 0.8,
          evidence: [
            {
              source: { title: 'Nigeria', url: 'https://www.wikidata.org/wiki/Q1033', provider: 'knowledge.search' },
              excerpt: 'country in West Africa',
              retrievedAt: '2026-01-15T12:00:00Z',
            },
          ],
          agreementCount: 4,
          contradictionCount: 1,
          sourcesChecked: 5,
        },
        meta: { requestId: 'req_1a2b3c...' },
      },
      outputSchema: {
        properties: {
          data: {
            type: 'object',
            properties: {
              claim: { type: 'string' },
              verdict: { type: 'string', enum: ['supported', 'contradicted', 'mixed', 'insufficient'] },
              confidence: { type: 'number' },
              evidence: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    source: {
                      type: 'object',
                      properties: {
                        title: { type: 'string' },
                        url: { type: ['string', 'null'] },
                        provider: { type: 'string' },
                      },
                    },
                    excerpt: { type: ['string', 'null'] },
                    retrievedAt: { type: 'string' },
                    data: { type: 'object' },
                  },
                },
              },
              agreementCount: { type: 'number' },
              contradictionCount: { type: 'number' },
              sourcesChecked: { type: 'number' },
            },
          },
          meta: { type: 'object', properties: { requestId: { type: 'string' } } },
        },
        required: ['data', 'meta'],
      },
    },
  },
  {
    id: 'information.evidence',
    name: 'Evidence',
    description:
      'Return a machine-readable evidence pack for a query — real results from academic, news, and knowledge ' +
      'search with full source provenance and retrieval timestamps, never an AI-generated narrative answer.',
    category: 'information',
    method: 'POST',
    path: '/v1/evidence',
    provider: { kind: 'composite' },
    priceKey: 'PRICE_INFORMATION_EVIDENCE',
    cache: { ttlSeconds: CACHE_TTL_SECONDS.INFORMATION_EVIDENCE },
    status: 'active',
    requestSchema: EvidenceRequestDto,
    responseSchemaName: 'EvidenceResponseData',
    discovery: {
      inputExample: { query: 'renewable energy investment in Africa', sourceTypes: ['academic', 'news', 'knowledge'] },
      outputExample: {
        data: {
          query: 'renewable energy investment in Africa',
          findings: [
            {
              source: { title: 'Example headline', url: 'https://example.com/article', provider: 'news.search' },
              retrievedAt: '2026-01-15T12:00:00Z',
              data: { publishedAt: '2026-01-15T12:00:00Z', country: 'Nigeria' },
            },
          ],
          sources: [{ title: 'Example headline', url: 'https://example.com/article', provider: 'news.search' }],
          retrievedAt: '2026-01-15T12:00:00Z',
        },
        meta: { requestId: 'req_1a2b3c...' },
      },
      outputSchema: {
        properties: {
          data: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              findings: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    source: { type: 'object' },
                    excerpt: { type: ['string', 'null'] },
                    retrievedAt: { type: 'string' },
                    data: { type: 'object' },
                  },
                },
              },
              sources: { type: 'array', items: { type: 'object' } },
              retrievedAt: { type: 'string' },
            },
          },
          meta: { type: 'object', properties: { requestId: { type: 'string' } } },
        },
        required: ['data', 'meta'],
      },
    },
  },
  {
    id: 'information.compare',
    name: 'Compare',
    description:
      'Compare information gathered from academic, news, and knowledge search for a query — distinct subjects, ' +
      'a flattened table of real attribute values, deduplicated sources, and any detected disagreements. Never ' +
      'fabricates a value a provider did not return.',
    category: 'information',
    method: 'POST',
    path: '/v1/compare',
    provider: { kind: 'composite' },
    priceKey: 'PRICE_INFORMATION_COMPARE',
    cache: { ttlSeconds: CACHE_TTL_SECONDS.INFORMATION_COMPARE },
    status: 'active',
    requestSchema: CompareRequestDto,
    responseSchemaName: 'CompareResponseData',
    discovery: {
      inputExample: { query: 'Tesla', sourceTypes: ['academic', 'news', 'knowledge'] },
      outputExample: {
        data: {
          query: 'Tesla',
          subjects: [{ name: 'Tesla, Inc.', sources: ['knowledge.search'] }],
          attributes: [{ subject: 'Tesla, Inc.', key: 'excerpt', value: 'American electric vehicle manufacturer', provider: 'knowledge.search' }],
          sources: [{ title: 'Tesla, Inc.', url: 'https://www.wikidata.org/wiki/Q478214', provider: 'knowledge.search' }],
          disagreements: [],
        },
        meta: { requestId: 'req_1a2b3c...' },
      },
      outputSchema: {
        properties: {
          data: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              subjects: {
                type: 'array',
                items: { type: 'object', properties: { name: { type: 'string' }, sources: { type: 'array', items: { type: 'string' } } } },
              },
              attributes: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    subject: { type: 'string' },
                    key: { type: 'string' },
                    value: { type: 'string' },
                    provider: { type: 'string' },
                  },
                },
              },
              sources: { type: 'array', items: { type: 'object' } },
              disagreements: { type: 'array', items: { type: 'object' } },
            },
          },
          meta: { type: 'object', properties: { requestId: { type: 'string' } } },
        },
        required: ['data', 'meta'],
      },
    },
  },
] as const;
