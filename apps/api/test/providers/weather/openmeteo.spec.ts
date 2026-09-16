import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProviderErrorCode } from '../../../src/providers/common/index.js';
import { OpenMeteoProvider } from '../../../src/providers/weather/openmeteo/openmeteo.provider.js';
import { mapOpenMeteoForecast } from '../../../src/providers/weather/openmeteo/openmeteo.mapper.js';
import { jsonResponse, malformedJsonResponse, stubFetchSequence } from '../mock-fetch.js';
import { createTestProviderConfig, NO_RETRY_OPTIONS } from '../test-provider-config.js';

const RAW_FORECAST = {
  latitude: 52.52,
  longitude: 13.41,
  timezone: 'Europe/Berlin',
  current: { time: '2023-01-01T00:00', temperature_2m: 5.2, wind_speed_10m: 10.1, precipitation: 0, weather_code: 3 },
  daily: { time: ['2023-01-01', '2023-01-02'], temperature_2m_max: [6, 7], temperature_2m_min: [2, 3], weather_code: [3, 1] },
};

describe('Open-Meteo mapper', () => {
  it('normalizes a forecast response', () => {
    const result = mapOpenMeteoForecast(RAW_FORECAST);
    expect(result.current).toEqual({
      time: '2023-01-01T00:00',
      temperatureC: 5.2,
      windSpeedKph: 10.1,
      precipitationMm: 0,
      weatherCode: 3,
    });
    expect(result.daily).toHaveLength(2);
    expect(result.daily[0]).toEqual({ time: '2023-01-01', temperatureC: 6, temperatureMinC: 2, weatherCode: 3 });
  });

  it('normalizes a response with no daily data', () => {
    const result = mapOpenMeteoForecast({ latitude: 0, longitude: 0 });
    expect(result).toEqual({ latitude: 0, longitude: 0, timezone: undefined, current: undefined, daily: [] });
  });

  it('throws PROVIDER_BAD_RESPONSE when latitude/longitude are missing', () => {
    expect(() => mapOpenMeteoForecast({} as never)).toThrowError(
      expect.objectContaining({ code: ProviderErrorCode.PROVIDER_BAD_RESPONSE }),
    );
  });
});

describe('OpenMeteoProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches and normalizes a forecast', async () => {
    stubFetchSequence([jsonResponse(200, RAW_FORECAST)]);
    const provider = new OpenMeteoProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    const result = await provider.getForecast({ latitude: 52.52, longitude: 13.41 });

    expect(result.latitude).toBe(52.52);
    expect(result.daily).toHaveLength(2);
  });

  it('uses the configured base URL (self-hosted override)', async () => {
    const fetchMock = stubFetchSequence([jsonResponse(200, { latitude: 0, longitude: 0 })]);
    const provider = new OpenMeteoProvider(
      createTestProviderConfig({ OPEN_METEO_BASE_URL: 'https://internal.example.test' }),
      NO_RETRY_OPTIONS,
    );

    await provider.getForecast({ latitude: 0, longitude: 0 });

    const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(calledUrl.startsWith('https://internal.example.test/')).toBe(true);
  });

  it('maps a malformed response to a provider error', async () => {
    stubFetchSequence([malformedJsonResponse()]);
    const provider = new OpenMeteoProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    await expect(provider.getForecast({ latitude: 0, longitude: 0 })).rejects.toMatchObject({
      code: ProviderErrorCode.PROVIDER_BAD_RESPONSE,
    });
  });

  it('surfaces PROVIDER_RATE_LIMITED for a 429 response', async () => {
    stubFetchSequence([jsonResponse(429, {})]);
    const provider = new OpenMeteoProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    await expect(provider.getForecast({ latitude: 0, longitude: 0 })).rejects.toMatchObject({
      code: ProviderErrorCode.PROVIDER_RATE_LIMITED,
    });
  });

  it('surfaces a normalized error for an upstream 5xx failure', async () => {
    stubFetchSequence([jsonResponse(503, {})]);
    const provider = new OpenMeteoProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    await expect(provider.getForecast({ latitude: 0, longitude: 0 })).rejects.toMatchObject({
      code: ProviderErrorCode.PROVIDER_UNAVAILABLE,
    });
  });

  it('reports health status from a probe request', async () => {
    stubFetchSequence([jsonResponse(200, { latitude: 0, longitude: 0 })]);
    const provider = new OpenMeteoProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    const health = await provider.checkHealth();

    expect(health.healthy).toBe(true);
    expect(health.provider).toBe('weather.openmeteo');
  });
});
