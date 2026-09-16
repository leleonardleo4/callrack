import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../../src/bootstrap.js';
import { jsonResponse, stubFetchAlways, stubFetchSequence } from '../providers/mock-fetch.js';

describe('FX Capability (E2E)', () => {
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

  describe('POST /v1/fx/rates', () => {
    it('returns normalized current rates, with the request ID present', async () => {
      stubFetchSequence([jsonResponse(200, { base: 'USD', date: '2026-09-16', rates: { EUR: 0.85, GBP: 0.74, NGN: 1530.22 } })]);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/fx/rates',
        headers: { 'x-request-id': 'e2e-fx-rates-1' },
        payload: { base: 'USD', currencies: ['EUR', 'GBP', 'NGN'] },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-request-id']).toBe('e2e-fx-rates-1');
      const body = JSON.parse(response.payload);
      expect(body.meta.requestId).toBe('e2e-fx-rates-1');
      expect(body.data).toEqual({
        base: 'USD',
        date: '2026-09-16',
        rates: { EUR: 0.85, GBP: 0.74, NGN: 1530.22 },
      });
    });

    it('returns normalized historical rates for a valid date', async () => {
      stubFetchSequence([jsonResponse(200, { base: 'USD', date: '2026-09-15', rates: { EUR: 0.86 } })]);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/fx/rates',
        payload: { base: 'USD', currencies: ['EUR'], date: '2026-09-15' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data).toEqual({ base: 'USD', date: '2026-09-15', rates: { EUR: 0.86 } });
    });

    it('rejects an invalid base currency code', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/fx/rates',
        payload: { base: 'US', currencies: ['EUR'] },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error.details.fields.base).toBeDefined();
    });

    it('rejects an invalid date format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/fx/rates',
        payload: { base: 'USD', currencies: ['EUR'], date: 'not-a-date' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error.details.fields.date).toBeDefined();
    });

    it('rejects an empty currencies list', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/fx/rates',
        payload: { base: 'USD', currencies: [] },
      });

      expect(response.statusCode).toBe(400);
    });

    it('rejects more than the maximum number of currencies', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/fx/rates',
        payload: { base: 'USD', currencies: Array.from({ length: 21 }, () => 'EUR') },
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 400 INVALID_REQUEST for an unsupported currency', async () => {
      stubFetchSequence([jsonResponse(200, { base: 'USD', date: '2026-09-16', rates: {} })]);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/fx/rates',
        payload: { base: 'USD', currencies: ['ZZZ'] },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('INVALID_REQUEST');
    });

    it('translates a persistent upstream failure into 502', async () => {
      stubFetchAlways(jsonResponse(503, {}));

      const response = await app.inject({
        method: 'POST',
        url: '/v1/fx/rates',
        payload: { base: 'USD', currencies: ['EUR'] },
      });

      expect(response.statusCode).toBe(502);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('PROVIDER_UNAVAILABLE');
    }, 10_000);
  });
});
