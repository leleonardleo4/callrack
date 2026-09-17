import { describe, expect, it } from 'vitest';
import { toWeatherResponse } from '../../src/weather/weather.mapper.js';
import type { WeatherData } from '../../src/providers/weather/weather.types.js';

const FULL_DATA: WeatherData = {
  latitude: 6.5244,
  longitude: 3.3792,
  timezone: 'Africa/Lagos',
  current: {
    time: '2026-09-16T12:00',
    temperatureC: 27.4,
    humidityPercent: 80,
    windSpeedKph: 12.4,
    precipitationMm: 0,
    weatherCode: 3,
  },
  daily: [{ time: '2026-09-16', temperatureC: 30.1, temperatureMinC: 24.0, weatherCode: 3 }],
};

describe('weather.mapper', () => {
  it('maps a fully-populated forecast to the public contract', () => {
    expect(toWeatherResponse(FULL_DATA)).toEqual({
      location: { latitude: 6.5244, longitude: 3.3792, timezone: 'Africa/Lagos' },
      current: {
        time: '2026-09-16T12:00',
        temperature: 27.4,
        humidity: 80,
        windSpeed: 12.4,
        precipitation: 0,
        weatherCode: 3,
      },
      daily: [{ date: '2026-09-16', temperatureMax: 30.1, temperatureMin: 24.0, weatherCode: 3 }],
    });
  });

  it('uses null current and an empty daily array when Open-Meteo returns neither', () => {
    const minimal: WeatherData = { latitude: 0, longitude: 0, daily: [] };
    expect(toWeatherResponse(minimal)).toEqual({
      location: { latitude: 0, longitude: 0, timezone: null },
      current: null,
      daily: [],
    });
  });

  it('uses null for individual fields the provider did not supply', () => {
    const data: WeatherData = {
      latitude: 0,
      longitude: 0,
      current: { time: '2026-01-01T00:00' },
      daily: [],
    };
    expect(toWeatherResponse(data).current).toEqual({
      time: '2026-01-01T00:00',
      temperature: null,
      humidity: null,
      windSpeed: null,
      precipitation: null,
      weatherCode: null,
    });
  });
});
