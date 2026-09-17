import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../../src/bootstrap.js';
import { jsonResponse, stubFetchAlways, stubFetchSequence } from '../providers/mock-fetch.js';

const RAW_HOLIDAY = {
  date: '2026-10-01',
  localName: 'National Day',
  name: 'National Day',
  countryCode: 'NG',
  fixed: false,
  global: true,
  counties: null,
  launchYear: null,
  types: ['Public'],
};

describe('Holidays Capability (E2E)', () => {
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

  it('returns normalized holidays for a valid country/year, with the request ID present', async () => {
    stubFetchSequence([jsonResponse(200, [RAW_HOLIDAY])]);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/holidays',
      headers: { 'x-request-id': 'e2e-holidays-1' },
      payload: { country: 'NG', year: 2026 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-request-id']).toBe('e2e-holidays-1');
    const body = JSON.parse(response.payload);
    expect(body.meta.requestId).toBe('e2e-holidays-1');
    expect(body.data).toEqual({
      country: 'NG',
      year: 2026,
      holidays: [
        { date: '2026-10-01', name: 'National Day', localName: 'National Day', countryCode: 'NG', global: true, counties: null, types: ['Public'] },
      ],
    });
  });

  it('rejects an invalid country code', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/holidays',
      payload: { country: 'NGA', year: 2026 },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error.details.fields.country).toBeDefined();
  });

  it('rejects an invalid year', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/holidays',
      payload: { country: 'NG', year: 1500 },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error.details.fields.year).toBeDefined();
  });

  it('normalizes an empty provider response without treating it as an error', async () => {
    stubFetchSequence([jsonResponse(200, [])]);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/holidays',
      payload: { country: 'NG', year: 2026 },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data).toEqual({ country: 'NG', year: 2026, holidays: [] });
  });

  it('maps an unrecognized country code (Nager.Date 404) to a 400 INVALID_REQUEST', async () => {
    stubFetchSequence([jsonResponse(404, { title: 'Unknown country code' })]);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/holidays',
      payload: { country: 'ZZ', year: 2026 },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error.code).toBe('INVALID_REQUEST');
  });

  it('translates a persistent upstream failure into 502', async () => {
    stubFetchAlways(jsonResponse(503, {}));

    const response = await app.inject({
      method: 'POST',
      url: '/v1/holidays',
      payload: { country: 'NG', year: 2026 },
    });

    expect(response.statusCode).toBe(502);
  }, 10_000);
});
