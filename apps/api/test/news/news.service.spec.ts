import { afterEach, describe, expect, it, vi } from 'vitest';
import { BadGatewayException } from '@nestjs/common';
import { NewsService } from '../../src/news/news.service.js';
import { ProviderCooldownService, ProviderError, ProviderErrorCode } from '../../src/providers/common/index.js';
import type { NewsSearchProvider, NewsSearchResult, NewsTrendsResult } from '../../src/providers/news/news.types.js';
import type { GdeltProvider } from '../../src/providers/news/gdelt/gdelt.provider.js';
import type { CurrentsProvider } from '../../src/providers/news/currents/currents.provider.js';
import type { NewsDataProvider } from '../../src/providers/news/newsdata/newsdata.provider.js';
import type { TheNewsApiProvider } from '../../src/providers/news/thenewsapi/thenewsapi.provider.js';
import type { GNewsProvider } from '../../src/providers/news/gnews/gnews.provider.js';
import type { MediastackProvider } from '../../src/providers/news/mediastack/mediastack.provider.js';
import type { CapabilityCacheService } from '../../src/common/cache/index.js';
import type { RequestTrackingService } from '../../src/common/tracking/index.js';

function fakeNewsProvider(
  slug: string,
  opts: { isConfigured?: boolean; attributionText?: string } = {},
): NewsSearchProvider & { search: ReturnType<typeof vi.fn>; getTrends: ReturnType<typeof vi.fn> } {
  return {
    metadata: {
      slug,
      name: slug,
      description: '',
      category: 'news',
      website: '',
      attributionRequired: opts.attributionText !== undefined,
      attributionText: opts.attributionText,
    },
    isConfigured: opts.isConfigured ?? true,
    search: vi.fn(),
    getTrends: vi.fn(),
    async checkHealth() {
      return { provider: slug, healthy: true };
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

function fakeCooldown(): ProviderCooldownService {
  return {
    isCoolingDown: vi.fn().mockResolvedValue(false),
    markFailure: vi.fn().mockResolvedValue(undefined),
  } as unknown as ProviderCooldownService;
}

function unavailableError(slug: string): ProviderError {
  return new ProviderError({ code: ProviderErrorCode.PROVIDER_UNAVAILABLE, message: 'down', providerSlug: slug });
}

const EMPTY_RESULT: NewsSearchResult = { articles: [] };

function resultWith(title: string): NewsSearchResult {
  return {
    articles: [
      { title, url: `https://example.com/${title}`, source: 'example.com', sourceProvider: 'x' },
    ],
  };
}

const TRENDS_RESULT: NewsTrendsResult = {
  term: 'renewable energy',
  points: [{ date: '20230101', volume: 12.3 }],
};

function buildService(providers: {
  gdelt: ReturnType<typeof fakeNewsProvider>;
  currents?: ReturnType<typeof fakeNewsProvider>;
  newsData?: ReturnType<typeof fakeNewsProvider>;
  theNewsApi?: ReturnType<typeof fakeNewsProvider>;
  gNews?: ReturnType<typeof fakeNewsProvider>;
  mediastack?: ReturnType<typeof fakeNewsProvider>;
  cache?: CapabilityCacheService;
  tracking?: RequestTrackingService & { record: ReturnType<typeof vi.fn> };
  cooldown?: ProviderCooldownService;
}) {
  const tracking = providers.tracking ?? fakeTracking();
  const cooldown = providers.cooldown ?? fakeCooldown();
  const cache = providers.cache ?? fakePassthroughCache();
  return {
    tracking,
    cooldown,
    cache,
    service: new NewsService(
      providers.gdelt as unknown as GdeltProvider,
      (providers.currents ?? fakeNewsProvider('news.currents', { isConfigured: false })) as unknown as CurrentsProvider,
      (providers.newsData ?? fakeNewsProvider('news.newsdata', { isConfigured: false })) as unknown as NewsDataProvider,
      (providers.theNewsApi ?? fakeNewsProvider('news.thenewsapi', { isConfigured: false })) as unknown as TheNewsApiProvider,
      (providers.gNews ?? fakeNewsProvider('news.gnews', { isConfigured: false })) as unknown as GNewsProvider,
      (providers.mediastack ?? fakeNewsProvider('news.mediastack', { isConfigured: false })) as unknown as MediastackProvider,
      cache,
      tracking,
      cooldown,
    ),
  };
}

describe('NewsService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('search', () => {
    it('uses GDELT when it succeeds, without calling any fallback provider', async () => {
      const gdelt = fakeNewsProvider('news.gdelt', { attributionText: 'GDELT attribution' });
      gdelt.search.mockResolvedValue(resultWith('a'));
      const currents = fakeNewsProvider('news.currents');

      const { service, tracking } = buildService({ gdelt, currents });
      const outcome = await service.search({ query: 'x' }, 'req_1');

      expect(outcome.data.results).toHaveLength(1);
      expect(outcome.providerSlug).toBe('news.gdelt');
      expect(outcome.attribution).toBe('GDELT attribution');
      expect(currents.search).not.toHaveBeenCalled();
      expect(tracking.record).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'SUCCESS', cacheHit: false, providerSlug: 'news.gdelt' }),
      );
    });

    it('excludes an unconfigured provider from the chain entirely', async () => {
      const gdelt = fakeNewsProvider('news.gdelt');
      gdelt.search.mockRejectedValue(unavailableError('news.gdelt'));
      const currents = fakeNewsProvider('news.currents', { isConfigured: false });
      const newsData = fakeNewsProvider('news.newsdata');
      newsData.search.mockResolvedValue(resultWith('b'));

      const { service } = buildService({ gdelt, currents, newsData });
      const outcome = await service.search({ query: 'x' }, 'req_1');

      expect(currents.search).not.toHaveBeenCalled();
      expect(outcome.providerSlug).toBe('news.newsdata');
    });

    it('falls back to the next configured provider when the primary throws a provider error', async () => {
      const gdelt = fakeNewsProvider('news.gdelt');
      gdelt.search.mockRejectedValue(unavailableError('news.gdelt'));
      const currents = fakeNewsProvider('news.currents', { attributionText: 'Currents attribution' });
      currents.search.mockResolvedValue(resultWith('fallback'));

      const { service, cooldown } = buildService({ gdelt, currents });
      const outcome = await service.search({ query: 'x' }, 'req_1');

      expect(outcome.data.results[0]?.title).toBe('fallback');
      expect(outcome.providerSlug).toBe('news.currents');
      expect(outcome.attribution).toBe('Currents attribution');
      expect(cooldown.markFailure).toHaveBeenCalledWith('news.gdelt', expect.any(ProviderError));
    });

    it('falls through to the next provider when a provider returns an empty result', async () => {
      const gdelt = fakeNewsProvider('news.gdelt');
      gdelt.search.mockResolvedValue(EMPTY_RESULT);
      const currents = fakeNewsProvider('news.currents');
      currents.search.mockResolvedValue(resultWith('has-results'));

      const { service } = buildService({ gdelt, currents });
      const outcome = await service.search({ query: 'x' }, 'req_1');

      expect(outcome.providerSlug).toBe('news.currents');
      expect(outcome.data.results).toHaveLength(1);
    });

    it('returns an empty result from the last provider when every configured provider is empty', async () => {
      const gdelt = fakeNewsProvider('news.gdelt');
      gdelt.search.mockResolvedValue(EMPTY_RESULT);
      const currents = fakeNewsProvider('news.currents');
      currents.search.mockResolvedValue(EMPTY_RESULT);

      const { service } = buildService({ gdelt, currents });
      const outcome = await service.search({ query: 'zzz' }, 'req_1');

      expect(outcome.data.results).toEqual([]);
      expect(outcome.providerSlug).toBe('news.currents');
    });

    it('maps a failure from every configured provider to a 502', async () => {
      const gdelt = fakeNewsProvider('news.gdelt');
      gdelt.search.mockRejectedValue(unavailableError('news.gdelt'));
      const currents = fakeNewsProvider('news.currents');
      currents.search.mockRejectedValue(unavailableError('news.currents'));

      const { service } = buildService({ gdelt, currents });

      await expect(service.search({ query: 'x' }, 'req_1')).rejects.toBeInstanceOf(BadGatewayException);
    });

    it('serves a second identical request from cache, preserving the originating provider slug', async () => {
      const gdelt = fakeNewsProvider('news.gdelt');
      gdelt.search.mockRejectedValue(unavailableError('news.gdelt'));
      const currents = fakeNewsProvider('news.currents');
      currents.search.mockResolvedValue(resultWith('fallback'));
      const tracking = fakeTracking();

      const { service } = buildService({ gdelt, currents, tracking });

      await service.search({ query: 'x' }, 'req_1');
      const second = await service.search({ query: 'x' }, 'req_2');

      expect(currents.search).toHaveBeenCalledTimes(1);
      expect(second.providerSlug).toBe('news.currents');
      expect(tracking.record).toHaveBeenLastCalledWith(
        expect.objectContaining({ cacheHit: true, requestId: 'req_2', providerSlug: undefined }),
      );
    });
  });

  describe('getTrends', () => {
    it('returns GDELT results with no fallback', async () => {
      const gdelt = fakeNewsProvider('news.gdelt', { attributionText: 'GDELT attribution' });
      gdelt.getTrends.mockResolvedValue(TRENDS_RESULT);

      const { service } = buildService({ gdelt });
      const outcome = await service.getTrends({ query: 'renewable energy' }, 'req_1');

      expect(outcome.data.points).toHaveLength(1);
      expect(outcome.providerSlug).toBe('news.gdelt');
      expect(outcome.attribution).toBe('GDELT attribution');
    });

    it('maps a GDELT failure to a 502 without attempting any other provider', async () => {
      const gdelt = fakeNewsProvider('news.gdelt');
      gdelt.getTrends.mockRejectedValue(unavailableError('news.gdelt'));
      const currents = fakeNewsProvider('news.currents');

      const { service } = buildService({ gdelt, currents });

      await expect(service.getTrends({ query: 'x' }, 'req_1')).rejects.toBeInstanceOf(BadGatewayException);
      expect(currents.getTrends).not.toHaveBeenCalled();
    });
  });
});
