import { Injectable } from '@nestjs/common';
import { mapProviderErrorToHttpException } from '../common/errors/index.js';
import { buildCacheKey, CACHE_TTL_SECONDS, CapabilityCacheService } from '../common/cache/index.js';
import { RequestTrackingService } from '../common/tracking/index.js';
import { ProviderError, ProviderErrorCode } from '../providers/common/index.js';
import { CensusProvider } from '../providers/government/census/census.provider.js';
import { toCensusResponse } from './government.mapper.js';
import type { CensusQueryRequestDto } from './dto/census-query-request.dto.js';
import type { CensusQueryResponseData } from './government-response.types.js';

export const CENSUS_SOURCE = 'us-census';

const CENSUS_CAPABILITY = {
  slug: 'government-census',
  name: 'Government Census',
  endpoint: 'POST /v1/government/census',
};

@Injectable()
export class CensusService {
  constructor(
    private readonly census: CensusProvider,
    private readonly cache: CapabilityCacheService,
    private readonly tracking: RequestTrackingService,
  ) {}

  async query(dto: CensusQueryRequestDto, requestId: string): Promise<CensusQueryResponseData> {
    const variables = [...new Set(dto.variables)].sort();
    const cacheKey = buildCacheKey('government:census', {
      dataset: dto.dataset,
      year: dto.year,
      variables: variables.join(','),
      forGeography: dto.forGeography,
    });
    const startedAt = Date.now();

    try {
      const { value, cacheHit } = await this.cache.getOrSet(cacheKey, CACHE_TTL_SECONDS.CENSUS, async () => {
        const result = await this.census.query({
          dataset: dto.dataset,
          year: String(dto.year),
          variables,
          forGeography: dto.forGeography,
        });
        return toCensusResponse(result, dto.year);
      });

      this.tracking.record({
        requestId,
        endpoint: CENSUS_CAPABILITY.endpoint,
        capabilitySlug: CENSUS_CAPABILITY.slug,
        capabilityName: CENSUS_CAPABILITY.name,
        providerSlug: cacheHit ? undefined : this.census.metadata.slug,
        status: 'SUCCESS',
        durationMs: Date.now() - startedAt,
        cacheHit,
      });

      return value;
    } catch (error) {
      this.tracking.record({
        requestId,
        endpoint: CENSUS_CAPABILITY.endpoint,
        capabilitySlug: CENSUS_CAPABILITY.slug,
        capabilityName: CENSUS_CAPABILITY.name,
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
