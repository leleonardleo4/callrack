import { afterEach, describe, expect, it, vi } from 'vitest';
import { BadGatewayException, GatewayTimeoutException, NotFoundException } from '@nestjs/common';
import { AcademicService } from '../../src/academic/academic.service.js';
import { ProviderError, ProviderErrorCode } from '../../src/providers/common/index.js';
import type { AcademicProvider, AcademicSearchResult, AcademicWorkResult } from '../../src/providers/academic/academic.types.js';
import type { OpenAlexProvider } from '../../src/providers/academic/openalex/openalex.provider.js';
import type { CrossrefProvider } from '../../src/providers/academic/crossref/crossref.provider.js';
import type { CapabilityCacheService } from '../../src/common/cache/index.js';
import type { RequestTrackingService } from '../../src/common/tracking/index.js';

function fakeAcademicProvider(slug: string): AcademicProvider & {
  searchWorks: ReturnType<typeof vi.fn>;
  getWork: ReturnType<typeof vi.fn>;
} {
  return {
    metadata: { slug, name: slug, description: '', category: 'academic', website: '', attributionRequired: false },
    searchWorks: vi.fn(),
    getWork: vi.fn(),
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

function unavailableError(slug: string): ProviderError {
  return new ProviderError({ code: ProviderErrorCode.PROVIDER_UNAVAILABLE, message: 'down', providerSlug: slug });
}

const SEARCH_RESULT: AcademicSearchResult = {
  works: [
    {
      id: 'openalex:W1',
      title: 'A paper',
      authors: ['Jane Doe'],
      publicationYear: 2020,
      doi: '10.1/abc',
      sourceProvider: 'openalex',
    },
  ],
  totalCount: 1,
};

const CROSSREF_SEARCH_RESULT: AcademicSearchResult = {
  works: [{ id: 'crossref:10.1/abc', title: 'A paper', authors: [], sourceProvider: 'crossref' }],
};

const WORK_RESULT: AcademicWorkResult = {
  work: { id: 'openalex:W1', title: 'A paper', authors: [], sourceProvider: 'openalex' },
};

const CROSSREF_WORK_RESULT: AcademicWorkResult = {
  work: { id: 'crossref:10.1/abc', title: 'A paper', authors: [], sourceProvider: 'crossref' },
};

describe('AcademicService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('search', () => {
    it('uses OpenAlex when it succeeds, without calling Crossref', async () => {
      const openAlex = fakeAcademicProvider('academic.openalex');
      const crossref = fakeAcademicProvider('academic.crossref');
      openAlex.searchWorks.mockResolvedValue(SEARCH_RESULT);
      const tracking = fakeTracking();

      const service = new AcademicService(
        openAlex as unknown as OpenAlexProvider,
        crossref as unknown as CrossrefProvider,
        fakePassthroughCache(),
        tracking,
      );

      const result = await service.search({ query: 'x' }, 'req_1');

      expect(result.results).toHaveLength(1);
      expect(result.results[0]?.source).toBe('openalex');
      expect(crossref.searchWorks).not.toHaveBeenCalled();
      expect(tracking.record).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'SUCCESS', cacheHit: false, providerSlug: 'academic.openalex' }),
      );
    });

    it('falls back to Crossref when OpenAlex throws a provider error', async () => {
      const openAlex = fakeAcademicProvider('academic.openalex');
      const crossref = fakeAcademicProvider('academic.crossref');
      openAlex.searchWorks.mockRejectedValue(unavailableError('academic.openalex'));
      crossref.searchWorks.mockResolvedValue(CROSSREF_SEARCH_RESULT);

      const service = new AcademicService(
        openAlex as unknown as OpenAlexProvider,
        crossref as unknown as CrossrefProvider,
        fakePassthroughCache(),
        fakeTracking(),
      );

      const result = await service.search({ query: 'x' }, 'req_1');

      expect(result.results[0]?.source).toBe('crossref');
    });

    it('returns an empty result set without throwing', async () => {
      const openAlex = fakeAcademicProvider('academic.openalex');
      openAlex.searchWorks.mockResolvedValue({ works: [] });

      const service = new AcademicService(
        openAlex as unknown as OpenAlexProvider,
        fakeAcademicProvider('academic.crossref') as unknown as CrossrefProvider,
        fakePassthroughCache(),
        fakeTracking(),
      );

      const result = await service.search({ query: 'zzz' }, 'req_1');

      expect(result).toEqual({ results: [], meta: { count: 0 } });
    });

    it('maps a persistent PROVIDER_TIMEOUT to a 504 and records a TIMEOUT status', async () => {
      const openAlex = fakeAcademicProvider('academic.openalex');
      const crossref = fakeAcademicProvider('academic.crossref');
      const timeoutError = new ProviderError({
        code: ProviderErrorCode.PROVIDER_TIMEOUT,
        message: 'timed out',
        providerSlug: 'academic.openalex',
      });
      openAlex.searchWorks.mockRejectedValue(timeoutError);
      crossref.searchWorks.mockRejectedValue(timeoutError);
      const tracking = fakeTracking();

      const service = new AcademicService(
        openAlex as unknown as OpenAlexProvider,
        crossref as unknown as CrossrefProvider,
        fakePassthroughCache(),
        tracking,
      );

      await expect(service.search({ query: 'x' }, 'req_1')).rejects.toBeInstanceOf(GatewayTimeoutException);
      expect(tracking.record).toHaveBeenCalledWith(expect.objectContaining({ status: 'TIMEOUT' }));
    });

    it('maps rate limiting from both providers to a 429', async () => {
      const rateLimited = new ProviderError({
        code: ProviderErrorCode.PROVIDER_RATE_LIMITED,
        message: 'rate limited',
        providerSlug: 'academic.openalex',
      });
      const openAlex = fakeAcademicProvider('academic.openalex');
      const crossref = fakeAcademicProvider('academic.crossref');
      openAlex.searchWorks.mockRejectedValue(rateLimited);
      crossref.searchWorks.mockRejectedValue(rateLimited);

      const service = new AcademicService(
        openAlex as unknown as OpenAlexProvider,
        crossref as unknown as CrossrefProvider,
        fakePassthroughCache(),
        fakeTracking(),
      );

      await expect(service.search({ query: 'x' }, 'req_1')).rejects.toMatchObject({ status: 429 });
    });

    it('maps unavailable providers to a 502', async () => {
      const openAlex = fakeAcademicProvider('academic.openalex');
      const crossref = fakeAcademicProvider('academic.crossref');
      openAlex.searchWorks.mockRejectedValue(unavailableError('academic.openalex'));
      crossref.searchWorks.mockRejectedValue(unavailableError('academic.crossref'));

      const service = new AcademicService(
        openAlex as unknown as OpenAlexProvider,
        crossref as unknown as CrossrefProvider,
        fakePassthroughCache(),
        fakeTracking(),
      );

      await expect(service.search({ query: 'x' }, 'req_1')).rejects.toBeInstanceOf(BadGatewayException);
    });

    it('serves a second identical request from cache without calling the provider again', async () => {
      const openAlex = fakeAcademicProvider('academic.openalex');
      openAlex.searchWorks.mockResolvedValue(SEARCH_RESULT);
      const tracking = fakeTracking();
      const cache = fakePassthroughCache();

      const service = new AcademicService(
        openAlex as unknown as OpenAlexProvider,
        fakeAcademicProvider('academic.crossref') as unknown as CrossrefProvider,
        cache,
        tracking,
      );

      await service.search({ query: 'x' }, 'req_1');
      await service.search({ query: 'x' }, 'req_2');

      expect(openAlex.searchWorks).toHaveBeenCalledTimes(1);
      expect(tracking.record).toHaveBeenLastCalledWith(expect.objectContaining({ cacheHit: true, requestId: 'req_2' }));
    });
  });

  describe('getWork', () => {
    it('falls back to Crossref and preserves it as the source', async () => {
      const openAlex = fakeAcademicProvider('academic.openalex');
      const crossref = fakeAcademicProvider('academic.crossref');
      openAlex.getWork.mockRejectedValue(unavailableError('academic.openalex'));
      crossref.getWork.mockResolvedValue(CROSSREF_WORK_RESULT);

      const service = new AcademicService(
        openAlex as unknown as OpenAlexProvider,
        crossref as unknown as CrossrefProvider,
        fakePassthroughCache(),
        fakeTracking(),
      );

      const result = await service.getWork({ doi: '10.1/abc' }, 'req_1');

      expect(result.source).toBe('crossref');
    });

    it('returns a 404 when both providers report the work does not exist', async () => {
      const notFound = new ProviderError({
        code: ProviderErrorCode.PROVIDER_INVALID_REQUEST,
        message: 'not found upstream',
        providerSlug: 'academic.openalex',
      });
      const openAlex = fakeAcademicProvider('academic.openalex');
      const crossref = fakeAcademicProvider('academic.crossref');
      openAlex.getWork.mockRejectedValue(notFound);
      crossref.getWork.mockRejectedValue(notFound);

      const service = new AcademicService(
        openAlex as unknown as OpenAlexProvider,
        crossref as unknown as CrossrefProvider,
        fakePassthroughCache(),
        fakeTracking(),
      );

      await expect(service.getWork({ doi: '10.9999/missing' }, 'req_1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('serves a cached lookup without calling the provider again', async () => {
      const openAlex = fakeAcademicProvider('academic.openalex');
      openAlex.getWork.mockResolvedValue(WORK_RESULT);

      const service = new AcademicService(
        openAlex as unknown as OpenAlexProvider,
        fakeAcademicProvider('academic.crossref') as unknown as CrossrefProvider,
        fakePassthroughCache(),
        fakeTracking(),
      );

      await service.getWork({ doi: '10.1/abc' }, 'req_1');
      await service.getWork({ doi: '10.1/abc' }, 'req_2');

      expect(openAlex.getWork).toHaveBeenCalledTimes(1);
    });
  });
});
