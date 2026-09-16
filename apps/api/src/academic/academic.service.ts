import { Injectable, NotFoundException } from '@nestjs/common';
import { ApiErrorCode, mapProviderErrorToHttpException } from '../common/errors/index.js';
import { buildCacheKey, CACHE_TTL_SECONDS, CapabilityCacheService } from '../common/cache/index.js';
import { RequestTrackingService } from '../common/tracking/index.js';
import { ProviderError, ProviderErrorCode } from '../providers/common/index.js';
import { OpenAlexProvider } from '../providers/academic/openalex/openalex.provider.js';
import { CrossrefProvider } from '../providers/academic/crossref/crossref.provider.js';
import { toAcademicSearchResponse, toAcademicWorkResponse } from './academic.mapper.js';
import type { AcademicSearchRequestDto } from './dto/academic-search-request.dto.js';
import type { AcademicWorkRequestDto } from './dto/academic-work-request.dto.js';
import type { AcademicSearchResponseData, AcademicWorkResponse } from './academic-response.types.js';

const DEFAULT_SEARCH_LIMIT = 10;

const SEARCH_CAPABILITY = {
  slug: 'academic-search',
  name: 'Academic Search',
  endpoint: 'POST /v1/academic/search',
};

const WORK_CAPABILITY = {
  slug: 'academic-work',
  name: 'Academic Work',
  endpoint: 'POST /v1/academic/work',
};

@Injectable()
export class AcademicService {
  constructor(
    private readonly openAlex: OpenAlexProvider,
    private readonly crossref: CrossrefProvider,
    private readonly cache: CapabilityCacheService,
    private readonly tracking: RequestTrackingService,
  ) {}

  async search(dto: AcademicSearchRequestDto, requestId: string): Promise<AcademicSearchResponseData> {
    const limit = dto.limit ?? DEFAULT_SEARCH_LIMIT;
    const cacheKey = buildCacheKey('academic:search', { query: dto.query, limit });
    const startedAt = Date.now();
    let providerSlug: string | undefined;

    try {
      const { value, cacheHit } = await this.cache.getOrSet(cacheKey, CACHE_TTL_SECONDS.ACADEMIC_SEARCH, async () => {
        const outcome = await this.runWithFallback(
          { slug: this.openAlex.metadata.slug, run: () => this.openAlex.searchWorks({ query: dto.query, limit }) },
          { slug: this.crossref.metadata.slug, run: () => this.crossref.searchWorks({ query: dto.query, limit }) },
        );
        providerSlug = outcome.providerSlug;
        return toAcademicSearchResponse(outcome.result);
      });

      this.tracking.record({
        requestId,
        endpoint: SEARCH_CAPABILITY.endpoint,
        capabilitySlug: SEARCH_CAPABILITY.slug,
        capabilityName: SEARCH_CAPABILITY.name,
        providerSlug: cacheHit ? undefined : providerSlug,
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

  async getWork(dto: AcademicWorkRequestDto, requestId: string): Promise<AcademicWorkResponse> {
    const cacheKey = buildCacheKey('academic:work', { doi: dto.doi });
    const startedAt = Date.now();
    let providerSlug: string | undefined;

    try {
      const { value, cacheHit } = await this.cache.getOrSet(cacheKey, CACHE_TTL_SECONDS.ACADEMIC_WORK, async () => {
        const outcome = await this.runWithFallback(
          { slug: this.openAlex.metadata.slug, run: () => this.openAlex.getWork({ id: dto.doi }) },
          { slug: this.crossref.metadata.slug, run: () => this.crossref.getWork({ id: dto.doi }) },
        );
        providerSlug = outcome.providerSlug;
        return toAcademicWorkResponse(outcome.result.work);
      });

      this.tracking.record({
        requestId,
        endpoint: WORK_CAPABILITY.endpoint,
        capabilitySlug: WORK_CAPABILITY.slug,
        capabilityName: WORK_CAPABILITY.name,
        providerSlug: cacheHit ? undefined : providerSlug,
        status: 'SUCCESS',
        durationMs: Date.now() - startedAt,
        cacheHit,
      });

      return value;
    } catch (error) {
      this.tracking.record({
        requestId,
        endpoint: WORK_CAPABILITY.endpoint,
        capabilitySlug: WORK_CAPABILITY.slug,
        capabilityName: WORK_CAPABILITY.name,
        status: this.classifyError(error),
        durationMs: Date.now() - startedAt,
        cacheHit: false,
      });

      // Both OpenAlex and Crossref return a 404-shaped failure (mapped to
      // PROVIDER_INVALID_REQUEST by the shared HTTP client) when a DOI is
      // genuinely unregistered with them, so treat that as "not found"
      // rather than "we sent a bad request" — the DTO already validated the
      // DOI's format before we ever called a provider.
      if (error instanceof ProviderError && error.code === ProviderErrorCode.PROVIDER_INVALID_REQUEST) {
        throw new NotFoundException({
          code: ApiErrorCode.NOT_FOUND,
          message: `No academic work found for DOI "${dto.doi}".`,
        });
      }

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

  /**
   * Tries the primary provider; if it fails with a normalized provider
   * error, falls back to the secondary provider (OpenAlex → Crossref),
   * preserving which provider actually served the result.
   */
  private async runWithFallback<T>(
    primary: { slug: string; run: () => Promise<T> },
    fallback: { slug: string; run: () => Promise<T> },
  ): Promise<{ result: T; providerSlug: string }> {
    try {
      const result = await primary.run();
      return { result, providerSlug: primary.slug };
    } catch (error) {
      if (!(error instanceof ProviderError)) {
        throw error;
      }
      const result = await fallback.run();
      return { result, providerSlug: fallback.slug };
    }
  }
}
