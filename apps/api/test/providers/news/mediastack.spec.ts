import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProviderErrorCode } from '../../../src/providers/common/index.js';
import { MediastackProvider } from '../../../src/providers/news/mediastack/mediastack.provider.js';
import { mapMediastackSearchResponse } from '../../../src/providers/news/mediastack/mediastack.mapper.js';
import { jsonResponse, malformedJsonResponse, stubFetchSequence } from '../mock-fetch.js';
import { createTestProviderConfig, NO_RETRY_OPTIONS } from '../test-provider-config.js';

const RAW_ARTICLE = {
  title: 'Example headline',
  url: 'https://example.com/article',
  source: 'Example',
  published_at: '2026-01-15T12:00:00+00:00',
  language: 'en',
  country: 'us',
};

describe('Mediastack mapper', () => {
  it('normalizes a raw article', () => {
    const article = mapMediastackSearchResponse({ data: [RAW_ARTICLE] }).articles[0];
    expect(article).toEqual({
      title: 'Example headline',
      url: 'https://example.com/article',
      source: 'Example',
      publishedAt: '2026-01-15T12:00:00+00:00',
      language: 'en',
      country: 'us',
      sourceProvider: 'mediastack',
    });
  });

  it('drops a malformed article instead of failing the whole response', () => {
    expect(mapMediastackSearchResponse({ data: [{ title: 'no url' }, RAW_ARTICLE] }).articles).toHaveLength(1);
  });

  it('normalizes an empty data list', () => {
    expect(mapMediastackSearchResponse({ data: [] })).toEqual({ articles: [] });
  });

  it('throws PROVIDER_BAD_RESPONSE when "data" is missing', () => {
    expect(() => mapMediastackSearchResponse({} as never)).toThrowError(
      expect.objectContaining({ code: ProviderErrorCode.PROVIDER_BAD_RESPONSE }),
    );
  });
});

describe('MediastackProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is not configured without an API key', () => {
    expect(new MediastackProvider(createTestProviderConfig(), NO_RETRY_OPTIONS).isConfigured).toBe(false);
  });

  it('is configured when an API key is present', () => {
    expect(new MediastackProvider(createTestProviderConfig({ MEDIASTACK_API_KEY: 'test-key' }), NO_RETRY_OPTIONS).isConfigured).toBe(
      true,
    );
  });

  it('searches and returns normalized articles', async () => {
    stubFetchSequence([jsonResponse(200, { data: [RAW_ARTICLE] })]);
    const provider = new MediastackProvider(createTestProviderConfig({ MEDIASTACK_API_KEY: 'test-key' }), NO_RETRY_OPTIONS);

    const result = await provider.search({ query: 'inflation' });

    expect(result.articles).toHaveLength(1);
    expect(result.articles[0]?.sourceProvider).toBe('mediastack');
  });

  it('surfaces PROVIDER_RATE_LIMITED for a 429 response', async () => {
    stubFetchSequence([jsonResponse(429, {})]);
    const provider = new MediastackProvider(createTestProviderConfig({ MEDIASTACK_API_KEY: 'test-key' }), NO_RETRY_OPTIONS);

    await expect(provider.search({ query: 'x' })).rejects.toMatchObject({ code: ProviderErrorCode.PROVIDER_RATE_LIMITED });
  });

  it('maps a malformed response to PROVIDER_BAD_RESPONSE', async () => {
    stubFetchSequence([malformedJsonResponse()]);
    const provider = new MediastackProvider(createTestProviderConfig({ MEDIASTACK_API_KEY: 'test-key' }), NO_RETRY_OPTIONS);

    await expect(provider.search({ query: 'x' })).rejects.toMatchObject({ code: ProviderErrorCode.PROVIDER_BAD_RESPONSE });
  });

  it('reports health status from a probe request', async () => {
    stubFetchSequence([jsonResponse(200, { data: [] })]);
    const provider = new MediastackProvider(createTestProviderConfig({ MEDIASTACK_API_KEY: 'test-key' }), NO_RETRY_OPTIONS);

    const health = await provider.checkHealth();

    expect(health.healthy).toBe(true);
    expect(health.provider).toBe('news.mediastack');
  });
});
