import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../../src/bootstrap.js';
import { jsonResponse, stubFetchAlways, stubFetchImmediateAbort, stubFetchSequence } from '../providers/mock-fetch.js';

const RAW_MARKETS = [
  {
    id: 'bitcoin',
    symbol: 'btc',
    name: 'Bitcoin',
    current_price: 104523.42,
    market_cap: 2_080_000_000_000,
    market_cap_rank: 1,
    total_volume: 42_000_000_000,
    price_change_percentage_24h: 2.31,
    circulating_supply: 19_800_000,
    total_supply: 21_000_000,
    max_supply: 21_000_000,
  },
  {
    id: 'ethereum',
    symbol: 'eth',
    name: 'Ethereum',
    current_price: 4210.15,
    market_cap: 500_000_000_000,
    market_cap_rank: 2,
    total_volume: 20_000_000_000,
    price_change_percentage_24h: -0.82,
  },
];

describe('Crypto Capability (E2E)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('POST /v1/crypto/price', () => {
    it('returns normalized prices for a valid request, with the request ID present', async () => {
      stubFetchSequence([jsonResponse(200, RAW_MARKETS)]);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/crypto/price',
        headers: { 'x-request-id': 'e2e-crypto-price-1' },
        payload: { assets: ['bitcoin', 'ethereum'], currency: 'usd' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-request-id']).toBe('e2e-crypto-price-1');
      const body = JSON.parse(response.payload);
      expect(body.meta.requestId).toBe('e2e-crypto-price-1');
      expect(body.data.assets).toHaveLength(2);
      expect(body.data.assets[0]).toMatchObject({ id: 'bitcoin', symbol: 'btc', price: 104523.42, currency: 'usd' });
      expect(body.data.missing).toEqual([]);
    });

    it('rejects an empty asset list', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/crypto/price',
        payload: { assets: [] },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects an invalid currency code', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/crypto/price',
        payload: { assets: ['bitcoin'], currency: 'not-a-currency' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error.details.fields.currency).toBeDefined();
    });

    it('rejects more than the maximum number of assets', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/crypto/price',
        payload: { assets: Array.from({ length: 21 }, (_, i) => `coin-${i}`) },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error.details.fields.assets).toBeDefined();
    });

    it('rejects an asset id containing invalid characters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/crypto/price',
        payload: { assets: ['Bitcoin!'] },
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns an empty asset list with everything reported missing', async () => {
      stubFetchSequence([jsonResponse(200, [])]);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/crypto/price',
        payload: { assets: ['zzz-unknown-coin'] },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data).toEqual({ assets: [], missing: ['zzz-unknown-coin'] });
    });

    it('translates a persistent provider timeout into 504', async () => {
      stubFetchImmediateAbort();

      const response = await app.inject({
        method: 'POST',
        url: '/v1/crypto/price',
        payload: { assets: ['bitcoin'] },
      });

      expect(response.statusCode).toBe(504);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('PROVIDER_TIMEOUT');
    }, 10_000);

    it('translates rate limiting into 429', async () => {
      stubFetchAlways(jsonResponse(429, {}));

      const response = await app.inject({
        method: 'POST',
        url: '/v1/crypto/price',
        payload: { assets: ['bitcoin'] },
      });

      expect(response.statusCode).toBe(429);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('PROVIDER_RATE_LIMITED');
    });

    it('translates persistent upstream failures into 502', async () => {
      stubFetchAlways(jsonResponse(503, {}));

      const response = await app.inject({
        method: 'POST',
        url: '/v1/crypto/price',
        payload: { assets: ['bitcoin'] },
      });

      expect(response.statusCode).toBe(502);
    }, 10_000);
  });

  describe('POST /v1/crypto/market', () => {
    it('returns full normalized market data for a valid request', async () => {
      stubFetchSequence([jsonResponse(200, RAW_MARKETS)]);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/crypto/market',
        payload: { assets: ['bitcoin', 'ethereum'] },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data.markets[0]).toMatchObject({
        id: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        marketCapRank: 1,
        maxSupply: 21_000_000,
      });
    });

    it('rejects invalid input the same way as /crypto/price', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/crypto/market',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('translates a provider failure into 502', async () => {
      stubFetchAlways(jsonResponse(500, {}));

      const response = await app.inject({
        method: 'POST',
        url: '/v1/crypto/market',
        payload: { assets: ['bitcoin'] },
      });

      expect(response.statusCode).toBe(502);
    }, 10_000);
  });
});
