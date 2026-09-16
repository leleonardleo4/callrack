import { afterEach, describe, expect, it, vi } from 'vitest';
import { BadGatewayException, GatewayTimeoutException } from '@nestjs/common';
import { CryptoService } from '../../src/crypto/crypto.service.js';
import { ProviderError, ProviderErrorCode } from '../../src/providers/common/index.js';
import type { CryptoMarketDataResult, CryptoProvider } from '../../src/providers/crypto/crypto.types.js';
import type { CoinGeckoProvider } from '../../src/providers/crypto/coingecko/coingecko.provider.js';
import type { CapabilityCacheService } from '../../src/common/cache/index.js';
import type { RequestTrackingService } from '../../src/common/tracking/index.js';

function fakeCoinGecko(): CryptoProvider & { getMarketData: ReturnType<typeof vi.fn>; getPrices: ReturnType<typeof vi.fn> } {
  return {
    metadata: { slug: 'crypto.coingecko', name: 'CoinGecko', description: '', category: 'crypto', website: '', attributionRequired: true },
    getMarketData: vi.fn(),
    getPrices: vi.fn(),
    async checkHealth() {
      return { provider: 'crypto.coingecko', healthy: true };
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

const MARKET_RESULT: CryptoMarketDataResult = {
  markets: [
    { asset: { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', sourceProvider: 'coingecko' }, vsCurrency: 'usd', price: 100, changePercent24h: 1.5 },
    { asset: { id: 'ethereum', symbol: 'eth', name: 'Ethereum', sourceProvider: 'coingecko' }, vsCurrency: 'usd', price: 50, changePercent24h: -0.5 },
  ],
};

describe('CryptoService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getPrices', () => {
    it('returns normalized prices for valid assets', async () => {
      const coinGecko = fakeCoinGecko();
      coinGecko.getMarketData.mockResolvedValue(MARKET_RESULT);
      const service = new CryptoService(coinGecko as unknown as CoinGeckoProvider, fakePassthroughCache(), fakeTracking());

      const result = await service.getPrices({ assets: ['bitcoin', 'ethereum'] }, 'req_1');

      expect(result.assets).toHaveLength(2);
      expect(result.missing).toEqual([]);
    });

    it('normalizes (dedupes and sorts) assets before calling the provider', async () => {
      const coinGecko = fakeCoinGecko();
      coinGecko.getMarketData.mockResolvedValue(MARKET_RESULT);
      const service = new CryptoService(coinGecko as unknown as CoinGeckoProvider, fakePassthroughCache(), fakeTracking());

      await service.getPrices({ assets: ['ethereum', 'bitcoin', 'bitcoin'] }, 'req_1');

      expect(coinGecko.getMarketData).toHaveBeenCalledWith({ assetIds: ['bitcoin', 'ethereum'], vsCurrency: 'usd' });
    });

    it('defaults currency to usd', async () => {
      const coinGecko = fakeCoinGecko();
      coinGecko.getMarketData.mockResolvedValue({ markets: [] });
      const service = new CryptoService(coinGecko as unknown as CoinGeckoProvider, fakePassthroughCache(), fakeTracking());

      await service.getPrices({ assets: ['bitcoin'] }, 'req_1');

      expect(coinGecko.getMarketData).toHaveBeenCalledWith({ assetIds: ['bitcoin'], vsCurrency: 'usd' });
    });

    it('reports missing assets without discarding the valid ones', async () => {
      const coinGecko = fakeCoinGecko();
      coinGecko.getMarketData.mockResolvedValue(MARKET_RESULT);
      const service = new CryptoService(coinGecko as unknown as CoinGeckoProvider, fakePassthroughCache(), fakeTracking());

      const result = await service.getPrices({ assets: ['bitcoin', 'zzz-unknown'] }, 'req_1');

      expect(result.assets).toHaveLength(2); // provider fixture always returns both bitcoin+ethereum
      expect(result.missing).toEqual(['zzz-unknown']);
    });

    it('returns an empty asset list without throwing when nothing matches', async () => {
      const coinGecko = fakeCoinGecko();
      coinGecko.getMarketData.mockResolvedValue({ markets: [] });
      const service = new CryptoService(coinGecko as unknown as CoinGeckoProvider, fakePassthroughCache(), fakeTracking());

      const result = await service.getPrices({ assets: ['zzz-unknown'] }, 'req_1');

      expect(result).toEqual({ assets: [], missing: ['zzz-unknown'] });
    });

    it('maps a persistent PROVIDER_TIMEOUT to a 504 and records a TIMEOUT status', async () => {
      const coinGecko = fakeCoinGecko();
      const timeoutError = new ProviderError({ code: ProviderErrorCode.PROVIDER_TIMEOUT, message: 'timed out', providerSlug: 'crypto.coingecko' });
      coinGecko.getMarketData.mockRejectedValue(timeoutError);
      const tracking = fakeTracking();
      const service = new CryptoService(coinGecko as unknown as CoinGeckoProvider, fakePassthroughCache(), tracking);

      await expect(service.getPrices({ assets: ['bitcoin'] }, 'req_1')).rejects.toBeInstanceOf(GatewayTimeoutException);
      expect(tracking.record).toHaveBeenCalledWith(expect.objectContaining({ status: 'TIMEOUT' }));
    });

    it('maps a rate-limited provider to a 429', async () => {
      const coinGecko = fakeCoinGecko();
      coinGecko.getMarketData.mockRejectedValue(
        new ProviderError({ code: ProviderErrorCode.PROVIDER_RATE_LIMITED, message: 'rate limited', providerSlug: 'crypto.coingecko' }),
      );
      const service = new CryptoService(coinGecko as unknown as CoinGeckoProvider, fakePassthroughCache(), fakeTracking());

      await expect(service.getPrices({ assets: ['bitcoin'] }, 'req_1')).rejects.toMatchObject({ status: 429 });
    });

    it('maps an unavailable provider to a 502', async () => {
      const coinGecko = fakeCoinGecko();
      coinGecko.getMarketData.mockRejectedValue(
        new ProviderError({ code: ProviderErrorCode.PROVIDER_UNAVAILABLE, message: 'down', providerSlug: 'crypto.coingecko' }),
      );
      const service = new CryptoService(coinGecko as unknown as CoinGeckoProvider, fakePassthroughCache(), fakeTracking());

      await expect(service.getPrices({ assets: ['bitcoin'] }, 'req_1')).rejects.toBeInstanceOf(BadGatewayException);
    });

    it('is a cache miss on the first call and a cache hit on the second identical call', async () => {
      const coinGecko = fakeCoinGecko();
      coinGecko.getMarketData.mockResolvedValue(MARKET_RESULT);
      const tracking = fakeTracking();
      const service = new CryptoService(coinGecko as unknown as CoinGeckoProvider, fakePassthroughCache(), tracking);

      await service.getPrices({ assets: ['bitcoin'] }, 'req_1');
      await service.getPrices({ assets: ['bitcoin'] }, 'req_2');

      expect(coinGecko.getMarketData).toHaveBeenCalledTimes(1);
      expect(tracking.record).toHaveBeenNthCalledWith(1, expect.objectContaining({ cacheHit: false }));
      expect(tracking.record).toHaveBeenNthCalledWith(2, expect.objectContaining({ cacheHit: true }));
    });

    it('does not collide cache entries across different currencies or asset sets', async () => {
      const coinGecko = fakeCoinGecko();
      coinGecko.getMarketData.mockResolvedValue(MARKET_RESULT);
      const service = new CryptoService(coinGecko as unknown as CoinGeckoProvider, fakePassthroughCache(), fakeTracking());

      await service.getPrices({ assets: ['bitcoin'], currency: 'usd' }, 'req_1');
      await service.getPrices({ assets: ['bitcoin'], currency: 'eur' }, 'req_2');
      await service.getPrices({ assets: ['ethereum'], currency: 'usd' }, 'req_3');

      expect(coinGecko.getMarketData).toHaveBeenCalledTimes(3);
    });

    it('shares a cache entry for the same assets requested in a different order', async () => {
      const coinGecko = fakeCoinGecko();
      coinGecko.getMarketData.mockResolvedValue(MARKET_RESULT);
      const service = new CryptoService(coinGecko as unknown as CoinGeckoProvider, fakePassthroughCache(), fakeTracking());

      await service.getPrices({ assets: ['bitcoin', 'ethereum'] }, 'req_1');
      await service.getPrices({ assets: ['ethereum', 'bitcoin'] }, 'req_2');

      expect(coinGecko.getMarketData).toHaveBeenCalledTimes(1);
    });
  });

  describe('getMarketData', () => {
    it('returns normalized market entries', async () => {
      const coinGecko = fakeCoinGecko();
      coinGecko.getMarketData.mockResolvedValue(MARKET_RESULT);
      const service = new CryptoService(coinGecko as unknown as CoinGeckoProvider, fakePassthroughCache(), fakeTracking());

      const result = await service.getMarketData({ assets: ['bitcoin'] }, 'req_1');

      expect(result.markets[0]).toMatchObject({ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin' });
    });

    it('maps a provider failure to a 502', async () => {
      const coinGecko = fakeCoinGecko();
      coinGecko.getMarketData.mockRejectedValue(
        new ProviderError({ code: ProviderErrorCode.PROVIDER_UNAVAILABLE, message: 'down', providerSlug: 'crypto.coingecko' }),
      );
      const service = new CryptoService(coinGecko as unknown as CoinGeckoProvider, fakePassthroughCache(), fakeTracking());

      await expect(service.getMarketData({ assets: ['bitcoin'] }, 'req_1')).rejects.toBeInstanceOf(BadGatewayException);
    });

    it('uses a separate cache namespace from crypto price (no cross-capability collisions)', async () => {
      const coinGecko = fakeCoinGecko();
      coinGecko.getMarketData.mockResolvedValue(MARKET_RESULT);
      const service = new CryptoService(coinGecko as unknown as CoinGeckoProvider, fakePassthroughCache(), fakeTracking());

      await service.getPrices({ assets: ['bitcoin'] }, 'req_1');
      await service.getMarketData({ assets: ['bitcoin'] }, 'req_2');

      expect(coinGecko.getMarketData).toHaveBeenCalledTimes(2);
    });

    it('serves a second identical request from cache', async () => {
      const coinGecko = fakeCoinGecko();
      coinGecko.getMarketData.mockResolvedValue(MARKET_RESULT);
      const service = new CryptoService(coinGecko as unknown as CoinGeckoProvider, fakePassthroughCache(), fakeTracking());

      await service.getMarketData({ assets: ['bitcoin'] }, 'req_1');
      await service.getMarketData({ assets: ['bitcoin'] }, 'req_2');

      expect(coinGecko.getMarketData).toHaveBeenCalledTimes(1);
    });
  });
});
