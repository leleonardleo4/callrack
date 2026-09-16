import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../../src/bootstrap.js';
import { jsonResponse, stubFetchAlways, stubFetchSequence } from '../providers/mock-fetch.js';

const RAW_ARTICLE = {
  url: 'https://example.com/article',
  title: 'Example headline',
  seendate: '20230115T120000Z',
  domain: 'example.com',
  language: 'English',
  sourcecountry: 'United States',
};

describe('News Capability (E2E)', () => {
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

  describe('POST /v1/news/search', () => {
    it('returns normalized articles for a valid search, with attribution and request ID', async () => {
      stubFetchSequence([jsonResponse(200, { articles: [RAW_ARTICLE] })]);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/news/search',
        headers: { 'x-request-id': 'e2e-news-search-1' },
        payload: { query: 'renewable energy Africa', limit: 5 },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-request-id']).toBe('e2e-news-search-1');
      const body = JSON.parse(response.payload);
      expect(body.meta.requestId).toBe('e2e-news-search-1');
      expect(body.meta.attribution).toContain('GDELT');
      expect(body.data.results[0]).toMatchObject({ title: 'Example headline', url: 'https://example.com/article' });
    });

    it('rejects a request missing the required query field', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/news/search',
        payload: { limit: 5 },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns an empty result set without error', async () => {
      stubFetchSequence([jsonResponse(200, { articles: [] })]);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/news/search',
        payload: { query: 'zzz-no-matches-e2e' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data).toEqual({ results: [] });
    });

    it('translates a persistent upstream failure into 502 PROVIDER_UNAVAILABLE', async () => {
      stubFetchAlways(jsonResponse(503, {}));

      const response = await app.inject({
        method: 'POST',
        url: '/v1/news/search',
        payload: { query: 'x' },
      });

      expect(response.statusCode).toBe(502);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('PROVIDER_UNAVAILABLE');
    }, 10_000);
  });

  describe('POST /v1/news/trends', () => {
    it('returns normalized trend points for a valid request', async () => {
      stubFetchSequence([
        jsonResponse(200, { timeline: [{ series: 'timeline', data: [{ date: '20230101', value: 12.3 }] }] }),
      ]);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/news/trends',
        payload: { query: 'renewable energy' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data).toEqual({ term: 'renewable energy', points: [{ date: '20230101', volume: 12.3 }] });
      expect(body.meta.attribution).toContain('GDELT');
    });

    it('rejects an invalid timespan format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/news/trends',
        payload: { query: 'x', timespan: 'not-a-timespan' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error.details.fields.timespan).toBeDefined();
    });

    it('returns an empty points array without error', async () => {
      stubFetchSequence([jsonResponse(200, { timeline: [] })]);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/news/trends',
        payload: { query: 'zzz-no-trend-e2e' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data.points).toEqual([]);
    });

    it('translates a persistent upstream failure into 502 PROVIDER_UNAVAILABLE', async () => {
      stubFetchAlways(jsonResponse(500, {}));

      const response = await app.inject({
        method: 'POST',
        url: '/v1/news/trends',
        payload: { query: 'x' },
      });

      expect(response.statusCode).toBe(502);
    }, 10_000);
  });
});
