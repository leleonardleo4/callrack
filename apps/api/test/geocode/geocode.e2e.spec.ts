import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../../src/bootstrap.js';
import { jsonResponse, stubFetchAlways, stubFetchSequence } from '../providers/mock-fetch.js';

const RAW_FEATURE = {
  type: 'Feature',
  properties: {
    osm_type: 'N',
    osm_id: 27565124,
    osm_key: 'place',
    osm_value: 'city',
    type: 'city',
    name: 'Lagos',
    state: 'Lagos',
    country: 'Nigeria',
    postcode: '100242',
    countrycode: 'NG',
  },
  geometry: { type: 'Point', coordinates: [3.3941795, 6.4550575] },
};

describe('Geocode Capability (E2E)', () => {
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

  describe('mode: forward', () => {
    it('returns normalized results for a valid query, with the request ID present', async () => {
      stubFetchSequence([jsonResponse(200, { features: [RAW_FEATURE] })]);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/geocode',
        headers: { 'x-request-id': 'e2e-geocode-1' },
        payload: { mode: 'forward', query: 'Lagos, Nigeria' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-request-id']).toBe('e2e-geocode-1');
      const body = JSON.parse(response.payload);
      expect(body.meta.requestId).toBe('e2e-geocode-1');
      expect(body.data.results[0]).toMatchObject({ name: 'Lagos', country: 'Nigeria', countryCode: 'NG', type: 'city' });
    });

    it('rejects an empty query', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/geocode',
        payload: { mode: 'forward', query: '' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns an empty result set without error', async () => {
      stubFetchSequence([jsonResponse(200, { features: [] })]);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/geocode',
        payload: { mode: 'forward', query: 'zzz-nowhere-e2e' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data).toEqual({ results: [] });
    });

    it('translates a persistent provider failure into 502', async () => {
      stubFetchAlways(jsonResponse(503, {}));

      const response = await app.inject({
        method: 'POST',
        url: '/v1/geocode',
        payload: { mode: 'forward', query: 'x' },
      });

      expect(response.statusCode).toBe(502);
    }, 10_000);
  });

  describe('mode: reverse', () => {
    it('returns a normalized location for valid coordinates', async () => {
      stubFetchSequence([jsonResponse(200, { features: [RAW_FEATURE] })]);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/geocode',
        payload: { mode: 'reverse', latitude: 6.5244, longitude: 3.3792 },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data.results[0]).toMatchObject({ name: 'Lagos' });
    });

    it('rejects invalid coordinates', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/geocode',
        payload: { mode: 'reverse', latitude: 900, longitude: 3.3792 },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
