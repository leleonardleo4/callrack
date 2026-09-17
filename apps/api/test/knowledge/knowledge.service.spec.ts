import { afterEach, describe, expect, it, vi } from 'vitest';
import { BadGatewayException, GatewayTimeoutException } from '@nestjs/common';
import { KnowledgeService } from '../../src/knowledge/knowledge.service.js';
import { ProviderError, ProviderErrorCode } from '../../src/providers/common/index.js';
import type { KnowledgeProvider, KnowledgeSearchResult } from '../../src/providers/knowledge/knowledge.types.js';
import type { WikimediaProvider } from '../../src/providers/knowledge/wikimedia/wikimedia.provider.js';
import type { CapabilityCacheService } from '../../src/common/cache/index.js';
import type { RequestTrackingService } from '../../src/common/tracking/index.js';

function fakeWikimedia(): KnowledgeProvider & { search: ReturnType<typeof vi.fn> } {
  return {
    metadata: {
      slug: 'knowledge.wikimedia',
      name: 'Wikidata',
      description: '',
      category: 'knowledge',
      website: '',
      attributionRequired: true,
      attributionText: 'Data from Wikidata, available under CC0',
    },
    search: vi.fn(),
    async checkHealth() {
      return { provider: 'knowledge.wikimedia', healthy: true };
    },
  };
}

function fakePassthroughCache(): CapabilityCacheService {
  const store = new Map<string, unknown>();
  return {
    async getOrSet<T>(key: string, _ttl: number, loader: () => Promise<T>) {
      if (store.has(key)) {
        return { value: store.get(key) as T, cacheHit: true };
      }
      const value = await loader();
      store.set(key, value);
      return { value, cacheHit: false };
    },
  } as unknown as CapabilityCacheService;
}

function fakeTracking(): RequestTrackingService & { record: ReturnType<typeof vi.fn> } {
  return { record: vi.fn() } as unknown as RequestTrackingService & { record: ReturnType<typeof vi.fn> };
}

const SEARCH_RESULT: KnowledgeSearchResult = {
  entities: [{ id: 'Q8673', label: 'Lagos', description: 'city in Nigeria', url: 'https://www.wikidata.org/wiki/Q8673', sourceProvider: 'wikimedia' }],
};

describe('KnowledgeService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes Wikidata attribution text', () => {
    const service = new KnowledgeService(fakeWikimedia() as unknown as WikimediaProvider, fakePassthroughCache(), fakeTracking());
    expect(service.getAttribution()).toContain('Wikidata');
  });

  it('returns normalized results for a valid search', async () => {
    const wikimedia = fakeWikimedia();
    wikimedia.search.mockResolvedValue(SEARCH_RESULT);
    const service = new KnowledgeService(wikimedia as unknown as WikimediaProvider, fakePassthroughCache(), fakeTracking());

    const result = await service.search({ query: 'Lagos' }, 'req_1');

    expect(result.results[0]).toMatchObject({ id: 'Q8673', name: 'Lagos' });
  });

  it('defaults limit and language, and passes explicit ones through', async () => {
    const wikimedia = fakeWikimedia();
    wikimedia.search.mockResolvedValue({ entities: [] });
    const service = new KnowledgeService(wikimedia as unknown as WikimediaProvider, fakePassthroughCache(), fakeTracking());

    await service.search({ query: 'x' }, 'req_1');
    expect(wikimedia.search).toHaveBeenCalledWith({ query: 'x', limit: 10, language: 'en' });

    await service.search({ query: 'y', limit: 5, language: 'fr' }, 'req_2');
    expect(wikimedia.search).toHaveBeenCalledWith({ query: 'y', limit: 5, language: 'fr' });
  });

  it('returns an empty result set without throwing', async () => {
    const wikimedia = fakeWikimedia();
    wikimedia.search.mockResolvedValue({ entities: [] });
    const service = new KnowledgeService(wikimedia as unknown as WikimediaProvider, fakePassthroughCache(), fakeTracking());

    expect(await service.search({ query: 'zzz-no-matches' }, 'req_1')).toEqual({ results: [] });
  });

  it('maps a persistent PROVIDER_TIMEOUT to a 504 and records a TIMEOUT status', async () => {
    const wikimedia = fakeWikimedia();
    wikimedia.search.mockRejectedValue(
      new ProviderError({ code: ProviderErrorCode.PROVIDER_TIMEOUT, message: 'timed out', providerSlug: 'knowledge.wikimedia' }),
    );
    const tracking = fakeTracking();
    const service = new KnowledgeService(wikimedia as unknown as WikimediaProvider, fakePassthroughCache(), tracking);

    await expect(service.search({ query: 'x' }, 'req_1')).rejects.toBeInstanceOf(GatewayTimeoutException);
    expect(tracking.record).toHaveBeenCalledWith(expect.objectContaining({ status: 'TIMEOUT' }));
  });

  it('maps rate limiting to a 429', async () => {
    const wikimedia = fakeWikimedia();
    wikimedia.search.mockRejectedValue(
      new ProviderError({ code: ProviderErrorCode.PROVIDER_RATE_LIMITED, message: 'rate limited', providerSlug: 'knowledge.wikimedia' }),
    );
    const service = new KnowledgeService(wikimedia as unknown as WikimediaProvider, fakePassthroughCache(), fakeTracking());

    await expect(service.search({ query: 'x' }, 'req_1')).rejects.toMatchObject({ status: 429 });
  });

  it('maps an unavailable provider to a 502', async () => {
    const wikimedia = fakeWikimedia();
    wikimedia.search.mockRejectedValue(
      new ProviderError({ code: ProviderErrorCode.PROVIDER_UNAVAILABLE, message: 'down', providerSlug: 'knowledge.wikimedia' }),
    );
    const service = new KnowledgeService(wikimedia as unknown as WikimediaProvider, fakePassthroughCache(), fakeTracking());

    await expect(service.search({ query: 'x' }, 'req_1')).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('is a cache miss then a cache hit for an identical request', async () => {
    const wikimedia = fakeWikimedia();
    wikimedia.search.mockResolvedValue(SEARCH_RESULT);
    const tracking = fakeTracking();
    const service = new KnowledgeService(wikimedia as unknown as WikimediaProvider, fakePassthroughCache(), tracking);

    await service.search({ query: 'Lagos' }, 'req_1');
    await service.search({ query: 'Lagos' }, 'req_2');

    expect(wikimedia.search).toHaveBeenCalledTimes(1);
    expect(tracking.record).toHaveBeenNthCalledWith(1, expect.objectContaining({ cacheHit: false }));
    expect(tracking.record).toHaveBeenNthCalledWith(2, expect.objectContaining({ cacheHit: true }));
  });

  it('does not collide cache entries for different limit or language', async () => {
    const wikimedia = fakeWikimedia();
    wikimedia.search.mockResolvedValue(SEARCH_RESULT);
    const service = new KnowledgeService(wikimedia as unknown as WikimediaProvider, fakePassthroughCache(), fakeTracking());

    await service.search({ query: 'Lagos' }, 'req_1');
    await service.search({ query: 'Lagos', limit: 5 }, 'req_2');
    await service.search({ query: 'Lagos', language: 'fr' }, 'req_3');

    expect(wikimedia.search).toHaveBeenCalledTimes(3);
  });
});
