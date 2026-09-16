import { ProviderError, ProviderErrorCode } from '../../common/index.js';
import type { WeatherData, WeatherObservation } from '../weather.types.js';
import type { OpenMeteoForecastResponse } from './openmeteo.types.js';

const PROVIDER_SLUG = 'weather.openmeteo';

function mapDaily(daily: OpenMeteoForecastResponse['daily']): WeatherObservation[] {
  if (!daily) {
    return [];
  }
  if (!Array.isArray(daily.time)) {
    throw new ProviderError({
      code: ProviderErrorCode.PROVIDER_BAD_RESPONSE,
      message: 'Open-Meteo daily forecast is missing a "time" array',
      providerSlug: PROVIDER_SLUG,
    });
  }

  return daily.time.map((time, index) => ({
    time,
    temperatureC: daily.temperature_2m_max?.[index],
    temperatureMinC: daily.temperature_2m_min?.[index],
    weatherCode: daily.weather_code?.[index],
  }));
}

export function mapOpenMeteoForecast(raw: OpenMeteoForecastResponse): WeatherData {
  if (!raw || typeof raw.latitude !== 'number' || typeof raw.longitude !== 'number') {
    throw new ProviderError({
      code: ProviderErrorCode.PROVIDER_BAD_RESPONSE,
      message: 'Open-Meteo forecast response is missing required fields (latitude, longitude)',
      providerSlug: PROVIDER_SLUG,
    });
  }

  const current: WeatherObservation | undefined =
    raw.current && typeof raw.current.time === 'string'
      ? {
          time: raw.current.time,
          temperatureC: raw.current.temperature_2m,
          windSpeedKph: raw.current.wind_speed_10m,
          precipitationMm: raw.current.precipitation,
          weatherCode: raw.current.weather_code,
        }
      : undefined;

  return {
    latitude: raw.latitude,
    longitude: raw.longitude,
    timezone: raw.timezone,
    current,
    daily: mapDaily(raw.daily),
  };
}
