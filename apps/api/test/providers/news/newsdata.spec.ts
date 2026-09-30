import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProviderErrorCode } from '../../../src/providers/common/index.js';
import { NewsDataProvider } from '../../../src/providers/news/newsdata/newsdata.provider.js';
import { mapNewsDataSearchResponse } from '../../../src/providers/news/newsdata/newsdata.mapper.js';
import { jsonResponse, malformedJsonResponse, stubFetchSequence } from '../mock-fetch.js';
import { createTestProviderConfig, NO_RETRY_OPTIONS } from '../test-provider-config.js';

const RAW_ARTICLE = {
  title: 'Example headline',
  link: 'https://example.com/article',
  pubDate: '2026-01-15 12:00:00',
  source_id: 'example',
  language: 'english',
  country: ['united states'],
};

describe('NewsData.io mapper', () => {
  it('normalizes a raw article', () => {
    const article = mapNewsDataSearchResponse({ status: 'success', results: [RAW_ARTICLE] }).articles[0];
    expect(article).toEqual({
      title: 'Example headline',
      url: 'https://example.com/article',
      source: 'example',
      publishedAt: '2026-01-15 12:00:00',
      language: 'english',
      country: 'united states',
      sourceProvider: 'newsdata',
    });
  });

  it('drops a malformed article instead of failing the whole response', () => {
    expect(mapNewsDataSearchResponse({ status: 'success', results: [{ title: 'no link' }, RAW_ARTICLE] }).articles).toHaveLength(1);
  });

  it('normalizes an empty result list', () => {
    expect(mapNewsDataSearchResponse({ status: 'success', results: [] })).toEqual({ articles: [] });
  });

  it('throws PROVIDER_BAD_RESPONSE when "results" is missing', () => {
    expect(() => mapNewsDataSearchResponse({} as never)).toThrowError(
      expect.objectContaining({ code: ProviderErrorCode.PROVIDER_BAD_RESPONSE }),
    );
  });
});

describe('NewsDataProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is not configured without an API key', () => {
    expect(new NewsDataProvider(createTestProviderConfig(), NO_RETRY_OPTIONS).isConfigured).toBe(false);
  });

  it('is configured when an API key is present', () => {
    expect(new NewsDataProvider(createTestProviderConfig({ NEWSDATA_API_KEY: 'test-key' }), NO_RETRY_OPTIONS).isConfigured).toBe(true);
  });

  it('searches and returns normalized articles', async () => {
    stubFetchSequence([jsonResponse(200, { status: 'success', results: [RAW_ARTICLE] })]);
    const provider = new NewsDataProvider(createTestProviderConfig({ NEWSDATA_API_KEY: 'test-key' }), NO_RETRY_OPTIONS);

    const result = await provider.search({ query: 'inflation' });

    expect(result.articles).toHaveLength(1);
    expect(result.articles[0]?.sourceProvider).toBe('newsdata');
  });

  it('surfaces PROVIDER_RATE_LIMITED for a 429 response', async () => {
    stubFetchSequence([jsonResponse(429, {})]);
    const provider = new NewsDataProvider(createTestProviderConfig({ NEWSDATA_API_KEY: 'test-key' }), NO_RETRY_OPTIONS);

    await expect(provider.search({ query: 'x' })).rejects.toMatchObject({ code: ProviderErrorCode.PROVIDER_RATE_LIMITED });
  });

  it('maps a malformed response to PROVIDER_BAD_RESPONSE', async () => {
    stubFetchSequence([malformedJsonResponse()]);
    const provider = new NewsDataProvider(createTestProviderConfig({ NEWSDATA_API_KEY: 'test-key' }), NO_RETRY_OPTIONS);

    await expect(provider.search({ query: 'x' })).rejects.toMatchObject({ code: ProviderErrorCode.PROVIDER_BAD_RESPONSE });
  });

  it('reports health status from a probe request', async () => {
    stubFetchSequence([jsonResponse(200, { status: 'success', results: [] })]);
    const provider = new NewsDataProvider(createTestProviderConfig({ NEWSDATA_API_KEY: 'test-key' }), NO_RETRY_OPTIONS);

    const health = await provider.checkHealth();

    expect(health.healthy).toBe(true);
    expect(health.provider).toBe('news.newsdata');
  });
});
