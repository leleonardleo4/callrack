import { afterEach, describe, expect, it, vi } from 'vitest';
import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { FxService } from '../../src/fx/fx.service.js';
import { ProviderError, ProviderErrorCode } from '../../src/providers/common/index.js';
import type { FxProvider, FxRates } from '../../src/providers/fx/fx.types.js';
import type { FrankfurterProvider } from '../../src/providers/fx/frankfurter/frankfurter.provider.js';
import type { CapabilityCacheService } from '../../src/common/cache/index.js';
import type { RequestTrackingService } from '../../src/common/tracking/index.js';

function fakeFrankfurter(): FxProvider & {
  getCurrentRates: ReturnType<typeof vi.fn>;
  getHistoricalRates: ReturnType<typeof vi.fn>;
} {
  return {
    metadata: { slug: 'fx.frankfurter', name: 'Frankfurter', description: '', category: 'fx', website: '', attributionRequired: true },
    getCurrentRates: vi.fn(),
    getHistoricalRates: vi.fn(),
    async convert() {
      throw new Error('not used');
    },
    async checkHealth() {
      return { provider: 'fx.frankfurter', healthy: true };
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

const CURRENT_RATES: FxRates = { base: 'USD', date: '2026-09-16', rates: { EUR: 0.85, GBP: 0.74, NGN: 1530.22 } };
const HISTORICAL_RATES: FxRates = { base: 'USD', date: '2026-09-15', rates: { EUR: 0.86 } };

describe('FxService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns normalized current rates', async () => {
    const frankfurter = fakeFrankfurter();
    frankfurter.getCurrentRates.mockResolvedValue(CURRENT_RATES);
    const service = new FxService(frankfurter as unknown as FrankfurterProvider, fakePassthroughCache(), fakeTracking());

    const result = await service.getRates({ base: 'USD', currencies: ['EUR', 'GBP'] }, 'req_1');

    expect(result).toEqual({ base: 'USD', date: '2026-09-16', rates: { EUR: 0.85, GBP: 0.74 } });
    expect(frankfurter.getHistoricalRates).not.toHaveBeenCalled();
  });

  it('requests historical rates when a date is provided', async () => {
    const frankfurter = fakeFrankfurter();
    frankfurter.getHistoricalRates.mockResolvedValue(HISTORICAL_RATES);
    const service = new FxService(frankfurter as unknown as FrankfurterProvider, fakePassthroughCache(), fakeTracking());

    const result = await service.getRates({ base: 'USD', currencies: ['EUR'], date: '2026-09-15' }, 'req_1');

    expect(result).toEqual({ base: 'USD', date: '2026-09-15', rates: { EUR: 0.86 } });
    expect(frankfurter.getHistoricalRates).toHaveBeenCalledWith({ base: 'USD', symbols: ['EUR'], date: '2026-09-15' });
    expect(frankfurter.getCurrentRates).not.toHaveBeenCalled();
  });

  it('injects a self-rate of 1 when the base currency is explicitly requested', async () => {
    const frankfurter = fakeFrankfurter();
    frankfurter.getCurrentRates.mockResolvedValue(CURRENT_RATES);
    const service = new FxService(frankfurter as unknown as FrankfurterProvider, fakePassthroughCache(), fakeTracking());

    const result = await service.getRates({ base: 'USD', currencies: ['USD', 'EUR'] }, 'req_1');

    expect(result.rates).toEqual({ USD: 1, EUR: 0.85 });
    expect(frankfurter.getCurrentRates).toHaveBeenCalledWith({ base: 'USD', symbols: ['EUR'] });
  });

  it('never calls the provider when the base currency is the only one requested', async () => {
    const frankfurter = fakeFrankfurter();
    const service = new FxService(frankfurter as unknown as FrankfurterProvider, fakePassthroughCache(), fakeTracking());

    const result = await service.getRates({ base: 'USD', currencies: ['USD'] }, 'req_1');

    expect(result.rates).toEqual({ USD: 1 });
    expect(frankfurter.getCurrentRates).not.toHaveBeenCalled();
  });

  it('returns a 400 INVALID_REQUEST when a requested currency is unsupported', async () => {
    const frankfurter = fakeFrankfurter();
    frankfurter.getCurrentRates.mockResolvedValue(CURRENT_RATES);
    const service = new FxService(frankfurter as unknown as FrankfurterProvider, fakePassthroughCache(), fakeTracking());

    await expect(service.getRates({ base: 'USD', currencies: ['ZZZ'] }, 'req_1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps a provider failure to a 502', async () => {
    const frankfurter = fakeFrankfurter();
    frankfurter.getCurrentRates.mockRejectedValue(
      new ProviderError({ code: ProviderErrorCode.PROVIDER_UNAVAILABLE, message: 'down', providerSlug: 'fx.frankfurter' }),
    );
    const service = new FxService(frankfurter as unknown as FrankfurterProvider, fakePassthroughCache(), fakeTracking());

    await expect(service.getRates({ base: 'USD', currencies: ['EUR'] }, 'req_1')).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('is a cache miss then a cache hit for identical requests', async () => {
    const frankfurter = fakeFrankfurter();
    frankfurter.getCurrentRates.mockResolvedValue(CURRENT_RATES);
    const tracking = fakeTracking();
    const service = new FxService(frankfurter as unknown as FrankfurterProvider, fakePassthroughCache(), tracking);

    await service.getRates({ base: 'USD', currencies: ['EUR'] }, 'req_1');
    await service.getRates({ base: 'USD', currencies: ['EUR'] }, 'req_2');

    expect(frankfurter.getCurrentRates).toHaveBeenCalledTimes(1);
    expect(tracking.record).toHaveBeenNthCalledWith(1, expect.objectContaining({ cacheHit: false }));
    expect(tracking.record).toHaveBeenNthCalledWith(2, expect.objectContaining({ cacheHit: true }));
  });

  it('shares a cache entry regardless of requested currency order', async () => {
    const frankfurter = fakeFrankfurter();
    frankfurter.getCurrentRates.mockResolvedValue(CURRENT_RATES);
    const service = new FxService(frankfurter as unknown as FrankfurterProvider, fakePassthroughCache(), fakeTracking());

    await service.getRates({ base: 'USD', currencies: ['EUR', 'GBP'] }, 'req_1');
    await service.getRates({ base: 'USD', currencies: ['GBP', 'EUR'] }, 'req_2');

    expect(frankfurter.getCurrentRates).toHaveBeenCalledTimes(1);
  });

  it('does not collide cache entries for a swapped base/currency pair', async () => {
    const frankfurter = fakeFrankfurter();
    frankfurter.getCurrentRates.mockImplementation(
      async ({ base, symbols }: { base: string; symbols: string[] }) => ({
        base,
        date: '2026-09-16',
        rates: Object.fromEntries(symbols.map((code) => [code, 1.1])),
      }),
    );
    const service = new FxService(frankfurter as unknown as FrankfurterProvider, fakePassthroughCache(), fakeTracking());

    await service.getRates({ base: 'USD', currencies: ['EUR'] }, 'req_1');
    await service.getRates({ base: 'EUR', currencies: ['USD'] }, 'req_2');

    expect(frankfurter.getCurrentRates).toHaveBeenCalledTimes(2);
  });

  it('does not collide cache entries between current and historical rates for the same pair', async () => {
    const frankfurter = fakeFrankfurter();
    frankfurter.getCurrentRates.mockResolvedValue(CURRENT_RATES);
    frankfurter.getHistoricalRates.mockResolvedValue(HISTORICAL_RATES);
    const service = new FxService(frankfurter as unknown as FrankfurterProvider, fakePassthroughCache(), fakeTracking());

    await service.getRates({ base: 'USD', currencies: ['EUR'] }, 'req_1');
    await service.getRates({ base: 'USD', currencies: ['EUR'], date: '2026-09-15' }, 'req_2');

    expect(frankfurter.getCurrentRates).toHaveBeenCalledTimes(1);
    expect(frankfurter.getHistoricalRates).toHaveBeenCalledTimes(1);
  });
});
