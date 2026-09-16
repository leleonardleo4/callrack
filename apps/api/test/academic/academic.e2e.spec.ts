import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../../src/bootstrap.js';
import {
  jsonResponse,
  stubFetchAlways,
  stubFetchImmediateAbort,
  stubFetchSequence,
} from '../providers/mock-fetch.js';

const RAW_OPENALEX_WORK = {
  id: 'https://openalex.org/W2741809807',
  doi: 'https://doi.org/10.7717/peerj.4375',
  title: 'The state of OA',
  publication_year: 2018,
  primary_location: { source: { display_name: 'PeerJ' } },
  authorships: [{ author: { display_name: 'Heather Piwowar' } }],
  cited_by_count: 391,
  open_access: { is_oa: true, oa_url: 'https://peerj.com/articles/4375.pdf' },
};

const RAW_CROSSREF_WORK = {
  status: 'ok',
  message: {
    DOI: '10.7717/peerj.4375',
    title: ['The state of OA'],
    author: [{ given: 'Heather', family: 'Piwowar' }],
    'is-referenced-by-count': 391,
  },
};

describe('Academic Capability (E2E)', () => {
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

  describe('POST /v1/academic/search', () => {
    it('returns normalized results for a valid search, with the request ID present', async () => {
      stubFetchSequence([jsonResponse(200, { meta: { count: 1 }, results: [RAW_OPENALEX_WORK] })]);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/academic/search',
        headers: { 'x-request-id': 'e2e-academic-search-1' },
        payload: { query: 'open access', limit: 5 },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-request-id']).toBe('e2e-academic-search-1');
      const body = JSON.parse(response.payload);
      expect(body.meta.requestId).toBe('e2e-academic-search-1');
      expect(body.data.meta.count).toBe(1);
      expect(body.data.results[0]).toMatchObject({ title: 'The state of OA', source: 'openalex' });
    });

    it('rejects a request missing the required query field', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/academic/search',
        payload: { limit: 5 },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details.fields.query).toBeDefined();
      expect(body.meta.requestId).toBeDefined();
    });

    it('rejects a limit above the allowed maximum', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/academic/search',
        payload: { query: 'x', limit: 500 },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error.details.fields.limit).toBeDefined();
    });

    it('returns an empty result set without error', async () => {
      stubFetchSequence([jsonResponse(200, { meta: { count: 0 }, results: [] })]);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/academic/search',
        payload: { query: 'zzz-no-matches-e2e' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data).toEqual({ results: [], meta: { count: 0 } });
    });

    it('translates a persistent provider timeout into 504 PROVIDER_TIMEOUT', async () => {
      stubFetchImmediateAbort();

      const response = await app.inject({
        method: 'POST',
        url: '/v1/academic/search',
        payload: { query: 'x' },
      });

      expect(response.statusCode).toBe(504);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('PROVIDER_TIMEOUT');
    }, 10_000);

    it('translates rate limiting from both providers into 429 PROVIDER_RATE_LIMITED', async () => {
      stubFetchAlways(jsonResponse(429, {}));

      const response = await app.inject({
        method: 'POST',
        url: '/v1/academic/search',
        payload: { query: 'x' },
      });

      expect(response.statusCode).toBe(429);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('PROVIDER_RATE_LIMITED');
    });

    it('translates persistent upstream failures into 502 PROVIDER_UNAVAILABLE', async () => {
      stubFetchAlways(jsonResponse(503, {}));

      const response = await app.inject({
        method: 'POST',
        url: '/v1/academic/search',
        payload: { query: 'x' },
      });

      expect(response.statusCode).toBe(502);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('PROVIDER_UNAVAILABLE');
    }, 10_000);
  });

  describe('POST /v1/academic/work', () => {
    it('returns the work for a valid DOI', async () => {
      stubFetchSequence([jsonResponse(200, RAW_OPENALEX_WORK)]);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/academic/work',
        payload: { doi: '10.7717/peerj.4375' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data).toMatchObject({ title: 'The state of OA', source: 'openalex', doi: '10.7717/peerj.4375' });
    });

    it('rejects a malformed DOI', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/academic/work',
        payload: { doi: 'not-a-doi' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error.details.fields.doi).toBeDefined();
    });

    it('returns 404 when neither provider has the work', async () => {
      stubFetchAlways(jsonResponse(404, {}));

      const response = await app.inject({
        method: 'POST',
        url: '/v1/academic/work',
        payload: { doi: '10.9999/does-not-exist' },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('falls back to Crossref when OpenAlex is unavailable, preserving the actual source', async () => {
      // OpenAlex's shared HTTP client retries a 503 twice (3 attempts total)
      // before giving up and letting the service fall back to Crossref.
      stubFetchSequence([
        jsonResponse(503, {}),
        jsonResponse(503, {}),
        jsonResponse(503, {}),
        jsonResponse(200, RAW_CROSSREF_WORK),
      ]);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/academic/work',
        payload: { doi: '10.7717/peerj.4375' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data.source).toBe('crossref');
    }, 10_000);

    it('translates a persistent upstream failure into 502', async () => {
      stubFetchAlways(jsonResponse(500, {}));

      const response = await app.inject({
        method: 'POST',
        url: '/v1/academic/work',
        payload: { doi: '10.7717/peerj.4375' },
      });

      expect(response.statusCode).toBe(502);
    }, 10_000);
  });
});
