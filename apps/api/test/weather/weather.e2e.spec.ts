import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../../src/bootstrap.js';
import { jsonResponse, stubFetchAlways, stubFetchImmediateAbort, stubFetchSequence } from '../providers/mock-fetch.js';

const RAW_FORECAST = {
  latitude: 6.5244,
  longitude: 3.3792,
  timezone: 'Africa/Lagos',
  current: { time: '2026-09-16T12:00', temperature_2m: 27.4, relative_humidity_2m: 80, wind_speed_10m: 12.4, precipitation: 0, weather_code: 3 },
  daily: { time: ['2026-09-16', '2026-09-17'], temperature_2m_max: [30.1, 29.5], temperature_2m_min: [24.0, 23.8], weather_code: [3, 1] },
};

describe('Weather Capability (E2E)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a normalized forecast for valid coordinates, with the request ID present', async () => {
    stubFetchSequence([jsonResponse(200, RAW_FORECAST)]);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/weather',
      headers: { 'x-request-id': 'e2e-weather-1' },
      payload: { latitude: 6.5244, longitude: 3.3792 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-request-id']).toBe('e2e-weather-1');
    const body = JSON.parse(response.payload);
    expect(body.meta.requestId).toBe('e2e-weather-1');
    expect(body.data.location).toEqual({ latitude: 6.5244, longitude: 3.3792, timezone: 'Africa/Lagos' });
    expect(body.data.current).toMatchObject({ temperature: 27.4, humidity: 80 });
    expect(body.data.daily).toHaveLength(2);
  });

  it('rejects an invalid latitude', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/weather',
      payload: { latitude: 900, longitude: 3.3792 },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error.details.fields.latitude).toBeDefined();
  });

  it('rejects an invalid longitude', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/weather',
      payload: { latitude: 6.5244, longitude: -900 },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error.details.fields.longitude).toBeDefined();
  });

  it('rejects an unsupported "days" option', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/weather',
      payload: { latitude: 6.5244, longitude: 3.3792, days: 100 },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error.details.fields.days).toBeDefined();
  });

  it('translates a persistent provider timeout into 504', async () => {
    stubFetchImmediateAbort();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/weather',
      payload: { latitude: 6.5244, longitude: 3.3792 },
    });

    expect(response.statusCode).toBe(504);
    const body = JSON.parse(response.payload);
    expect(body.error.code).toBe('PROVIDER_TIMEOUT');
  }, 10_000);

  it('translates a persistent upstream failure into 502', async () => {
    stubFetchAlways(jsonResponse(503, {}));

    const response = await app.inject({
      method: 'POST',
      url: '/v1/weather',
      payload: { latitude: 6.5244, longitude: 3.3792 },
    });

    expect(response.statusCode).toBe(502);
  }, 10_000);
});
