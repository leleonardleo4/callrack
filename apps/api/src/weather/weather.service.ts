import { Injectable } from '@nestjs/common';
import { mapProviderErrorToHttpException } from '../common/errors/index.js';
import { buildCacheKey, CACHE_TTL_SECONDS, CapabilityCacheService } from '../common/cache/index.js';
import { RequestTrackingService } from '../common/tracking/index.js';
import { ProviderError, ProviderErrorCode } from '../providers/common/index.js';
import { OpenMeteoProvider } from '../providers/weather/openmeteo/openmeteo.provider.js';
import { toWeatherResponse } from './weather.mapper.js';
import type { WeatherRequestDto } from './dto/weather-request.dto.js';
import type { WeatherResponseData } from './weather-response.types.js';

const DEFAULT_DAYS = 3;

const WEATHER_CAPABILITY = {
  slug: 'weather',
  name: 'Weather',
  endpoint: 'POST /v1/weather',
};

@Injectable()
export class WeatherService {
  constructor(
    private readonly openMeteo: OpenMeteoProvider,
    private readonly cache: CapabilityCacheService,
    private readonly tracking: RequestTrackingService,
  ) {}

  async getForecast(dto: WeatherRequestDto, requestId: string): Promise<WeatherResponseData> {
    const days = dto.days ?? DEFAULT_DAYS;
    const cacheKey = buildCacheKey('weather', { latitude: dto.latitude, longitude: dto.longitude, days });
    const startedAt = Date.now();

    try {
      const { value, cacheHit } = await this.cache.getOrSet(cacheKey, CACHE_TTL_SECONDS.WEATHER, async () => {
        const result = await this.openMeteo.getForecast({ latitude: dto.latitude, longitude: dto.longitude, days });
        return toWeatherResponse(result);
      });

      this.tracking.record({
        requestId,
        endpoint: WEATHER_CAPABILITY.endpoint,
        capabilitySlug: WEATHER_CAPABILITY.slug,
        capabilityName: WEATHER_CAPABILITY.name,
        providerSlug: cacheHit ? undefined : this.openMeteo.metadata.slug,
        status: 'SUCCESS',
        durationMs: Date.now() - startedAt,
        cacheHit,
      });

      return value;
    } catch (error) {
      this.tracking.record({
        requestId,
        endpoint: WEATHER_CAPABILITY.endpoint,
        capabilitySlug: WEATHER_CAPABILITY.slug,
        capabilityName: WEATHER_CAPABILITY.name,
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
