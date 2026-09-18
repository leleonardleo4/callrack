import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../../src/bootstrap.js';
import { jsonResponse } from '../providers/mock-fetch.js';

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

const RAW_ARTICLE = {
  url: 'https://example.com/article',
  title: 'Example headline',
  seendate: '20230115T120000Z',
  domain: 'example.com',
  language: 'English',
  sourcecountry: 'United States',
};

const RAW_WIKIDATA_SEARCH = {
  search: [
    { id: 'Q8673', label: 'Lagos', description: 'city in Lagos State, Nigeria', url: '//www.wikidata.org/wiki/Q8673' },
  ],
  success: 1,
};

const RAW_CENSUS_TABLE = [
  ['NAME', 'B01001_001E'],
  ['California', '39029342'],
];

/**
 * Research composes multiple capability services that call fetch
 * concurrently, so the order fetch() is actually invoked in is not
 * deterministic (each provider awaits a different number of times before
 * reaching the network call). Route by URL instead of call order.
 */
function stubFetchByUrl(routes: Record<string, () => Response>): ReturnType<typeof vi.fn> {
  const fn = vi.fn((url: string) => {
    for (const [needle, respond] of Object.entries(routes)) {
      if (url.includes(needle)) {
        return Promise.resolve(respond());
      }
    }
    return Promise.resolve(jsonResponse(500, { error: `no stub route for ${url}` }));
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

const DEFAULT_ROUTES = {
  'api.openalex.org': () => jsonResponse(200, { meta: { count: 1 }, results: [RAW_OPENALEX_WORK] }),
  'api.gdeltproject.org': () => jsonResponse(200, { articles: [RAW_ARTICLE] }),
  'www.wikidata.org': () => jsonResponse(200, RAW_WIKIDATA_SEARCH),
  'api.census.gov': () => jsonResponse(200, RAW_CENSUS_TABLE),
};

describe('Research Capability (E2E)', () => {
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

  it('composes the default sources (academic, news, knowledge) into a complete result', async () => {
    stubFetchByUrl(DEFAULT_ROUTES);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/research',
      headers: { 'x-request-id': 'e2e-research-1' },
      payload: { query: 'renewable energy investment in Africa' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-request-id']).toBe('e2e-research-1');
    const body = JSON.parse(response.payload);
    expect(body.meta.requestId).toBe('e2e-research-1');
    expect(body.meta.sourcesUsed.sort()).toEqual(['academic', 'knowledge', 'news']);
    expect(body.data.status).toBe('complete');
    expect(body.data.query).toBe('renewable energy investment in Africa');
    expect(body.data.sources.academic).toMatchObject({ status: 'success' });
    expect(body.data.sources.academic.data.results[0]).toMatchObject({ title: 'The state of OA' });
    expect(body.data.sources.news).toMatchObject({ status: 'success' });
    expect(body.data.sources.knowledge).toMatchObject({ status: 'success' });
    expect(body.data.sources.government).toBeUndefined();
  });

  it('honors an explicit source list and only calls those capabilities', async () => {
    const fetchStub = stubFetchByUrl(DEFAULT_ROUTES);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/research',
      payload: { query: 'renewable energy investment in Africa', sources: ['news', 'knowledge'] },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(Object.keys(body.data.sources).sort()).toEqual(['knowledge', 'news']);
    expect(fetchStub.mock.calls.some(([url]: [string]) => url.includes('api.openalex.org'))).toBe(false);
  });

  it('composes government only when explicitly requested with its required options', async () => {
    stubFetchByUrl(DEFAULT_ROUTES);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/research',
      payload: {
        query: 'census data',
        sources: ['government'],
        government: { dataset: 'acs/acs1', year: 2021, variables: ['NAME', 'B01001_001E'], forGeography: 'state:*' },
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.sources.government).toMatchObject({ status: 'success' });
    expect(body.data.sources.government.data.rows).toEqual([{ NAME: 'California', B01001_001E: '39029342' }]);
  });

  it('rejects a provider-level source name instead of a capability name', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/research',
      payload: { query: 'bitcoin price', sources: ['coingecko'] },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details.fields.sources).toBeDefined();
  });

  it('rejects more sources than exist', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/research',
      payload: {
        query: 'renewable energy',
        sources: ['academic', 'news', 'knowledge', 'government', 'academic'],
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error.details.fields.sources).toBeDefined();
  });

  it('rejects "government" without its required dataset/year/variables/forGeography', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/research',
      payload: { query: 'census data', sources: ['government'] },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a query that is too short', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/research',
      payload: { query: 'ab' },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error.details.fields.query).toBeDefined();
  });

  it('marks a source "empty" without failing the request when it has no results', async () => {
    stubFetchByUrl({
      ...DEFAULT_ROUTES,
      'www.wikidata.org': () => jsonResponse(200, { search: [], success: 1 }),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/research',
      payload: { query: 'zzz-no-matches-e2e' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.sources.knowledge).toEqual({ status: 'empty', data: { results: [] } });
    expect(body.data.status).toBe('complete');
  });

  it('reports overall status "partial" when one source fails but others succeed', async () => {
    stubFetchByUrl({
      ...DEFAULT_ROUTES,
      'api.gdeltproject.org': () => jsonResponse(503, {}),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/research',
      payload: { query: 'renewable energy investment in Africa' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.status).toBe('partial');
    expect(body.data.sources.news.status).toBe('failed');
    expect(body.data.sources.news.error.code).toBe('PROVIDER_UNAVAILABLE');
    expect(body.data.sources.academic.status).toBe('success');
    expect(body.data.sources.knowledge.status).toBe('success');
  }, 10_000);

  it('reports overall status "failed" when every requested source fails', async () => {
    stubFetchByUrl({
      'api.openalex.org': () => jsonResponse(503, {}),
      'api.gdeltproject.org': () => jsonResponse(503, {}),
      'www.wikidata.org': () => jsonResponse(503, {}),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/research',
      payload: { query: 'renewable energy investment in Africa' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.status).toBe('failed');
    expect(body.data.sources.academic.status).toBe('failed');
    expect(body.data.sources.news.status).toBe('failed');
    expect(body.data.sources.knowledge.status).toBe('failed');
  }, 10_000);

  it('runs independent sources concurrently rather than one after another', async () => {
    const startedAt: Record<string, number> = {};
    const finishedAt: Record<string, number> = {};
    const fn = vi.fn((url: string) => {
      const wait = url.includes('openalex') ? 40 : 5;
      const name = url.includes('openalex') ? 'academic' : url.includes('gdeltproject') ? 'news' : 'knowledge';
      startedAt[name] = Date.now();
      return new Promise<Response>((resolve) => {
        setTimeout(() => {
          finishedAt[name] = Date.now();
          if (name === 'academic') resolve(jsonResponse(200, { meta: { count: 1 }, results: [RAW_OPENALEX_WORK] }));
          else if (name === 'news') resolve(jsonResponse(200, { articles: [RAW_ARTICLE] }));
          else resolve(jsonResponse(200, RAW_WIKIDATA_SEARCH));
        }, wait);
      });
    });
    vi.stubGlobal('fetch', fn);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/research',
      payload: { query: 'renewable energy investment in Africa' },
    });

    expect(response.statusCode).toBe(200);
    // The slow "academic" call (40ms) starts before the fast "news"/"knowledge"
    // calls (5ms) finish - proof they run concurrently, not sequentially.
    expect(startedAt.academic).toBeLessThanOrEqual(finishedAt.news);
    expect(startedAt.academic).toBeLessThanOrEqual(finishedAt.knowledge);
  });
});
