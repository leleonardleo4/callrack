import { afterEach, describe, expect, it, vi } from 'vitest';
import { BadGatewayException } from '@nestjs/common';
import { HolidaysService } from '../../src/holidays/holidays.service.js';
import { ProviderError, ProviderErrorCode } from '../../src/providers/common/index.js';
import type { HolidaysProvider } from '../../src/providers/holidays/holidays.types.js';
import type { NagerProvider } from '../../src/providers/holidays/nager/nager.provider.js';
import type { CapabilityCacheService } from '../../src/common/cache/index.js';
import type { RequestTrackingService } from '../../src/common/tracking/index.js';

function fakeNager(): HolidaysProvider & { getPublicHolidays: ReturnType<typeof vi.fn> } {
  return {
    metadata: { slug: 'holidays.nager', name: 'Nager.Date', description: '', category: 'holidays', website: '', attributionRequired: false },
    getPublicHolidays: vi.fn(),
    async checkHealth() {
      return { provider: 'holidays.nager', healthy: true };
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

const HOLIDAYS_RESULT = {
  holidays: [
    { date: '2026-10-01', name: 'National Day', localName: 'National Day', countryCode: 'NG', global: true, counties: null, types: ['Public'] },
  ],
};

describe('HolidaysService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns normalized holidays for a valid country/year', async () => {
    const nager = fakeNager();
    nager.getPublicHolidays.mockResolvedValue(HOLIDAYS_RESULT);
    const service = new HolidaysService(nager as unknown as NagerProvider, fakePassthroughCache(), fakeTracking());

    const result = await service.getHolidays({ country: 'NG', year: 2026 }, 'req_1');

    expect(result).toEqual({
      country: 'NG',
      year: 2026,
      holidays: [
        { date: '2026-10-01', name: 'National Day', localName: 'National Day', countryCode: 'NG', global: true, counties: null, types: ['Public'] },
      ],
    });
  });

  it('normalizes an empty provider response without treating it as an error', async () => {
    // Nager.Date itself 404s for a truly unrecognized country code (handled
    // below as a provider error) — this covers a recognized country/year
    // that genuinely has zero holidays on record.
    const nager = fakeNager();
    nager.getPublicHolidays.mockResolvedValue({ holidays: [] });
    const service = new HolidaysService(nager as unknown as NagerProvider, fakePassthroughCache(), fakeTracking());

    const result = await service.getHolidays({ country: 'NG', year: 2026 }, 'req_1');

    expect(result).toEqual({ country: 'NG', year: 2026, holidays: [] });
  });

  it('maps an unrecognized country code (Nager.Date 404) to a 400 INVALID_REQUEST', async () => {
    const nager = fakeNager();
    nager.getPublicHolidays.mockRejectedValue(
      new ProviderError({ code: ProviderErrorCode.PROVIDER_INVALID_REQUEST, message: 'not found', providerSlug: 'holidays.nager' }),
    );
    const service = new HolidaysService(nager as unknown as NagerProvider, fakePassthroughCache(), fakeTracking());

    await expect(service.getHolidays({ country: 'ZZ', year: 2026 }, 'req_1')).rejects.toMatchObject({ status: 400 });
  });

  it('maps a persistent provider failure to a 502', async () => {
    const nager = fakeNager();
    nager.getPublicHolidays.mockRejectedValue(
      new ProviderError({ code: ProviderErrorCode.PROVIDER_UNAVAILABLE, message: 'down', providerSlug: 'holidays.nager' }),
    );
    const service = new HolidaysService(nager as unknown as NagerProvider, fakePassthroughCache(), fakeTracking());

    await expect(service.getHolidays({ country: 'NG', year: 2026 }, 'req_1')).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('is a cache miss then a cache hit for an identical request', async () => {
    const nager = fakeNager();
    nager.getPublicHolidays.mockResolvedValue(HOLIDAYS_RESULT);
    const tracking = fakeTracking();
    const service = new HolidaysService(nager as unknown as NagerProvider, fakePassthroughCache(), tracking);

    await service.getHolidays({ country: 'NG', year: 2026 }, 'req_1');
    await service.getHolidays({ country: 'NG', year: 2026 }, 'req_2');

    expect(nager.getPublicHolidays).toHaveBeenCalledTimes(1);
    expect(tracking.record).toHaveBeenNthCalledWith(1, expect.objectContaining({ cacheHit: false }));
    expect(tracking.record).toHaveBeenNthCalledWith(2, expect.objectContaining({ cacheHit: true }));
  });

  it('does not collide cache entries for a different country or year', async () => {
    const nager = fakeNager();
    nager.getPublicHolidays.mockResolvedValue(HOLIDAYS_RESULT);
    const service = new HolidaysService(nager as unknown as NagerProvider, fakePassthroughCache(), fakeTracking());

    await service.getHolidays({ country: 'NG', year: 2026 }, 'req_1');
    await service.getHolidays({ country: 'DE', year: 2026 }, 'req_2');
    await service.getHolidays({ country: 'NG', year: 2027 }, 'req_3');

    expect(nager.getPublicHolidays).toHaveBeenCalledTimes(3);
  });
});
