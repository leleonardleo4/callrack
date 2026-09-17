import { Injectable } from '@nestjs/common';
import { mapProviderErrorToHttpException } from '../common/errors/index.js';
import { buildCacheKey, CACHE_TTL_SECONDS, CapabilityCacheService } from '../common/cache/index.js';
import { RequestTrackingService } from '../common/tracking/index.js';
import { ProviderError, ProviderErrorCode } from '../providers/common/index.js';
import { NagerProvider } from '../providers/holidays/nager/nager.provider.js';
import { toHolidaysResponse } from './holidays.mapper.js';
import type { HolidaysRequestDto } from './dto/holidays-request.dto.js';
import type { HolidaysResponseData } from './holidays-response.types.js';

const HOLIDAYS_CAPABILITY = {
  slug: 'holidays',
  name: 'Public Holidays',
  endpoint: 'POST /v1/holidays',
};

@Injectable()
export class HolidaysService {
  constructor(
    private readonly nager: NagerProvider,
    private readonly cache: CapabilityCacheService,
    private readonly tracking: RequestTrackingService,
  ) {}

  async getHolidays(dto: HolidaysRequestDto, requestId: string): Promise<HolidaysResponseData> {
    const cacheKey = buildCacheKey('holidays', { country: dto.country, year: dto.year });
    const startedAt = Date.now();

    try {
      const { value, cacheHit } = await this.cache.getOrSet(cacheKey, CACHE_TTL_SECONDS.HOLIDAYS, async () => {
        const result = await this.nager.getPublicHolidays({ countryCode: dto.country, year: dto.year });
        return toHolidaysResponse(result, dto.country, dto.year);
      });

      this.tracking.record({
        requestId,
        endpoint: HOLIDAYS_CAPABILITY.endpoint,
        capabilitySlug: HOLIDAYS_CAPABILITY.slug,
        capabilityName: HOLIDAYS_CAPABILITY.name,
        providerSlug: cacheHit ? undefined : this.nager.metadata.slug,
        status: 'SUCCESS',
        durationMs: Date.now() - startedAt,
        cacheHit,
      });

      return value;
    } catch (error) {
      this.tracking.record({
        requestId,
        endpoint: HOLIDAYS_CAPABILITY.endpoint,
        capabilitySlug: HOLIDAYS_CAPABILITY.slug,
        capabilityName: HOLIDAYS_CAPABILITY.name,
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
