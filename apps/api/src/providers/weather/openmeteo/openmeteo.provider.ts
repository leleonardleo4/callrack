import { Injectable, Optional } from '@nestjs/common';
import {
  BaseProviderAdapter,
  defineProviderMetadata,
  ProviderConfigService,
  ProviderHttpClient,
  type ProviderAdapterOptions,
  type ProviderMetadata,
} from '../../common/index.js';
import type { WeatherData, WeatherInput, WeatherProvider } from '../weather.types.js';
import { mapOpenMeteoForecast } from './openmeteo.mapper.js';
import type { OpenMeteoForecastResponse } from './openmeteo.types.js';

const PROVIDER_SLUG = 'weather.openmeteo';

/**
 * Open-Meteo adapter. The base URL is configurable (`OPEN_METEO_BASE_URL`)
 * because Callrack's production deployment is intended to run against
 * self-hosted Open-Meteo infrastructure rather than the public free API.
 */
@Injectable()
export class OpenMeteoProvider extends BaseProviderAdapter implements WeatherProvider {
  readonly metadata: ProviderMetadata = defineProviderMetadata({
    slug: PROVIDER_SLUG,
    name: 'Open-Meteo',
    description: 'Weather forecast data.',
    category: 'weather',
    website: 'https://open-meteo.com',
    attributionRequired: true,
    attributionText: 'Weather data by Open-Meteo.com',
    license: 'CC BY 4.0',
    commercialUse: 'allowed',
  });

  constructor(config: ProviderConfigService, @Optional() options?: ProviderAdapterOptions) {
    super(
      new ProviderHttpClient({
        providerSlug: PROVIDER_SLUG,
        baseUrl: config.openMeteoBaseUrl,
        timeoutMs: options?.timeoutMs,
        retry: options?.retry,
      }),
    );
  }

  async getForecast(input: WeatherInput): Promise<WeatherData> {
    const raw = await this.http.requestJson<OpenMeteoForecastResponse>({
      path: 'v1/forecast',
      query: {
        latitude: input.latitude,
        longitude: input.longitude,
        current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code',
        daily: 'temperature_2m_max,temperature_2m_min,weather_code',
        forecast_days: input.days ?? 3,
        timezone: 'auto',
      },
    });
    return mapOpenMeteoForecast(raw);
  }

  protected async probeHealth(): Promise<unknown> {
    return this.http.requestJson({
      path: 'v1/forecast',
      query: { latitude: 0, longitude: 0, current: 'temperature_2m' },
    });
  }
}
