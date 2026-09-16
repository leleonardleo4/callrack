import { describe, expect, it } from 'vitest';
import { toCryptoMarketResponse, toCryptoPriceResponse } from '../../src/crypto/crypto.mapper.js';
import type { CryptoMarketDataResult, CryptoMarketDatum } from '../../src/providers/crypto/crypto.types.js';

const BITCOIN: CryptoMarketDatum = {
  asset: { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', sourceProvider: 'coingecko' },
  vsCurrency: 'usd',
  price: 104523.42,
  marketCap: 2_080_000_000_000,
  marketCapRank: 1,
  volume24h: 42_000_000_000,
  changePercent24h: 2.31,
  circulatingSupply: 19_800_000,
  totalSupply: 21_000_000,
  maxSupply: 21_000_000,
};

const MINIMAL: CryptoMarketDatum = {
  asset: { id: 'minimal-coin', symbol: 'min', name: 'Minimal Coin', sourceProvider: 'coingecko' },
  vsCurrency: 'usd',
};

describe('crypto.mapper', () => {
  describe('toCryptoPriceResponse', () => {
    it('maps a fully-populated market datum to the slim price contract', () => {
      const result: CryptoMarketDataResult = { markets: [BITCOIN] };
      expect(toCryptoPriceResponse(result, ['bitcoin'])).toEqual({
        assets: [{ id: 'bitcoin', symbol: 'btc', price: 104523.42, currency: 'usd', change24h: 2.31 }],
        missing: [],
      });
    });

    it('uses null for fields the provider did not supply', () => {
      const result: CryptoMarketDataResult = { markets: [MINIMAL] };
      expect(toCryptoPriceResponse(result, ['minimal-coin']).assets[0]).toEqual({
        id: 'minimal-coin',
        symbol: 'min',
        price: null,
        currency: 'usd',
        change24h: null,
      });
    });

    it('lists requested assets CoinGecko did not recognize under "missing"', () => {
      const result: CryptoMarketDataResult = { markets: [BITCOIN] };
      const response = toCryptoPriceResponse(result, ['bitcoin', 'nonexistent-coin']);
      expect(response.assets).toHaveLength(1);
      expect(response.missing).toEqual(['nonexistent-coin']);
    });

    it('normalizes an empty result with everything missing', () => {
      const result: CryptoMarketDataResult = { markets: [] };
      expect(toCryptoPriceResponse(result, ['bitcoin', 'ethereum'])).toEqual({
        assets: [],
        missing: ['bitcoin', 'ethereum'],
      });
    });
  });

  describe('toCryptoMarketResponse', () => {
    it('maps a fully-populated market datum to the full market contract', () => {
      const result: CryptoMarketDataResult = { markets: [BITCOIN] };
      expect(toCryptoMarketResponse(result, ['bitcoin']).markets[0]).toEqual({
        id: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        price: 104523.42,
        currency: 'usd',
        marketCap: 2_080_000_000_000,
        marketCapRank: 1,
        volume24h: 42_000_000_000,
        change24h: 2.31,
        circulatingSupply: 19_800_000,
        totalSupply: 21_000_000,
        maxSupply: 21_000_000,
      });
    });

    it('uses null for fields the provider did not supply', () => {
      const result: CryptoMarketDataResult = { markets: [MINIMAL] };
      expect(toCryptoMarketResponse(result, ['minimal-coin']).markets[0]).toEqual({
        id: 'minimal-coin',
        symbol: 'min',
        name: 'Minimal Coin',
        price: null,
        currency: 'usd',
        marketCap: null,
        marketCapRank: null,
        volume24h: null,
        change24h: null,
        circulatingSupply: null,
        totalSupply: null,
        maxSupply: null,
      });
    });

    it('lists requested assets CoinGecko did not recognize under "missing"', () => {
      const result: CryptoMarketDataResult = { markets: [] };
      expect(toCryptoMarketResponse(result, ['zzz-unknown']).missing).toEqual(['zzz-unknown']);
    });
  });
});
