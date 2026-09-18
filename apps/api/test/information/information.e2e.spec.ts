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
    { id: 'Q1033', label: 'Nigeria', description: 'country in West Africa', url: '//www.wikidata.org/wiki/Q1033' },
  ],
  success: 1,
};

const EMPTY_WIKIDATA_SEARCH = { search: [], success: 1 };
const EMPTY_OPENALEX = { meta: { count: 0 }, results: [] };
const EMPTY_GDELT = { articles: [] };

function stubFetchByUrl(routes: Record<string, () => Response>): ReturnType<typeof vi.fn> {
  const fn = vi.fn((url: string) => {
    for (const [needle, respond] of Object.entries(routes)) {
      if (url.includes(needle)) return Promise.resolve(respond());
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
};

const EMPTY_ROUTES = {
  'api.openalex.org': () => jsonResponse(200, EMPTY_OPENALEX),
  'api.gdeltproject.org': () => jsonResponse(200, EMPTY_GDELT),
  'www.wikidata.org': () => jsonResponse(200, EMPTY_WIKIDATA_SEARCH),
};

describe('Information Capabilities (E2E)', () => {
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

  describe('POST /v1/verify', () => {
    it('rejects a claim that is too short', async () => {
      const response = await app.inject({ method: 'POST', url: '/v1/verify', payload: { claim: 'no' } });
      expect(response.statusCode).toBe(400);
    });

    it('returns a supported verdict with evidence when sources affirm the claim', async () => {
      stubFetchByUrl(DEFAULT_ROUTES);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/verify',
        headers: { 'x-request-id': 'e2e-verify-1' },
        payload: { claim: 'Nigeria is a country in West Africa.', sourceTypes: ['knowledge'] },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.meta.requestId).toBe('e2e-verify-1');
      expect(body.data.claim).toBe('Nigeria is a country in West Africa.');
      expect(['supported', 'mixed']).toContain(body.data.verdict);
      expect(body.data.sourcesChecked).toBeGreaterThan(0);
      expect(body.data.evidence[0].source.provider).toBe('knowledge.search');
    });

    it('returns "insufficient" - never a false 200 with fabricated evidence - when nothing relevant is found', async () => {
      stubFetchByUrl(EMPTY_ROUTES);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/verify',
        payload: { claim: 'A wholly unrelated claim about deep sea creatures.', sourceTypes: ['knowledge'] },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data.verdict).toBe('insufficient');
      expect(body.data.evidence).toEqual([]);
    });

    it('rejects an unsupported sourceTypes value', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/verify',
        payload: { claim: 'A perfectly valid claim here.', sourceTypes: ['government'] },
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /v1/evidence', () => {
    it('returns a machine-readable evidence pack with provenance', async () => {
      stubFetchByUrl(DEFAULT_ROUTES);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/evidence',
        headers: { 'x-request-id': 'e2e-evidence-1' },
        payload: { query: 'renewable energy investment in Africa' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data.query).toBe('renewable energy investment in Africa');
      expect(body.data.findings.length).toBeGreaterThan(0);
      expect(body.data.sources.length).toBeGreaterThan(0);
      expect(body.data.retrievedAt).toEqual(expect.any(String));
      for (const finding of body.data.findings) {
        expect(finding.source.provider).toEqual(expect.any(String));
        expect(finding.retrievedAt).toEqual(expect.any(String));
      }
    });

    it('returns empty findings/sources, never fabricated data, when nothing is found', async () => {
      stubFetchByUrl(EMPTY_ROUTES);

      const response = await app.inject({ method: 'POST', url: '/v1/evidence', payload: { query: 'obscure unmatched query' } });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data.findings).toEqual([]);
      expect(body.data.sources).toEqual([]);
    });

    it('rejects a query that is too short', async () => {
      const response = await app.inject({ method: 'POST', url: '/v1/evidence', payload: { query: 'x' } });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /v1/compare', () => {
    it('returns subjects/attributes/sources built only from real returned data', async () => {
      stubFetchByUrl(DEFAULT_ROUTES);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/compare',
        headers: { 'x-request-id': 'e2e-compare-1' },
        payload: { query: 'Nigeria', sourceTypes: ['knowledge'] },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data.query).toBe('Nigeria');
      expect(body.data.subjects).toHaveLength(1);
      expect(body.data.subjects[0].name).toBe('Nigeria');
      expect(body.data.attributes.some((a: { key: string }) => a.key === 'excerpt')).toBe(true);
      expect(body.data.disagreements).toEqual([]);
    });

    it('returns empty subjects/attributes/disagreements when nothing is found', async () => {
      stubFetchByUrl(EMPTY_ROUTES);

      const response = await app.inject({ method: 'POST', url: '/v1/compare', payload: { query: 'obscure unmatched subject' } });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data.subjects).toEqual([]);
      expect(body.data.attributes).toEqual([]);
      expect(body.data.disagreements).toEqual([]);
    });

    it('rejects a query that is too short', async () => {
      const response = await app.inject({ method: 'POST', url: '/v1/compare', payload: { query: 'x' } });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('provider failure handling', () => {
    it('tolerates one source failing without failing the whole verify request', async () => {
      const fn = vi.fn((url: string) => {
        if (url.includes('www.wikidata.org')) return Promise.resolve(jsonResponse(200, RAW_WIKIDATA_SEARCH));
        return Promise.resolve(jsonResponse(502, { error: 'upstream failure' }));
      });
      vi.stubGlobal('fetch', fn);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/verify',
        payload: { claim: 'Nigeria is a country in West Africa.', sourceTypes: ['academic', 'knowledge'] },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data.evidence.some((e: { source: { provider: string } }) => e.source.provider === 'knowledge.search')).toBe(true);
    });
  });
});
