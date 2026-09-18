import type { WeatherData } from '../providers/weather/weather.types.js';
import type { WeatherResponseData } from './weather-response.types.js';

/**
 * Normalizes Open-Meteo's already-clean domain type into Callrack's public
 * weather contract. There is no hourly forecast here - the Phase 3 adapter
 * doesn't request or normalize hourly data, so it's never fabricated.
 */
export function toWeatherResponse(data: WeatherData): WeatherResponseData {
  return {
    location: { latitude: data.latitude, longitude: data.longitude, timezone: data.timezone ?? null },
    current: data.current
      ? {
          time: data.current.time,
          temperature: data.current.temperatureC ?? null,
          humidity: data.current.humidityPercent ?? null,
          windSpeed: data.current.windSpeedKph ?? null,
          precipitation: data.current.precipitationMm ?? null,
          weatherCode: data.current.weatherCode ?? null,
        }
      : null,
    daily: data.daily.map((day) => ({
      date: day.time,
      temperatureMax: day.temperatureC ?? null,
      temperatureMin: day.temperatureMinC ?? null,
      weatherCode: day.weatherCode ?? null,
    })),
  };
}
