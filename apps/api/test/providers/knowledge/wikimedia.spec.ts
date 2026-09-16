import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProviderErrorCode } from '../../../src/providers/common/index.js';
import { WikimediaProvider } from '../../../src/providers/knowledge/wikimedia/wikimedia.provider.js';
import { mapWikidataSearchResponse } from '../../../src/providers/knowledge/wikimedia/wikimedia.mapper.js';
import { jsonResponse, malformedJsonResponse, stubFetchSequence } from '../mock-fetch.js';
import { createTestProviderConfig, NO_RETRY_OPTIONS } from '../test-provider-config.js';

const RAW_ENTITY = { id: 'Q42', label: 'Douglas Adams', description: 'English writer', url: '//www.wikidata.org/wiki/Q42' };

describe('Wikidata mapper', () => {
  it('normalizes a raw entity and its protocol-relative URL', () => {
    const result = mapWikidataSearchResponse({ search: [RAW_ENTITY] });
    expect(result.entities[0]).toEqual({
      id: 'Q42',
      label: 'Douglas Adams',
      description: 'English writer',
      url: 'https://www.wikidata.org/wiki/Q42',
      sourceProvider: 'wikimedia',
    });
  });

  it('normalizes an empty search response', () => {
    expect(mapWikidataSearchResponse({ search: [] })).toEqual({ entities: [] });
  });

  it('throws PROVIDER_BAD_RESPONSE when "search" is missing', () => {
    expect(() => mapWikidataSearchResponse({} as never)).toThrowError(
      expect.objectContaining({ code: ProviderErrorCode.PROVIDER_BAD_RESPONSE }),
    );
  });
});

describe('WikimediaProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('searches and normalizes entities', async () => {
    stubFetchSequence([jsonResponse(200, { search: [RAW_ENTITY] })]);
    const provider = new WikimediaProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    const result = await provider.search({ query: 'Douglas Adams' });

    expect(result.entities).toHaveLength(1);
  });

  it('sends the configured User-Agent header', async () => {
    const fetchMock = stubFetchSequence([jsonResponse(200, { search: [] })]);
    const provider = new WikimediaProvider(
      createTestProviderConfig({ WIKIMEDIA_USER_AGENT: 'CallrackTest/1.0' }),
      NO_RETRY_OPTIONS,
    );

    await provider.search({ query: 'x' });

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = requestInit.headers as Record<string, string>;
    expect(headers['user-agent']).toBe('CallrackTest/1.0');
  });

  it('returns an empty result set for no matches', async () => {
    stubFetchSequence([jsonResponse(200, { search: [] })]);
    const provider = new WikimediaProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    expect(await provider.search({ query: 'zzz-no-matches' })).toEqual({ entities: [] });
  });

  it('maps a malformed response to a provider error', async () => {
    stubFetchSequence([malformedJsonResponse()]);
    const provider = new WikimediaProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    await expect(provider.search({ query: 'x' })).rejects.toMatchObject({
      code: ProviderErrorCode.PROVIDER_BAD_RESPONSE,
    });
  });

  it('surfaces PROVIDER_RATE_LIMITED for a 429 response', async () => {
    stubFetchSequence([jsonResponse(429, {})]);
    const provider = new WikimediaProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    await expect(provider.search({ query: 'x' })).rejects.toMatchObject({
      code: ProviderErrorCode.PROVIDER_RATE_LIMITED,
    });
  });

  it('surfaces a normalized error for an upstream 5xx failure', async () => {
    stubFetchSequence([jsonResponse(503, {})]);
    const provider = new WikimediaProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    await expect(provider.search({ query: 'x' })).rejects.toMatchObject({
      code: ProviderErrorCode.PROVIDER_UNAVAILABLE,
    });
  });

  it('reports health status from a probe request', async () => {
    stubFetchSequence([jsonResponse(200, { search: [] })]);
    const provider = new WikimediaProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    const health = await provider.checkHealth();

    expect(health.healthy).toBe(true);
    expect(health.provider).toBe('knowledge.wikimedia');
  });
});
