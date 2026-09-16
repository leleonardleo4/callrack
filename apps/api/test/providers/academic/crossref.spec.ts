import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProviderErrorCode } from '../../../src/providers/common/index.js';
import { CrossrefProvider } from '../../../src/providers/academic/crossref/crossref.provider.js';
import { mapCrossrefSearchResponse, mapCrossrefWork } from '../../../src/providers/academic/crossref/crossref.mapper.js';
import { jsonResponse, malformedJsonResponse, stubFetchSequence } from '../mock-fetch.js';
import { createTestProviderConfig, NO_RETRY_OPTIONS } from '../test-provider-config.js';

const RAW_WORK = {
  DOI: '10.7717/peerj.4375',
  title: ['The state of OA'],
  author: [{ given: 'Heather', family: 'Piwowar' }],
  'published-print': { 'date-parts': [[2018, 2, 13]] },
  'container-title': ['PeerJ'],
  'is-referenced-by-count': 391,
  URL: 'https://doi.org/10.7717/peerj.4375',
};

describe('Crossref mapper', () => {
  it('normalizes a raw work into an AcademicWork', () => {
    const work = mapCrossrefWork(RAW_WORK);

    expect(work).toMatchObject({
      id: 'crossref:10.7717/peerj.4375',
      title: 'The state of OA',
      authors: ['Heather Piwowar'],
      publicationYear: 2018,
      doi: '10.7717/peerj.4375',
      venue: 'PeerJ',
      citationCount: 391,
      sourceProvider: 'crossref',
    });
  });

  it('normalizes an empty search response', () => {
    const result = mapCrossrefSearchResponse({ message: { 'total-results': 0, items: [] } });
    expect(result).toEqual({ works: [], totalCount: 0 });
  });

  it('throws PROVIDER_BAD_RESPONSE for a work missing DOI/title', () => {
    expect(() => mapCrossrefWork({} as never)).toThrowError(
      expect.objectContaining({ code: ProviderErrorCode.PROVIDER_BAD_RESPONSE }),
    );
  });

  it('throws PROVIDER_BAD_RESPONSE when "message.items" is missing', () => {
    expect(() => mapCrossrefSearchResponse({} as never)).toThrowError(
      expect.objectContaining({ code: ProviderErrorCode.PROVIDER_BAD_RESPONSE }),
    );
  });
});

describe('CrossrefProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('searches works and returns normalized results', async () => {
    stubFetchSequence([jsonResponse(200, { message: { 'total-results': 1, items: [RAW_WORK] } })]);
    const provider = new CrossrefProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    const result = await provider.searchWorks({ query: 'open access' });

    expect(result.works).toHaveLength(1);
    expect(result.works[0]?.sourceProvider).toBe('crossref');
  });

  it('returns an empty result set for no matches', async () => {
    stubFetchSequence([jsonResponse(200, { message: { 'total-results': 0, items: [] } })]);
    const provider = new CrossrefProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    const result = await provider.searchWorks({ query: 'zzz-no-matches' });

    expect(result).toEqual({ works: [], totalCount: 0 });
  });

  it('maps a malformed response to a provider error', async () => {
    stubFetchSequence([malformedJsonResponse()]);
    const provider = new CrossrefProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    await expect(provider.searchWorks({ query: 'x' })).rejects.toMatchObject({
      code: ProviderErrorCode.PROVIDER_BAD_RESPONSE,
    });
  });

  it('surfaces PROVIDER_RATE_LIMITED for a 429 response', async () => {
    stubFetchSequence([jsonResponse(429, {})]);
    const provider = new CrossrefProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    await expect(provider.searchWorks({ query: 'x' })).rejects.toMatchObject({
      code: ProviderErrorCode.PROVIDER_RATE_LIMITED,
    });
  });

  it('surfaces a normalized error for an upstream 5xx failure', async () => {
    stubFetchSequence([jsonResponse(503, {})]);
    const provider = new CrossrefProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    await expect(provider.getWork({ id: '10.7717/peerj.4375' })).rejects.toMatchObject({
      code: ProviderErrorCode.PROVIDER_UNAVAILABLE,
    });
  });

  it('reports health status from a probe request', async () => {
    stubFetchSequence([jsonResponse(200, { message: { 'total-results': 0, items: [] } })]);
    const provider = new CrossrefProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    const health = await provider.checkHealth();

    expect(health.healthy).toBe(true);
    expect(health.provider).toBe('academic.crossref');
  });
});
