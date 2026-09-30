import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProviderErrorCode } from '../../../src/providers/common/index.js';
import { CurrentsProvider } from '../../../src/providers/news/currents/currents.provider.js';
import { mapCurrentsSearchResponse } from '../../../src/providers/news/currents/currents.mapper.js';
import { jsonResponse, malformedJsonResponse, stubFetchSequence } from '../mock-fetch.js';
import { createTestProviderConfig, NO_RETRY_OPTIONS } from '../test-provider-config.js';

const RAW_ARTICLE = {
  title: 'Example headline',
  url: 'https://example.com/article',
  published: '2026-01-15T12:00:00Z',
  language: 'English',
};

describe('Currents mapper', () => {
  it('normalizes a raw article, deriving source from the URL', () => {
    const article = mapCurrentsSearchResponse({ status: 'ok', news: [RAW_ARTICLE] }).articles[0];
    expect(article).toEqual({
      title: 'Example headline',
      url: 'https://example.com/article',
      source: 'example.com',
      publishedAt: '2026-01-15T12:00:00Z',
      language: 'English',
      country: undefined,
      sourceProvider: 'currents',
    });
  });

  it('drops a malformed article instead of failing the whole response', () => {
    expect(mapCurrentsSearchResponse({ status: 'ok', news: [{ title: 'no url' }, RAW_ARTICLE] }).articles).toHaveLength(1);
  });

  it('normalizes an empty article list', () => {
    expect(mapCurrentsSearchResponse({ status: 'ok', news: [] })).toEqual({ articles: [] });
  });

  it('throws PROVIDER_BAD_RESPONSE when "news" is missing', () => {
    expect(() => mapCurrentsSearchResponse({} as never)).toThrowError(
      expect.objectContaining({ code: ProviderErrorCode.PROVIDER_BAD_RESPONSE }),
    );
  });
});

describe('CurrentsProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is not configured without an API key', () => {
    const provider = new CurrentsProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);
    expect(provider.isConfigured).toBe(false);
  });

  it('is configured when an API key is present', () => {
    const provider = new CurrentsProvider(createTestProviderConfig({ CURRENTS_API_KEY: 'test-key' }), NO_RETRY_OPTIONS);
    expect(provider.isConfigured).toBe(true);
  });

  it('searches and returns normalized articles', async () => {
    stubFetchSequence([jsonResponse(200, { status: 'ok', news: [RAW_ARTICLE] })]);
    const provider = new CurrentsProvider(createTestProviderConfig({ CURRENTS_API_KEY: 'test-key' }), NO_RETRY_OPTIONS);

    const result = await provider.search({ query: 'inflation' });

    expect(result.articles).toHaveLength(1);
    expect(result.articles[0]?.sourceProvider).toBe('currents');
  });

  it('maps a malformed response to PROVIDER_BAD_RESPONSE', async () => {
    stubFetchSequence([malformedJsonResponse()]);
    const provider = new CurrentsProvider(createTestProviderConfig({ CURRENTS_API_KEY: 'test-key' }), NO_RETRY_OPTIONS);

    await expect(provider.search({ query: 'x' })).rejects.toMatchObject({ code: ProviderErrorCode.PROVIDER_BAD_RESPONSE });
  });

  it('surfaces PROVIDER_RATE_LIMITED for a 429 response', async () => {
    stubFetchSequence([jsonResponse(429, {})]);
    const provider = new CurrentsProvider(createTestProviderConfig({ CURRENTS_API_KEY: 'test-key' }), NO_RETRY_OPTIONS);

    await expect(provider.search({ query: 'x' })).rejects.toMatchObject({ code: ProviderErrorCode.PROVIDER_RATE_LIMITED });
  });

  it('reports health status from a probe request', async () => {
    stubFetchSequence([jsonResponse(200, { status: 'ok', news: [] })]);
    const provider = new CurrentsProvider(createTestProviderConfig({ CURRENTS_API_KEY: 'test-key' }), NO_RETRY_OPTIONS);

    const health = await provider.checkHealth();

    expect(health.healthy).toBe(true);
    expect(health.provider).toBe('news.currents');
  });
});
