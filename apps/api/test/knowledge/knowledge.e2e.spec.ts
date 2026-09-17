import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../../src/bootstrap.js';
import { jsonResponse, stubFetchAlways, stubFetchImmediateAbort, stubFetchSequence } from '../providers/mock-fetch.js';

const RAW_SEARCH_RESPONSE = {
  search: [
    { id: 'Q8673', label: 'Lagos', description: 'city in Lagos State, Nigeria', url: '//www.wikidata.org/wiki/Q8673' },
  ],
  success: 1,
};

describe('Knowledge Capability (E2E)', () => {
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

  it('returns normalized results for a valid search, with attribution and request ID', async () => {
    stubFetchSequence([jsonResponse(200, RAW_SEARCH_RESPONSE)]);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/knowledge/search',
      headers: { 'x-request-id': 'e2e-knowledge-1' },
      payload: { query: 'Lagos' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-request-id']).toBe('e2e-knowledge-1');
    const body = JSON.parse(response.payload);
    expect(body.meta.requestId).toBe('e2e-knowledge-1');
    expect(body.meta.attribution).toContain('Wikidata');
    expect(body.data.results[0]).toMatchObject({ id: 'Q8673', name: 'Lagos', source: 'wikimedia' });
  });

  it('accepts an explicit limit', async () => {
    stubFetchSequence([jsonResponse(200, RAW_SEARCH_RESPONSE)]);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/knowledge/search',
      payload: { query: 'Lagos', limit: 3 },
    });

    expect(response.statusCode).toBe(200);
  });

  it('rejects an empty query', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/knowledge/search',
      payload: { query: '' },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an invalid limit', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/knowledge/search',
      payload: { query: 'Lagos', limit: 500 },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error.details.fields.limit).toBeDefined();
  });

  it('returns an empty result set without error', async () => {
    stubFetchSequence([jsonResponse(200, { search: [], success: 1 })]);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/knowledge/search',
      payload: { query: 'zzz-no-matches-e2e' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data).toEqual({ results: [] });
  });

  it('translates a persistent provider timeout into 504', async () => {
    stubFetchImmediateAbort();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/knowledge/search',
      payload: { query: 'x' },
    });

    expect(response.statusCode).toBe(504);
    const body = JSON.parse(response.payload);
    expect(body.error.code).toBe('PROVIDER_TIMEOUT');
  }, 10_000);

  it('translates rate limiting into 429', async () => {
    stubFetchAlways(jsonResponse(429, {}));

    const response = await app.inject({
      method: 'POST',
      url: '/v1/knowledge/search',
      payload: { query: 'x' },
    });

    expect(response.statusCode).toBe(429);
  });

  it('translates a persistent upstream failure into 502', async () => {
    stubFetchAlways(jsonResponse(503, {}));

    const response = await app.inject({
      method: 'POST',
      url: '/v1/knowledge/search',
      payload: { query: 'x' },
    });

    expect(response.statusCode).toBe(502);
  }, 10_000);
});
