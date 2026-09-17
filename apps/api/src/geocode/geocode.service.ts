import { Injectable } from '@nestjs/common';
import { mapProviderErrorToHttpException } from '../common/errors/index.js';
import { buildCacheKey, CACHE_TTL_SECONDS, CapabilityCacheService } from '../common/cache/index.js';
import { RequestTrackingService } from '../common/tracking/index.js';
import { ProviderError, ProviderErrorCode } from '../providers/common/index.js';
import { PhotonProvider } from '../providers/geocode/photon/photon.provider.js';
import type { GeoLocation } from '../providers/geocode/geocode.types.js';
import { toGeocodeResponse } from './geocode.mapper.js';
import type { GeocodeRequestDto } from './dto/geocode-request.dto.js';
import type { GeocodeResponseData } from './geocode-response.types.js';

const DEFAULT_LIMIT = 5;

const GEOCODE_CAPABILITY = {
  slug: 'geocode',
  name: 'Geocode',
  endpoint: 'POST /v1/geocode',
};

/** Collapses repeated whitespace so "Lagos  Nigeria" and "Lagos Nigeria" share a cache entry. */
function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLowerCase();
}

@Injectable()
export class GeocodeService {
  constructor(
    private readonly photon: PhotonProvider,
    private readonly cache: CapabilityCacheService,
    private readonly tracking: RequestTrackingService,
  ) {}

  async geocode(dto: GeocodeRequestDto, requestId: string): Promise<GeocodeResponseData> {
    return dto.mode === 'forward' ? this.forward(dto, requestId) : this.reverse(dto, requestId);
  }

  private async forward(dto: GeocodeRequestDto, requestId: string): Promise<GeocodeResponseData> {
    const query = normalizeQuery(dto.query as string);
    const limit = dto.limit ?? DEFAULT_LIMIT;
    const cacheKey = buildCacheKey('geocode:forward', { query, limit });

    return this.run(cacheKey, requestId, () => this.photon.forward({ query: dto.query as string, limit }));
  }

  private async reverse(dto: GeocodeRequestDto, requestId: string): Promise<GeocodeResponseData> {
    const latitude = dto.latitude as number;
    const longitude = dto.longitude as number;
    const cacheKey = buildCacheKey('geocode:reverse', { latitude, longitude });

    return this.run(cacheKey, requestId, () => this.photon.reverse({ latitude, longitude }));
  }

  private async run(
    cacheKey: string,
    requestId: string,
    loadFromProvider: () => Promise<{ locations: GeoLocation[] }>,
  ): Promise<GeocodeResponseData> {
    const startedAt = Date.now();

    try {
      const { value, cacheHit } = await this.cache.getOrSet(cacheKey, CACHE_TTL_SECONDS.GEOCODE, async () => {
        const result = await loadFromProvider();
        return toGeocodeResponse(result);
      });

      this.tracking.record({
        requestId,
        endpoint: GEOCODE_CAPABILITY.endpoint,
        capabilitySlug: GEOCODE_CAPABILITY.slug,
        capabilityName: GEOCODE_CAPABILITY.name,
        providerSlug: cacheHit ? undefined : this.photon.metadata.slug,
        status: 'SUCCESS',
        durationMs: Date.now() - startedAt,
        cacheHit,
      });

      return value;
    } catch (error) {
      this.tracking.record({
        requestId,
        endpoint: GEOCODE_CAPABILITY.endpoint,
        capabilitySlug: GEOCODE_CAPABILITY.slug,
        capabilityName: GEOCODE_CAPABILITY.name,
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
