import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProviderErrorCode } from '../../../src/providers/common/index.js';
import { GNewsProvider } from '../../../src/providers/news/gnews/gnews.provider.js';
import { mapGNewsSearchResponse } from '../../../src/providers/news/gnews/gnews.mapper.js';
import { jsonResponse, malformedJsonResponse, stubFetchSequence } from '../mock-fetch.js';
import { createTestProviderConfig, NO_RETRY_OPTIONS } from '../test-provider-config.js';

const RAW_ARTICLE = {
  title: 'Example headline',
  url: 'https://example.com/article',
  publishedAt: '2026-01-15T12:00:00Z',
  source: { name: 'Example', url: 'https://example.com', country: 'us' },
};

describe('GNews mapper', () => {
  it('normalizes a raw article', () => {
    const article = mapGNewsSearchResponse({ totalArticles: 1, articles: [RAW_ARTICLE] }).articles[0];
    expect(article).toEqual({
      title: 'Example headline',
      url: 'https://example.com/article',
      source: 'Example',
      publishedAt: '2026-01-15T12:00:00Z',
      language: undefined,
      country: 'us',
      sourceProvider: 'gnews',
    });
  });

  it('falls back to the requested language when the article carries none', () => {
    const article = mapGNewsSearchResponse({ articles: [RAW_ARTICLE] }, 'en').articles[0];
    expect(article?.language).toBe('en');
  });

  it('drops a malformed article instead of failing the whole response', () => {
    expect(mapGNewsSearchResponse({ articles: [{ title: 'no url' }, RAW_ARTICLE] }).articles).toHaveLength(1);
  });

  it('normalizes an empty article list', () => {
    expect(mapGNewsSearchResponse({ totalArticles: 0, articles: [] })).toEqual({ articles: [] });
  });

  it('throws PROVIDER_BAD_RESPONSE when "articles" is missing', () => {
    expect(() => mapGNewsSearchResponse({} as never)).toThrowError(
      expect.objectContaining({ code: ProviderErrorCode.PROVIDER_BAD_RESPONSE }),
    );
  });
});

describe('GNewsProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is not configured without an API key', () => {
    expect(new GNewsProvider(createTestProviderConfig(), NO_RETRY_OPTIONS).isConfigured).toBe(false);
  });

  it('is configured when an API key is present', () => {
    expect(new GNewsProvider(createTestProviderConfig({ GNEWS_API_KEY: 'test-key' }), NO_RETRY_OPTIONS).isConfigured).toBe(true);
  });

  it('searches and returns normalized articles', async () => {
    stubFetchSequence([jsonResponse(200, { totalArticles: 1, articles: [RAW_ARTICLE] })]);
    const provider = new GNewsProvider(createTestProviderConfig({ GNEWS_API_KEY: 'test-key' }), NO_RETRY_OPTIONS);

    const result = await provider.search({ query: 'inflation' });

    expect(result.articles).toHaveLength(1);
    expect(result.articles[0]?.sourceProvider).toBe('gnews');
  });

  it('surfaces PROVIDER_RATE_LIMITED for a 429 response', async () => {
    stubFetchSequence([jsonResponse(429, { errors: ['Too Many Requests.'] })]);
    const provider = new GNewsProvider(createTestProviderConfig({ GNEWS_API_KEY: 'test-key' }), NO_RETRY_OPTIONS);

    await expect(provider.search({ query: 'x' })).rejects.toMatchObject({ code: ProviderErrorCode.PROVIDER_RATE_LIMITED });
  });

  it('surfaces PROVIDER_AUTHENTICATION_FAILED for a 403 quota/subscription response', async () => {
    stubFetchSequence([jsonResponse(403, { errors: ['You have made too many requests recently.'] })]);
    const provider = new GNewsProvider(createTestProviderConfig({ GNEWS_API_KEY: 'test-key' }), NO_RETRY_OPTIONS);

    await expect(provider.search({ query: 'x' })).rejects.toMatchObject({ code: ProviderErrorCode.PROVIDER_AUTHENTICATION_FAILED });
  });

  it('maps a malformed response to PROVIDER_BAD_RESPONSE', async () => {
    stubFetchSequence([malformedJsonResponse()]);
    const provider = new GNewsProvider(createTestProviderConfig({ GNEWS_API_KEY: 'test-key' }), NO_RETRY_OPTIONS);

    await expect(provider.search({ query: 'x' })).rejects.toMatchObject({ code: ProviderErrorCode.PROVIDER_BAD_RESPONSE });
  });

  it('reports health status from a probe request', async () => {
    stubFetchSequence([jsonResponse(200, { totalArticles: 0, articles: [] })]);
    const provider = new GNewsProvider(createTestProviderConfig({ GNEWS_API_KEY: 'test-key' }), NO_RETRY_OPTIONS);

    const health = await provider.checkHealth();

    expect(health.healthy).toBe(true);
    expect(health.provider).toBe('news.gnews');
  });
});
