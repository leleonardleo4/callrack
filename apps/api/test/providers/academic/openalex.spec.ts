import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProviderErrorCode } from '../../../src/providers/common/index.js';
import { OpenAlexProvider } from '../../../src/providers/academic/openalex/openalex.provider.js';
import { mapOpenAlexSearchResponse, mapOpenAlexWork } from '../../../src/providers/academic/openalex/openalex.mapper.js';
import { jsonResponse, malformedJsonResponse, stubFetchSequence } from '../mock-fetch.js';
import { createTestProviderConfig, NO_RETRY_OPTIONS } from '../test-provider-config.js';

const RAW_WORK = {
  id: 'https://openalex.org/W2741809807',
  doi: 'https://doi.org/10.7717/peerj.4375',
  title: 'The state of OA',
  publication_year: 2018,
  primary_location: { source: { display_name: 'PeerJ' } },
  authorships: [{ author: { display_name: 'Heather Piwowar' } }],
  cited_by_count: 391,
  open_access: { is_oa: true, oa_url: 'https://peerj.com/articles/4375.pdf' },
};

describe('OpenAlex mapper', () => {
  it('normalizes a raw work into an AcademicWork', () => {
    const work = mapOpenAlexWork(RAW_WORK);

    expect(work).toEqual({
      id: 'openalex:W2741809807',
      title: 'The state of OA',
      authors: ['Heather Piwowar'],
      publicationYear: 2018,
      doi: '10.7717/peerj.4375',
      venue: 'PeerJ',
      citationCount: 391,
      openAccessUrl: 'https://peerj.com/articles/4375.pdf',
      sourceProvider: 'openalex',
    });
  });

  it('normalizes an empty search response', () => {
    const result = mapOpenAlexSearchResponse({ meta: { count: 0 }, results: [] });
    expect(result).toEqual({ works: [], totalCount: 0 });
  });

  it('throws PROVIDER_BAD_RESPONSE for a work missing required fields', () => {
    expect(() => mapOpenAlexWork({} as never)).toThrowError(
      expect.objectContaining({ code: ProviderErrorCode.PROVIDER_BAD_RESPONSE }),
    );
  });

  it('throws PROVIDER_BAD_RESPONSE when the results array is missing', () => {
    expect(() => mapOpenAlexSearchResponse({} as never)).toThrowError(
      expect.objectContaining({ code: ProviderErrorCode.PROVIDER_BAD_RESPONSE }),
    );
  });
});

describe('OpenAlexProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('searches works and returns normalized results', async () => {
    stubFetchSequence([jsonResponse(200, { meta: { count: 1 }, results: [RAW_WORK] })]);
    const provider = new OpenAlexProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    const result = await provider.searchWorks({ query: 'open access' });

    expect(result.works).toHaveLength(1);
    expect(result.works[0]?.sourceProvider).toBe('openalex');
  });

  it('returns an empty result set for no matches', async () => {
    stubFetchSequence([jsonResponse(200, { meta: { count: 0 }, results: [] })]);
    const provider = new OpenAlexProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    const result = await provider.searchWorks({ query: 'zzz-no-matches' });

    expect(result).toEqual({ works: [], totalCount: 0 });
  });

  it('maps a malformed response to a provider error', async () => {
    stubFetchSequence([malformedJsonResponse()]);
    const provider = new OpenAlexProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    await expect(provider.searchWorks({ query: 'x' })).rejects.toMatchObject({
      code: ProviderErrorCode.PROVIDER_BAD_RESPONSE,
    });
  });

  it('surfaces PROVIDER_RATE_LIMITED for a 429 response', async () => {
    stubFetchSequence([jsonResponse(429, {})]);
    const provider = new OpenAlexProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    await expect(provider.searchWorks({ query: 'x' })).rejects.toMatchObject({
      code: ProviderErrorCode.PROVIDER_RATE_LIMITED,
    });
  });

  it('surfaces a normalized error for an upstream 5xx failure', async () => {
    stubFetchSequence([jsonResponse(503, {})]);
    const provider = new OpenAlexProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    await expect(provider.getWork({ id: 'W123' })).rejects.toMatchObject({
      code: ProviderErrorCode.PROVIDER_UNAVAILABLE,
    });
  });

  it('reports healthy when the probe request succeeds', async () => {
    stubFetchSequence([jsonResponse(200, { meta: { count: 0 }, results: [] })]);
    const provider = new OpenAlexProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    const health = await provider.checkHealth();

    expect(health.healthy).toBe(true);
    expect(health.provider).toBe('academic.openalex');
  });

  it('reports unhealthy when the probe request fails', async () => {
    stubFetchSequence([jsonResponse(500, {})]);
    const provider = new OpenAlexProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    const health = await provider.checkHealth();

    expect(health.healthy).toBe(false);
    expect(health.error).toBeDefined();
  });
});
