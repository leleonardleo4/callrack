import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProviderErrorCode } from '../../../src/providers/common/index.js';
import { TheNewsApiProvider } from '../../../src/providers/news/thenewsapi/thenewsapi.provider.js';
import { mapTheNewsApiSearchResponse } from '../../../src/providers/news/thenewsapi/thenewsapi.mapper.js';
import { jsonResponse, malformedJsonResponse, stubFetchSequence } from '../mock-fetch.js';
import { createTestProviderConfig, NO_RETRY_OPTIONS } from '../test-provider-config.js';

const RAW_ARTICLE = {
  uuid: 'abc-123',
  title: 'Example headline',
  url: 'https://example.com/article',
  published_at: '2026-01-15T12:00:00.000000Z',
  language: 'en',
  source: 'example.com',
  locale: 'us',
};

describe('TheNewsAPI mapper', () => {
  it('normalizes a raw article', () => {
    const article = mapTheNewsApiSearchResponse({ meta: { found: 1 }, data: [RAW_ARTICLE] }).articles[0];
    expect(article).toEqual({
      title: 'Example headline',
      url: 'https://example.com/article',
      source: 'example.com',
      publishedAt: '2026-01-15T12:00:00.000000Z',
      language: 'en',
      country: 'us',
      sourceProvider: 'thenewsapi',
    });
  });

  it('drops a malformed article instead of failing the whole response', () => {
    expect(mapTheNewsApiSearchResponse({ data: [{ title: 'no url' }, RAW_ARTICLE] }).articles).toHaveLength(1);
  });

  it('normalizes an empty data list', () => {
    expect(mapTheNewsApiSearchResponse({ meta: { found: 0 }, data: [] })).toEqual({ articles: [] });
  });

  it('throws PROVIDER_BAD_RESPONSE when "data" is missing', () => {
    expect(() => mapTheNewsApiSearchResponse({} as never)).toThrowError(
      expect.objectContaining({ code: ProviderErrorCode.PROVIDER_BAD_RESPONSE }),
    );
  });
});

describe('TheNewsApiProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is not configured without an API token', () => {
    expect(new TheNewsApiProvider(createTestProviderConfig(), NO_RETRY_OPTIONS).isConfigured).toBe(false);
  });

  it('is configured when an API token is present', () => {
    expect(
      new TheNewsApiProvider(createTestProviderConfig({ THENEWSAPI_API_TOKEN: 'test-token' }), NO_RETRY_OPTIONS).isConfigured,
    ).toBe(true);
  });

  it('searches and returns normalized articles', async () => {
    stubFetchSequence([jsonResponse(200, { meta: { found: 1 }, data: [RAW_ARTICLE] })]);
    const provider = new TheNewsApiProvider(createTestProviderConfig({ THENEWSAPI_API_TOKEN: 'test-token' }), NO_RETRY_OPTIONS);

    const result = await provider.search({ query: 'inflation' });

    expect(result.articles).toHaveLength(1);
    expect(result.articles[0]?.sourceProvider).toBe('thenewsapi');
  });

  it('surfaces PROVIDER_RATE_LIMITED for a 429 response', async () => {
    stubFetchSequence([jsonResponse(429, {})]);
    const provider = new TheNewsApiProvider(createTestProviderConfig({ THENEWSAPI_API_TOKEN: 'test-token' }), NO_RETRY_OPTIONS);

    await expect(provider.search({ query: 'x' })).rejects.toMatchObject({ code: ProviderErrorCode.PROVIDER_RATE_LIMITED });
  });

  it('surfaces PROVIDER_INVALID_REQUEST for a 402 plan-usage-limit response', async () => {
    stubFetchSequence([jsonResponse(402, { error: { code: 'usage_limit_reached', message: 'Usage limit of your plan has been reached.' } })]);
    const provider = new TheNewsApiProvider(createTestProviderConfig({ THENEWSAPI_API_TOKEN: 'test-token' }), NO_RETRY_OPTIONS);

    await expect(provider.search({ query: 'x' })).rejects.toMatchObject({ code: ProviderErrorCode.PROVIDER_INVALID_REQUEST });
  });

  it('maps a malformed response to PROVIDER_BAD_RESPONSE', async () => {
    stubFetchSequence([malformedJsonResponse()]);
    const provider = new TheNewsApiProvider(createTestProviderConfig({ THENEWSAPI_API_TOKEN: 'test-token' }), NO_RETRY_OPTIONS);

    await expect(provider.search({ query: 'x' })).rejects.toMatchObject({ code: ProviderErrorCode.PROVIDER_BAD_RESPONSE });
  });

  it('reports health status from a probe request', async () => {
    stubFetchSequence([jsonResponse(200, { meta: { found: 0 }, data: [] })]);
    const provider = new TheNewsApiProvider(createTestProviderConfig({ THENEWSAPI_API_TOKEN: 'test-token' }), NO_RETRY_OPTIONS);

    const health = await provider.checkHealth();

    expect(health.healthy).toBe(true);
    expect(health.provider).toBe('news.thenewsapi');
  });
});
