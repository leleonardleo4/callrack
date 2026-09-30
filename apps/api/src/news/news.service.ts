import { Injectable } from '@nestjs/common';
import { mapProviderErrorToHttpException } from '../common/errors/index.js';
import { buildCacheKey, CACHE_TTL_SECONDS, CapabilityCacheService } from '../common/cache/index.js';
import { RequestTrackingService } from '../common/tracking/index.js';
import {
  formatAttribution,
  ProviderCooldownService,
  ProviderError,
  ProviderErrorCode,
  runProviderChain,
  type ProviderMetadata,
} from '../providers/common/index.js';
import { GdeltProvider } from '../providers/news/gdelt/gdelt.provider.js';
import { CurrentsProvider } from '../providers/news/currents/currents.provider.js';
import { NewsDataProvider } from '../providers/news/newsdata/newsdata.provider.js';
import { TheNewsApiProvider } from '../providers/news/thenewsapi/thenewsapi.provider.js';
import { GNewsProvider } from '../providers/news/gnews/gnews.provider.js';
import { MediastackProvider } from '../providers/news/mediastack/mediastack.provider.js';
import type { NewsSearchProvider, NewsSearchResult } from '../providers/news/news.types.js';
import { toNewsSearchResponse, toNewsTrendsResponse } from './news.mapper.js';
import type { NewsSearchRequestDto } from './dto/news-search-request.dto.js';
import type { NewsTrendsRequestDto } from './dto/news-trends-request.dto.js';
import type { NewsSearchResponseData, NewsTrendsResponseData } from './news-response.types.js';

const DEFAULT_SEARCH_LIMIT = 10;
const DEFAULT_TIMESPAN = '7d';

/**
 * Total time budget across the *whole* search fallback chain (all providers
 * combined), not per provider. Existing capability services already depend
 * on staying inside the ~30-40s validity window of the x402 payment
 * signature the client already submitted (see gdelt.provider.ts) - a
 * multi-provider fallback chain must not blow that window just because it
 * kept finding new providers to try after the first one failed.
 */
const NEWS_SEARCH_FALLBACK_BUDGET_MS = 8_000;

const SEARCH_CAPABILITY = {
  slug: 'news-search',
  name: 'News Search',
  endpoint: 'POST /v1/news/search',
};

const TRENDS_CAPABILITY = {
  slug: 'news-trends',
  name: 'News Trends',
  endpoint: 'POST /v1/news/trends',
};

export interface NewsCapabilityOutcome<T> {
  data: T;
  /** Slug of whichever provider actually served this result (even on a cache hit - the data still originated there). */
  providerSlug: string;
  attribution?: string;
}

@Injectable()
export class NewsService {
  private readonly searchProviders: NewsSearchProvider[];
  private readonly metadataBySlug: Map<string, ProviderMetadata>;

  constructor(
    private readonly gdelt: GdeltProvider,
    private readonly currents: CurrentsProvider,
    private readonly newsData: NewsDataProvider,
    private readonly theNewsApi: TheNewsApiProvider,
    private readonly gNews: GNewsProvider,
    private readonly mediastack: MediastackProvider,
    private readonly cache: CapabilityCacheService,
    private readonly tracking: RequestTrackingService,
    private readonly cooldown: ProviderCooldownService,
  ) {
    // GDELT needs no key and stays primary. Every other provider needs a
    // configured key to do anything at all - unlike CoinGecko/Census, there
    // is no anonymous tier to fall back to - so an unconfigured one is left
    // out of the chain entirely rather than attempted and failed every time.
    this.searchProviders = [
      this.gdelt,
      this.currents,
      this.newsData,
      this.theNewsApi,
      this.gNews,
      this.mediastack,
    ].filter((provider) => provider.isConfigured);

    this.metadataBySlug = new Map(this.searchProviders.map((provider) => [provider.metadata.slug, provider.metadata]));
  }

