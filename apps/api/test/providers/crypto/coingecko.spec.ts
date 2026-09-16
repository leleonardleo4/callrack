import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProviderErrorCode } from '../../../src/providers/common/index.js';
import { CoinGeckoProvider } from '../../../src/providers/crypto/coingecko/coingecko.provider.js';
import { mapCoinGeckoMarkets, mapCoinGeckoPrices } from '../../../src/providers/crypto/coingecko/coingecko.mapper.js';
import { jsonResponse, malformedJsonResponse, stubFetchSequence } from '../mock-fetch.js';
import { createTestProviderConfig, NO_RETRY_OPTIONS } from '../test-provider-config.js';

describe('CoinGecko mapper', () => {
  it('normalizes a simple price response', () => {
    const result = mapCoinGeckoPrices({ bitcoin: { usd: 43000 } }, 'usd');
    expect(result).toEqual({ vsCurrency: 'usd', prices: { bitcoin: 43000 } });
  });

  it('normalizes an empty price response', () => {
    expect(mapCoinGeckoPrices({}, 'usd')).toEqual({ vsCurrency: 'usd', prices: {} });
  });

  it('throws PROVIDER_BAD_RESPONSE for a non-object price response', () => {
    expect(() => mapCoinGeckoPrices([] as never, 'usd')).toThrowError(
      expect.objectContaining({ code: ProviderErrorCode.PROVIDER_BAD_RESPONSE }),
    );
  });

  it('normalizes a markets response', () => {
    const result = mapCoinGeckoMarkets(
      [{ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', current_price: 43000, market_cap: 1, total_volume: 2, price_change_percentage_24h: 1.5 }],
      'usd',
    );
    expect(result.markets).toEqual([
      {
        asset: { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', sourceProvider: 'coingecko' },
        vsCurrency: 'usd',
        price: 43000,
        marketCap: 1,
        volume24h: 2,
        changePercent24h: 1.5,
      },
    ]);
  });

  it('normalizes an empty markets response', () => {
    expect(mapCoinGeckoMarkets([], 'usd')).toEqual({ markets: [] });
  });

  it('throws PROVIDER_BAD_RESPONSE for a malformed market entry', () => {
    expect(() => mapCoinGeckoMarkets([{} as never], 'usd')).toThrowError(
      expect.objectContaining({ code: ProviderErrorCode.PROVIDER_BAD_RESPONSE }),
    );
  });
});

describe('CoinGeckoProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches and normalizes prices', async () => {
    stubFetchSequence([jsonResponse(200, { bitcoin: { usd: 43000 } })]);
    const provider = new CoinGeckoProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    const result = await provider.getPrices({ assetIds: ['bitcoin'] });

    expect(result).toEqual({ vsCurrency: 'usd', prices: { bitcoin: 43000 } });
  });

  it('returns empty prices when no assets match', async () => {
    stubFetchSequence([jsonResponse(200, {})]);
    const provider = new CoinGeckoProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    expect(await provider.getPrices({ assetIds: ['nonexistent'] })).toEqual({ vsCurrency: 'usd', prices: {} });
  });

  it('maps a malformed response to a provider error', async () => {
    stubFetchSequence([malformedJsonResponse()]);
    const provider = new CoinGeckoProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    await expect(provider.getPrices({ assetIds: ['bitcoin'] })).rejects.toMatchObject({
      code: ProviderErrorCode.PROVIDER_BAD_RESPONSE,
    });
  });

  it('surfaces PROVIDER_RATE_LIMITED for a 429 response', async () => {
    stubFetchSequence([jsonResponse(429, {})]);
    const provider = new CoinGeckoProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    await expect(provider.getMarketData({ assetIds: ['bitcoin'] })).rejects.toMatchObject({
      code: ProviderErrorCode.PROVIDER_RATE_LIMITED,
    });
  });

  it('surfaces a normalized error for an upstream 5xx failure', async () => {
    stubFetchSequence([jsonResponse(503, {})]);
    const provider = new CoinGeckoProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    await expect(provider.getMarketData({ assetIds: ['bitcoin'] })).rejects.toMatchObject({
      code: ProviderErrorCode.PROVIDER_UNAVAILABLE,
    });
  });

  it('reports health status from a probe request', async () => {
    stubFetchSequence([jsonResponse(200, { gecko_says: '(V3) To the Moon!' })]);
    const provider = new CoinGeckoProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    const health = await provider.checkHealth();

    expect(health.healthy).toBe(true);
    expect(health.provider).toBe('crypto.coingecko');
  });
});
