import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProviderErrorCode } from '../../../src/providers/common/index.js';
import { GdeltProvider } from '../../../src/providers/news/gdelt/gdelt.provider.js';
import { mapGdeltSearchResponse, mapGdeltTrends } from '../../../src/providers/news/gdelt/gdelt.mapper.js';
import { jsonResponse, malformedJsonResponse, stubFetchSequence } from '../mock-fetch.js';
import { NO_RETRY_OPTIONS } from '../test-provider-config.js';

const RAW_ARTICLE = {
  url: 'https://example.com/article',
  title: 'Example headline',
  seendate: '20230115T120000Z',
  domain: 'example.com',
  language: 'English',
  sourcecountry: 'United States',
};

describe('GDELT mapper', () => {
  it('normalizes a raw article', () => {
    const article = mapGdeltSearchResponse({ articles: [RAW_ARTICLE] }).articles[0];
    expect(article).toEqual({
      title: 'Example headline',
      url: 'https://example.com/article',
      source: 'example.com',
      publishedAt: '2023-01-15T12:00:00Z',
      language: 'English',
      country: 'United States',
      sourceProvider: 'gdelt',
    });
  });

  it('normalizes an empty article list', () => {
    expect(mapGdeltSearchResponse({ articles: [] })).toEqual({ articles: [] });
  });

  it('throws PROVIDER_BAD_RESPONSE when "articles" is missing', () => {
    expect(() => mapGdeltSearchResponse({} as never)).toThrowError(
      expect.objectContaining({ code: ProviderErrorCode.PROVIDER_BAD_RESPONSE }),
    );
  });

  it('normalizes a timeline into trend points', () => {
    const result = mapGdeltTrends(
      { timeline: [{ series: 'timeline', data: [{ date: '20230101', value: 12.3 }] }] },
      'inflation',
    );
    expect(result).toEqual({ term: 'inflation', points: [{ date: '20230101', volume: 12.3 }] });
  });

  it('throws PROVIDER_BAD_RESPONSE when "timeline" is missing', () => {
    expect(() => mapGdeltTrends({} as never, 'x')).toThrowError(
      expect.objectContaining({ code: ProviderErrorCode.PROVIDER_BAD_RESPONSE }),
    );
  });
});

describe('GdeltProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('searches and returns normalized articles', async () => {
    stubFetchSequence([jsonResponse(200, { articles: [RAW_ARTICLE] })]);
    const provider = new GdeltProvider(NO_RETRY_OPTIONS);

    const result = await provider.search({ query: 'inflation' });

    expect(result.articles).toHaveLength(1);
    expect(result.articles[0]?.sourceProvider).toBe('gdelt');
  });

  it('returns an empty result set for no matches', async () => {
    stubFetchSequence([jsonResponse(200, { articles: [] })]);
    const provider = new GdeltProvider(NO_RETRY_OPTIONS);

    expect(await provider.search({ query: 'zzz-no-matches' })).toEqual({ articles: [] });
  });

  it('maps a malformed response to a provider error', async () => {
    stubFetchSequence([malformedJsonResponse()]);
    const provider = new GdeltProvider(NO_RETRY_OPTIONS);

    await expect(provider.search({ query: 'x' })).rejects.toMatchObject({
      code: ProviderErrorCode.PROVIDER_BAD_RESPONSE,
    });
  });

  it('surfaces PROVIDER_RATE_LIMITED for a 429 response', async () => {
    stubFetchSequence([jsonResponse(429, {})]);
    const provider = new GdeltProvider(NO_RETRY_OPTIONS);

    await expect(provider.getTrends({ query: 'x' })).rejects.toMatchObject({
      code: ProviderErrorCode.PROVIDER_RATE_LIMITED,
    });
  });

  it('surfaces a normalized error for an upstream 5xx failure', async () => {
    stubFetchSequence([jsonResponse(503, {})]);
    const provider = new GdeltProvider(NO_RETRY_OPTIONS);

    await expect(provider.search({ query: 'x' })).rejects.toMatchObject({
      code: ProviderErrorCode.PROVIDER_UNAVAILABLE,
    });
  });

  it('reports health status from a probe request', async () => {
    stubFetchSequence([jsonResponse(200, { articles: [] })]);
    const provider = new GdeltProvider(NO_RETRY_OPTIONS);

    const health = await provider.checkHealth();

    expect(health.healthy).toBe(true);
    expect(health.provider).toBe('news.gdelt');
  });
});
