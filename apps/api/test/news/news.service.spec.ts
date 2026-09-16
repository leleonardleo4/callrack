import { afterEach, describe, expect, it, vi } from 'vitest';
import { BadGatewayException } from '@nestjs/common';
import { NewsService } from '../../src/news/news.service.js';
import { ProviderError, ProviderErrorCode } from '../../src/providers/common/index.js';
import type { NewsProvider, NewsSearchResult, NewsTrendsResult } from '../../src/providers/news/news.types.js';
import type { GdeltProvider } from '../../src/providers/news/gdelt/gdelt.provider.js';
import type { CapabilityCacheService } from '../../src/common/cache/index.js';
import type { RequestTrackingService } from '../../src/common/tracking/index.js';

function fakeGdelt(): NewsProvider & { search: ReturnType<typeof vi.fn>; getTrends: ReturnType<typeof vi.fn> } {
  return {
    metadata: {
      slug: 'news.gdelt',
      name: 'GDELT',
      description: '',
      category: 'news',
      website: '',
      attributionRequired: true,
      attributionText: 'News data provided by the GDELT Project (gdeltproject.org)',
    },
    search: vi.fn(),
    getTrends: vi.fn(),
    async checkHealth() {
      return { provider: 'news.gdelt', healthy: true };
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

const SEARCH_RESULT: NewsSearchResult = {
  articles: [
    {
      title: 'Example headline',
      url: 'https://example.com/a',
      source: 'example.com',
      publishedAt: '2023-01-01T00:00:00Z',
      language: 'English',
      country: 'United States',
      sourceProvider: 'gdelt',
    },
  ],
};

const TRENDS_RESULT: NewsTrendsResult = {
  term: 'renewable energy',
  points: [{ date: '20230101', volume: 12.3 }],
};

describe('NewsService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes GDELT attribution text', () => {
    const service = new NewsService(fakeGdelt() as unknown as GdeltProvider, fakePassthroughCache(), fakeTracking());
    expect(service.getAttribution()).toContain('GDELT');
  });

  describe('search', () => {
    it('returns normalized results for a valid search', async () => {
      const gdelt = fakeGdelt();
      gdelt.search.mockResolvedValue(SEARCH_RESULT);

      const service = new NewsService(gdelt as unknown as GdeltProvider, fakePassthroughCache(), fakeTracking());
      const result = await service.search({ query: 'renewable energy Africa' }, 'req_1');

      expect(result.results).toHaveLength(1);
      expect(result.results[0]?.title).toBe('Example headline');
    });

    it('returns an empty result set without throwing', async () => {
      const gdelt = fakeGdelt();
      gdelt.search.mockResolvedValue({ articles: [] });

      const service = new NewsService(gdelt as unknown as GdeltProvider, fakePassthroughCache(), fakeTracking());
      const result = await service.search({ query: 'zzz' }, 'req_1');

      expect(result).toEqual({ results: [] });
    });

    it('maps a provider failure to a 502', async () => {
      const gdelt = fakeGdelt();
      gdelt.search.mockRejectedValue(
        new ProviderError({ code: ProviderErrorCode.PROVIDER_UNAVAILABLE, message: 'down', providerSlug: 'news.gdelt' }),
      );

      const service = new NewsService(gdelt as unknown as GdeltProvider, fakePassthroughCache(), fakeTracking());

      await expect(service.search({ query: 'x' }, 'req_1')).rejects.toBeInstanceOf(BadGatewayException);
    });

    it('serves a second identical request from cache without calling the provider again', async () => {
      const gdelt = fakeGdelt();
      gdelt.search.mockResolvedValue(SEARCH_RESULT);
      const tracking = fakeTracking();

      const service = new NewsService(gdelt as unknown as GdeltProvider, fakePassthroughCache(), tracking);

      await service.search({ query: 'x' }, 'req_1');
      await service.search({ query: 'x' }, 'req_2');

      expect(gdelt.search).toHaveBeenCalledTimes(1);
      expect(tracking.record).toHaveBeenLastCalledWith(expect.objectContaining({ cacheHit: true }));
    });
  });

  describe('getTrends', () => {
    it('returns normalized trend points for a valid request', async () => {
      const gdelt = fakeGdelt();
      gdelt.getTrends.mockResolvedValue(TRENDS_RESULT);

      const service = new NewsService(gdelt as unknown as GdeltProvider, fakePassthroughCache(), fakeTracking());
      const result = await service.getTrends({ query: 'renewable energy' }, 'req_1');

      expect(result.points).toHaveLength(1);
    });

    it('returns an empty points array without throwing', async () => {
      const gdelt = fakeGdelt();
      gdelt.getTrends.mockResolvedValue({ term: 'x', points: [] });

      const service = new NewsService(gdelt as unknown as GdeltProvider, fakePassthroughCache(), fakeTracking());
      const result = await service.getTrends({ query: 'x' }, 'req_1');

      expect(result.points).toEqual([]);
    });

    it('maps a provider failure to a 502', async () => {
      const gdelt = fakeGdelt();
      gdelt.getTrends.mockRejectedValue(
        new ProviderError({ code: ProviderErrorCode.PROVIDER_UNAVAILABLE, message: 'down', providerSlug: 'news.gdelt' }),
      );

      const service = new NewsService(gdelt as unknown as GdeltProvider, fakePassthroughCache(), fakeTracking());

      await expect(service.getTrends({ query: 'x' }, 'req_1')).rejects.toBeInstanceOf(BadGatewayException);
    });

    it('serves a second identical request from cache without calling the provider again', async () => {
      const gdelt = fakeGdelt();
      gdelt.getTrends.mockResolvedValue(TRENDS_RESULT);

      const service = new NewsService(gdelt as unknown as GdeltProvider, fakePassthroughCache(), fakeTracking());

      await service.getTrends({ query: 'renewable energy' }, 'req_1');
      await service.getTrends({ query: 'renewable energy' }, 'req_2');

      expect(gdelt.getTrends).toHaveBeenCalledTimes(1);
    });
  });
});
