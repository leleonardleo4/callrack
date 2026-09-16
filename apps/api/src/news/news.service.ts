import { Injectable } from '@nestjs/common';
import { mapProviderErrorToHttpException } from '../common/errors/index.js';
import { buildCacheKey, CACHE_TTL_SECONDS, CapabilityCacheService } from '../common/cache/index.js';
import { RequestTrackingService } from '../common/tracking/index.js';
import { formatAttribution, ProviderError, ProviderErrorCode } from '../providers/common/index.js';
import { GdeltProvider } from '../providers/news/gdelt/gdelt.provider.js';
import { toNewsSearchResponse, toNewsTrendsResponse } from './news.mapper.js';
import type { NewsSearchRequestDto } from './dto/news-search-request.dto.js';
import type { NewsTrendsRequestDto } from './dto/news-trends-request.dto.js';
import type { NewsSearchResponseData, NewsTrendsResponseData } from './news-response.types.js';

const DEFAULT_SEARCH_LIMIT = 10;
const DEFAULT_TIMESPAN = '7d';

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

@Injectable()
export class NewsService {
  constructor(
    private readonly gdelt: GdeltProvider,
    private readonly cache: CapabilityCacheService,
    private readonly tracking: RequestTrackingService,
  ) {}

  /** Attribution text GDELT requires; undefined would mean none is required. */
  getAttribution(): string | undefined {
    return formatAttribution(this.gdelt.metadata);
  }

  async search(dto: NewsSearchRequestDto, requestId: string): Promise<NewsSearchResponseData> {
    const limit = dto.limit ?? DEFAULT_SEARCH_LIMIT;
    const cacheKey = buildCacheKey('news:search', { query: dto.query, limit });
    const startedAt = Date.now();

    try {
      const { value, cacheHit } = await this.cache.getOrSet(cacheKey, CACHE_TTL_SECONDS.NEWS_SEARCH, async () => {
        const result = await this.gdelt.search({ query: dto.query, limit });
        return toNewsSearchResponse(result);
      });

      this.tracking.record({
        requestId,
        endpoint: SEARCH_CAPABILITY.endpoint,
        capabilitySlug: SEARCH_CAPABILITY.slug,
        capabilityName: SEARCH_CAPABILITY.name,
        providerSlug: cacheHit ? undefined : this.gdelt.metadata.slug,
        status: 'SUCCESS',
        durationMs: Date.now() - startedAt,
        cacheHit,
      });

      return value;
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

  async getTrends(dto: NewsTrendsRequestDto, requestId: string): Promise<NewsTrendsResponseData> {
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

      return value;
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

  private classifyError(error: unknown): 'ERROR' | 'TIMEOUT' {
    return error instanceof ProviderError && error.code === ProviderErrorCode.PROVIDER_TIMEOUT
      ? 'TIMEOUT'
      : 'ERROR';
  }
}
