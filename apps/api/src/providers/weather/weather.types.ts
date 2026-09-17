import type { ProviderAdapter } from '../common/index.js';

export interface WeatherObservation {
  time: string;
  temperatureC?: number;
  temperatureMinC?: number;
  humidityPercent?: number;
  windSpeedKph?: number;
  precipitationMm?: number;
  weatherCode?: number;
}

export interface WeatherData {
  latitude: number;
  longitude: number;
  timezone?: string;
  current?: WeatherObservation;
  daily: WeatherObservation[];
}

export interface WeatherInput {
  latitude: number;
  longitude: number;
  days?: number;
}

export interface WeatherProvider extends ProviderAdapter {
  getForecast(input: WeatherInput): Promise<WeatherData>;
}
