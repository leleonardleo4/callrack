import { afterEach, describe, expect, it, vi } from 'vitest';
import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { CensusService } from '../../src/government/census.service.js';
import { ProviderError, ProviderErrorCode } from '../../src/providers/common/index.js';
import type { GovernmentDatasetResult, GovernmentProvider } from '../../src/providers/government/government.types.js';
import type { CensusProvider } from '../../src/providers/government/census/census.provider.js';
import type { CapabilityCacheService } from '../../src/common/cache/index.js';
import type { RequestTrackingService } from '../../src/common/tracking/index.js';

function fakeCensus(): GovernmentProvider & { query: ReturnType<typeof vi.fn> } {
  return {
    metadata: { slug: 'government.census', name: 'US Census Bureau', description: '', category: 'government', website: '', attributionRequired: true },
    query: vi.fn(),
    async checkHealth() {
      return { provider: 'government.census', healthy: true };
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

const RESULT: GovernmentDatasetResult = {
  dataset: 'acs/acs1',
  columns: ['NAME', 'B01001_001E'],
  rows: [{ NAME: 'California', B01001_001E: '39029342' }],
};

describe('CensusService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a normalized result for a valid query', async () => {
    const census = fakeCensus();
    census.query.mockResolvedValue(RESULT);
    const service = new CensusService(census as unknown as CensusProvider, fakePassthroughCache(), fakeTracking());

    const result = await service.query(
      { dataset: 'acs/acs1', year: 2021, variables: ['NAME', 'B01001_001E'], forGeography: 'state:*' },
      'req_1',
    );

    expect(result).toEqual({
      dataset: 'acs/acs1',
      year: 2021,
      columns: ['NAME', 'B01001_001E'],
      rows: [{ NAME: 'California', B01001_001E: '39029342' }],
    });
  });

  it('dedupes and sorts variables before calling the provider', async () => {
    const census = fakeCensus();
    census.query.mockResolvedValue(RESULT);
    const service = new CensusService(census as unknown as CensusProvider, fakePassthroughCache(), fakeTracking());

    await service.query(
      { dataset: 'acs/acs1', year: 2021, variables: ['B01001_001E', 'NAME', 'NAME'], forGeography: 'state:*' },
      'req_1',
    );

    expect(census.query).toHaveBeenCalledWith({
      dataset: 'acs/acs1',
      year: '2021',
      variables: ['B01001_001E', 'NAME'],
      forGeography: 'state:*',
    });
  });

  it('returns an empty rows array without treating it as an error', async () => {
    const census = fakeCensus();
    census.query.mockResolvedValue({ dataset: 'acs/acs1', columns: ['NAME'], rows: [] });
    const service = new CensusService(census as unknown as CensusProvider, fakePassthroughCache(), fakeTracking());

    const result = await service.query({ dataset: 'acs/acs1', year: 2021, variables: ['NAME'], forGeography: 'state:99' }, 'req_1');

    expect(result.rows).toEqual([]);
  });

  it('maps an unrecognized/invalid query (provider 4xx) to a 400 INVALID_REQUEST', async () => {
    const census = fakeCensus();
    census.query.mockRejectedValue(
      new ProviderError({ code: ProviderErrorCode.PROVIDER_INVALID_REQUEST, message: 'bad request', providerSlug: 'government.census' }),
    );
    const service = new CensusService(census as unknown as CensusProvider, fakePassthroughCache(), fakeTracking());

    await expect(
      service.query({ dataset: 'acs/acs1', year: 2021, variables: ['NAME'], forGeography: 'state:*' }, 'req_1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps a persistent provider failure to a 502', async () => {
    const census = fakeCensus();
    census.query.mockRejectedValue(
      new ProviderError({ code: ProviderErrorCode.PROVIDER_UNAVAILABLE, message: 'down', providerSlug: 'government.census' }),
    );
    const service = new CensusService(census as unknown as CensusProvider, fakePassthroughCache(), fakeTracking());

    await expect(
      service.query({ dataset: 'acs/acs1', year: 2021, variables: ['NAME'], forGeography: 'state:*' }, 'req_1'),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('is a cache miss then a cache hit for an identical request', async () => {
    const census = fakeCensus();
    census.query.mockResolvedValue(RESULT);
    const tracking = fakeTracking();
    const service = new CensusService(census as unknown as CensusProvider, fakePassthroughCache(), tracking);

    const input = { dataset: 'acs/acs1' as const, year: 2021, variables: ['NAME', 'B01001_001E'], forGeography: 'state:*' };
    await service.query(input, 'req_1');
    await service.query(input, 'req_2');

    expect(census.query).toHaveBeenCalledTimes(1);
    expect(tracking.record).toHaveBeenNthCalledWith(1, expect.objectContaining({ cacheHit: false }));
    expect(tracking.record).toHaveBeenNthCalledWith(2, expect.objectContaining({ cacheHit: true }));
  });

  it('shares a cache entry regardless of requested variable order', async () => {
    const census = fakeCensus();
    census.query.mockResolvedValue(RESULT);
    const service = new CensusService(census as unknown as CensusProvider, fakePassthroughCache(), fakeTracking());

    await service.query({ dataset: 'acs/acs1', year: 2021, variables: ['NAME', 'B01001_001E'], forGeography: 'state:*' }, 'req_1');
    await service.query({ dataset: 'acs/acs1', year: 2021, variables: ['B01001_001E', 'NAME'], forGeography: 'state:*' }, 'req_2');

    expect(census.query).toHaveBeenCalledTimes(1);
  });

  it('does not collide cache entries for a different dataset, year, or geography', async () => {
    const census = fakeCensus();
    census.query.mockResolvedValue(RESULT);
    const service = new CensusService(census as unknown as CensusProvider, fakePassthroughCache(), fakeTracking());

    await service.query({ dataset: 'acs/acs1', year: 2021, variables: ['NAME'], forGeography: 'state:*' }, 'req_1');
    await service.query({ dataset: 'acs/acs5', year: 2021, variables: ['NAME'], forGeography: 'state:*' }, 'req_2');
    await service.query({ dataset: 'acs/acs1', year: 2020, variables: ['NAME'], forGeography: 'state:*' }, 'req_3');
    await service.query({ dataset: 'acs/acs1', year: 2021, variables: ['NAME'], forGeography: 'state:06' }, 'req_4');

    expect(census.query).toHaveBeenCalledTimes(4);
  });
});