  async search(dto: NewsSearchRequestDto, requestId: string): Promise<NewsCapabilityOutcome<NewsSearchResponseData>> {
    const limit = dto.limit ?? DEFAULT_SEARCH_LIMIT;
    const cacheKey = buildCacheKey('news:search', { query: dto.query, limit });
    const startedAt = Date.now();

    try {
      const { value, cacheHit } = await this.cache.getOrSet(cacheKey, CACHE_TTL_SECONDS.NEWS_SEARCH, async () => {
        const outcome = await runProviderChain(
          this.searchProviders.map((provider) => ({
            slug: provider.metadata.slug,
            run: () => provider.search({ query: dto.query, limit }),
          })),
          {
            isEmpty: (result: NewsSearchResult) => result.articles.length === 0,
            overallTimeoutMs: NEWS_SEARCH_FALLBACK_BUDGET_MS,
            cooldown: this.cooldown,
          },
        );
        return { response: toNewsSearchResponse(outcome.result), providerSlug: outcome.providerSlug };
      });

      this.tracking.record({
        requestId,
        endpoint: SEARCH_CAPABILITY.endpoint,
        capabilitySlug: SEARCH_CAPABILITY.slug,
        capabilityName: SEARCH_CAPABILITY.name,
        providerSlug: cacheHit ? undefined : value.providerSlug,
        status: 'SUCCESS',
        durationMs: Date.now() - startedAt,
        cacheHit,
      });

      return {
        data: value.response,
        providerSlug: value.providerSlug,
        attribution: this.attributionFor(value.providerSlug),
      };
    } catch (error) {
      this.tracking.record({
        requestId,
        endpoint: SEARCH_CAPABILITY.endpoint,
        capabilitySlug: SEARCH_CAPABILITY.slug,
        capabilityName: SEARCH_CAPABILITY.name,
        status: this.classifyError(error),
        durationMs: Date.now() - startedAt,
        cacheHit: false,
      });

      if (error instanceof ProviderError) {
        throw mapProviderErrorToHttpException(error);
      }
      throw error;
    }
  }

  /**
   * No fallback provider offers a trends/volume time series the way GDELT's
   * timelinevol mode does - synthesizing one from a handful of free-tier
   * search results would be a noisy, effectively fabricated signal, so this
   * stays GDELT-only rather than faking resilience it doesn't actually have.
   */
  async getTrends(dto: NewsTrendsRequestDto, requestId: string): Promise<NewsCapabilityOutcome<NewsTrendsResponseData>> {
    const timespan = dto.timespan ?? DEFAULT_TIMESPAN;
    const cacheKey = buildCacheKey('news:trends', { query: dto.query, timespan });
    const startedAt = Date.now();

    try {
      const { value, cacheHit } = await this.cache.getOrSet(cacheKey, CACHE_TTL_SECONDS.NEWS_TRENDS, async () => {
        const result = await this.gdelt.getTrends({ query: dto.query, timespan: dto.timespan });
        return toNewsTrendsResponse(result);
      });

      this.tracking.record({
        requestId,
        endpoint: TRENDS_CAPABILITY.endpoint,
        capabilitySlug: TRENDS_CAPABILITY.slug,
        capabilityName: TRENDS_CAPABILITY.name,
        providerSlug: cacheHit ? undefined : this.gdelt.metadata.slug,
        status: 'SUCCESS',
        durationMs: Date.now() - startedAt,
        cacheHit,
      });

      return {
        data: value,
        providerSlug: this.gdelt.metadata.slug,
        attribution: this.attributionFor(this.gdelt.metadata.slug),
      };
    } catch (error) {
      this.tracking.record({
        requestId,
        endpoint: TRENDS_CAPABILITY.endpoint,
        capabilitySlug: TRENDS_CAPABILITY.slug,
        capabilityName: TRENDS_CAPABILITY.name,
        status: this.classifyError(error),
        durationMs: Date.now() - startedAt,
        cacheHit: false,
      });

      if (error instanceof ProviderError) {
        throw mapProviderErrorToHttpException(error);
      }
      throw error;
    }
  }

  private attributionFor(providerSlug: string): string | undefined {
    const metadata = this.metadataBySlug.get(providerSlug);
    return metadata ? formatAttribution(metadata) : undefined;
  }

  private classifyError(error: unknown): 'ERROR' | 'TIMEOUT' {
    return error instanceof ProviderError && error.code === ProviderErrorCode.PROVIDER_TIMEOUT
      ? 'TIMEOUT'
      : 'ERROR';
  }
}
