import { Injectable } from '@nestjs/common';
import { mapProviderErrorToHttpException } from '../common/errors/index.js';
import { buildCacheKey, CACHE_TTL_SECONDS, CapabilityCacheService } from '../common/cache/index.js';
import { RequestTrackingService } from '../common/tracking/index.js';
import { formatAttribution, ProviderError, ProviderErrorCode } from '../providers/common/index.js';
import { WikimediaProvider } from '../providers/knowledge/wikimedia/wikimedia.provider.js';
import { toKnowledgeSearchResponse } from './knowledge.mapper.js';
import type { KnowledgeSearchRequestDto } from './dto/knowledge-search-request.dto.js';
import type { KnowledgeSearchResponseData } from './knowledge-response.types.js';

const DEFAULT_LIMIT = 10;
const DEFAULT_LANGUAGE = 'en';

const KNOWLEDGE_SEARCH_CAPABILITY = {
  slug: 'knowledge-search',
  name: 'Knowledge Search',
  endpoint: 'POST /v1/knowledge/search',
};

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly wikimedia: WikimediaProvider,
    private readonly cache: CapabilityCacheService,
    private readonly tracking: RequestTrackingService,
  ) {}

  /** Attribution text Wikidata requires; undefined would mean none is required. */
  getAttribution(): string | undefined {
    return formatAttribution(this.wikimedia.metadata);
  }

  async search(dto: KnowledgeSearchRequestDto, requestId: string): Promise<KnowledgeSearchResponseData> {
    const limit = dto.limit ?? DEFAULT_LIMIT;
    const language = dto.language ?? DEFAULT_LANGUAGE;
    const cacheKey = buildCacheKey('knowledge:search', { query: dto.query, limit, language });
    const startedAt = Date.now();

    try {
      const { value, cacheHit } = await this.cache.getOrSet(cacheKey, CACHE_TTL_SECONDS.KNOWLEDGE_SEARCH, async () => {
        const result = await this.wikimedia.search({ query: dto.query, limit, language });
        return toKnowledgeSearchResponse(result);
      });

      this.tracking.record({
        requestId,
        endpoint: KNOWLEDGE_SEARCH_CAPABILITY.endpoint,
        capabilitySlug: KNOWLEDGE_SEARCH_CAPABILITY.slug,
        capabilityName: KNOWLEDGE_SEARCH_CAPABILITY.name,
        providerSlug: cacheHit ? undefined : this.wikimedia.metadata.slug,
        status: 'SUCCESS',
        durationMs: Date.now() - startedAt,
        cacheHit,
      });

      return value;
    } catch (error) {
      this.tracking.record({
        requestId,
        endpoint: KNOWLEDGE_SEARCH_CAPABILITY.endpoint,
        capabilitySlug: KNOWLEDGE_SEARCH_CAPABILITY.slug,
        capabilityName: KNOWLEDGE_SEARCH_CAPABILITY.name,
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
