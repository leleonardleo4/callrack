import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { ALGORAND_MAINNET_GENESIS_HASH, ALGORAND_TESTNET_GENESIS_HASH } from '@x402/avm';
import { decodePaymentRequiredHeader, encodePaymentSignatureHeader } from '@x402/core/http';
import type { PaymentPayload, PaymentRequirements } from '@x402/core/types';
import { createProtectedApp } from '../../src/bootstrap.js';
import { jsonResponse, stubFetchAlways, stubFetchSequence } from '../providers/mock-fetch.js';
import { createFakeFacilitatorClient, X402_PROTOCOL_VERSION, type FakeFacilitatorClient } from './fake-facilitator.js';

// Matches exactly what X402ConfigService resolves for NETWORK=testnet/mainnet
// - see its toNetwork() note on why the full genesis-hash form is used.
const TESTNET_NETWORK = `algorand:${ALGORAND_TESTNET_GENESIS_HASH}`;
const MAINNET_NETWORK = `algorand:${ALGORAND_MAINNET_GENESIS_HASH}`;

const RAW_OPENALEX_SEARCH = { meta: { count: 1 }, results: [{ id: 'https://openalex.org/W1', title: 'Test Work' }] };
const RAW_FORECAST = {
  latitude: 6.5244,
  longitude: 3.3792,
  timezone: 'Africa/Lagos',
  current: { time: '2026-09-16T12:00', temperature_2m: 27.4, relative_humidity_2m: 80, wind_speed_10m: 12.4, precipitation: 0, weather_code: 3 },
  daily: { time: ['2026-09-16'], temperature_2m_max: [30.1], temperature_2m_min: [24.0], weather_code: [3] },
};

function buildFakePaymentPayload(accepted: PaymentRequirements): PaymentPayload {
  return {
    x402Version: X402_PROTOCOL_VERSION,
    accepted,
    payload: {
      // Structurally matches ExactAvmPayloadV2. The fake facilitator never
      // decodes this - only a real facilitator does - so it doesn't need to
      // be a genuine signed transaction for these deterministic tests.
      paymentGroup: ['ZmFrZS10eG4='],
      paymentIndex: 0,
    },
  };
}

/** Decodes the full 402 PAYMENT-REQUIRED challenge. */
function decode402(response: { headers: Record<string, unknown> }): ReturnType<typeof decodePaymentRequiredHeader> {
  const header = response.headers['payment-required'] as string;
  return decodePaymentRequiredHeader(header);
}

/** Decodes the 402 challenge and returns its first accepted PaymentRequirements. */
function firstRequirementsFrom402(response: { headers: Record<string, unknown> }): PaymentRequirements {
  return decode402(response).accepts[0];
}

interface BazaarExtension {
  info: {
    input: { type: string; method?: string; bodyType: string; body: Record<string, unknown> };
    output?: { type: string; example: unknown };
  };
  schema: {
    properties: {
      input: { properties: { body: unknown } };
    };
  };
}

describe('x402 Payment Protection (E2E)', () => {
  describe('unpaid requests', () => {
    let app: NestFastifyApplication;
    let facilitator: FakeFacilitatorClient;

    beforeAll(async () => {
      facilitator = createFakeFacilitatorClient(TESTNET_NETWORK);
      app = await createProtectedApp({ x402FacilitatorClient: facilitator });
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
    });

    afterAll(async () => {
      await app.close();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('returns 402 for an unpaid request and never calls the capability provider', async () => {
      const fetchStub = stubFetchSequence([jsonResponse(200, RAW_FORECAST)]);

      const response = await app.inject({ method: 'POST', url: '/v1/weather', payload: { latitude: 6.5244, longitude: 3.3792 } });

      expect(response.statusCode).toBe(402);
      expect(fetchStub).not.toHaveBeenCalled();
    });

    it('includes valid x402 payment requirements in the 402 response', async () => {
      const response = await app.inject({ method: 'POST', url: '/v1/weather', payload: { latitude: 6.5244, longitude: 3.3792 } });

      expect(response.statusCode).toBe(402);
      const requirements = firstRequirementsFrom402(response);
      expect(requirements.scheme).toBe('exact');
      expect(requirements.network).toBe(TESTNET_NETWORK);
      expect(requirements.payTo).toBe('TTCZHJ24VWV64DMFCXKHS2GMLFVUTBA673THZR7LNYY3GEB3XV7HNUEQXQ');
      // "0.003" USDC at 6 decimals, converted via pure string arithmetic (see
      // convertToTokenAmount) - never a floating-point-derived value.
      expect(requirements.amount).toBe('3000');
    });

    it('returns 402 for every representative protected capability', async () => {
      for (const path of ['/v1/weather', '/v1/academic/search', '/v1/research']) {
        const response = await app.inject({ method: 'POST', url: path, payload: {} });
        expect(response.statusCode, `expected 402 for ${path}`).toBe(402);
      }
    });

    it('never calls the facilitator verify/settle for a request that never presents a payment', async () => {
      await app.inject({ method: 'POST', url: '/v1/weather', payload: { latitude: 6.5244, longitude: 3.3792 } });
      expect(facilitator.verify).not.toHaveBeenCalled();
      expect(facilitator.settle).not.toHaveBeenCalled();
    });
  });

  describe('Bazaar discovery + challenge tag in the 402 response', () => {
    let app: NestFastifyApplication;

    beforeAll(async () => {
      const facilitator = createFakeFacilitatorClient(TESTNET_NETWORK);
      app = await createProtectedApp({ x402FacilitatorClient: facilitator });
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it.each([
      ['/v1/weather', { latitude: 6.5244, longitude: 3.3792 }],
      ['/v1/academic/search', { query: 'test' }],
      ['/v1/research', { query: 'renewable energy investment in Africa' }],
    ])('never carries the x402-global-challenge tag on Testnet for %s', async (path, payload) => {
      const response = await app.inject({ method: 'POST', url: path, payload });
      expect(response.statusCode).toBe(402);
      const requirements = firstRequirementsFrom402(response);
      expect(requirements.extra?.tag).toBeUndefined();
    });

    it.each([
      ['/v1/weather', { latitude: 6.5244, longitude: 3.3792 }],
      ['/v1/academic/search', { query: 'test' }],
      ['/v1/research', { query: 'renewable energy investment in Africa' }],
    ])('carries a Bazaar discovery extension with input/output metadata for %s', async (path, payload) => {
      const response = await app.inject({ method: 'POST', url: path, payload });
      expect(response.statusCode).toBe(402);
      const paymentRequired = decode402(response);

      const bazaar = paymentRequired.extensions?.bazaar as BazaarExtension | undefined;
      expect(bazaar, `expected a bazaar discovery extension on ${path}`).toBeDefined();
      expect(bazaar!.info.input.type).toBe('http');
      expect(bazaar!.info.input.method).toBe('POST');
      expect(bazaar!.info.input.bodyType).toBe('json');
      expect(Object.keys(bazaar!.info.input.body).length).toBeGreaterThan(0);
      expect(bazaar!.info.output?.type).toBe('json');
      expect(bazaar!.info.output?.example).toBeDefined();
      expect(bazaar!.schema.properties.input.properties.body).toBeDefined();
    });

    it.each([
      ['/v1/weather', { latitude: 6.5244, longitude: 3.3792 }],
      ['/v1/academic/search', { query: 'test' }],
      ['/v1/research', { query: 'renewable energy investment in Africa' }],
    ])('carries the x402-merchant extension declaring the Callrack identity for %s', async (path, payload) => {
      const response = await app.inject({ method: 'POST', url: path, payload });
      expect(response.statusCode).toBe(402);
      const paymentRequired = decode402(response);

      const merchant = paymentRequired.extensions?.['x402-merchant'] as
        | { info: { name: string; website: string; logo: string; categories: string[] }; schema: unknown }
        | undefined;
      expect(merchant, `expected an x402-merchant extension on ${path}`).toBeDefined();
      expect(merchant!.info.name).toBe('Callrack');
      expect(merchant!.info.website).toBe('https://callrack.xyz');
      expect(merchant!.info.logo).toBe('https://callrack.xyz/favicon.png');
      expect(merchant!.info.categories).toContain('algorand');
      expect(merchant!.schema).toBeDefined();
    });

    it('carries the route-specific description (from the capability registry) in the 402 resource info', async () => {
      const response = await app.inject({ method: 'POST', url: '/v1/weather', payload: { latitude: 6.5244, longitude: 3.3792 } });
      const paymentRequired = decode402(response);
      expect(paymentRequired.resource.description).toContain('Open-Meteo');
      expect(paymentRequired.resource.description).toContain('forecast');
    });

    it('gives each protected route its own, distinct discovery input example', async () => {
      const weather = await app.inject({ method: 'POST', url: '/v1/weather', payload: { latitude: 6.5244, longitude: 3.3792 } });
      const academic = await app.inject({ method: 'POST', url: '/v1/academic/search', payload: { query: 'test' } });

      const weatherBazaar = decode402(weather).extensions?.bazaar as BazaarExtension;
      const academicBazaar = decode402(academic).extensions?.bazaar as BazaarExtension;

      expect(weatherBazaar.info.input.body).toEqual({ latitude: 6.5244, longitude: 3.3792, days: 3 });
      expect(academicBazaar.info.input.body).toEqual({ query: 'large language models healthcare', limit: 5 });
    });

    it('does not attach any discovery/payment configuration to free routes', async () => {
      const response = await app.inject({ method: 'GET', url: '/health' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['payment-required']).toBeUndefined();
    });
  });

  describe('Mainnet Challenge tag', () => {
    let app: NestFastifyApplication;

    beforeAll(async () => {
      // X402ConfigService reads NETWORK once, at construction, inside
      // createApp() - flipping process.env here and restoring it
      // immediately after is what lets this one describe block exercise
      // the Mainnet code path without affecting any other test file (each
      // runs in its own worker) or any other describe block in this file
      // (Vitest runs describe blocks in one file sequentially).
      const originalNetwork = process.env.NETWORK;
      process.env.NETWORK = 'mainnet';
      try {
        const facilitator = createFakeFacilitatorClient(MAINNET_NETWORK);
        app = await createProtectedApp({ x402FacilitatorClient: facilitator });
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
      } finally {
        process.env.NETWORK = originalNetwork;
      }
    });

    afterAll(async () => {
      await app.close();
    });

    it('carries the x402-global-challenge tag on Mainnet', async () => {
      const response = await app.inject({ method: 'POST', url: '/v1/weather', payload: { latitude: 6.5244, longitude: 3.3792 } });
      expect(response.statusCode).toBe(402);
      const requirements = firstRequirementsFrom402(response);
      expect(requirements.extra?.tag).toBe('x402-global-challenge');
      expect(requirements.network).toBe(MAINNET_NETWORK);
      // The stable Mainnet merchant address from vitest.config.ts's test env.
      expect(requirements.payTo).toBe('V4BOVWHAQJUNZAPU4D7B4N2ALHVMHBRJ2F75EJG5E5XS5JFJZGAU4SS2UA');
    });

    it('still carries bazaar and x402-merchant extensions on Mainnet', async () => {
      const response = await app.inject({ method: 'POST', url: '/v1/weather', payload: { latitude: 6.5244, longitude: 3.3792 } });
      const paymentRequired = decode402(response);
      expect(paymentRequired.extensions?.bazaar).toBeDefined();
      expect(paymentRequired.extensions?.['x402-merchant']).toBeDefined();
    });
  });

  describe('invalid payment', () => {
    let app: NestFastifyApplication;
    let facilitator: FakeFacilitatorClient;

    beforeAll(async () => {
      facilitator = createFakeFacilitatorClient(TESTNET_NETWORK, {
        verify: { isValid: false, invalidReason: 'invalid_signature', invalidMessage: 'signature does not match' },
      });
      app = await createProtectedApp({ x402FacilitatorClient: facilitator });
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
    });

    afterAll(async () => {
      await app.close();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('rejects a malformed payment header with 402 and never calls the capability provider', async () => {
      const fetchStub = stubFetchSequence([jsonResponse(200, RAW_FORECAST)]);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/weather',
        headers: { 'payment-signature': 'not-valid-base64!!!' },
        payload: { latitude: 6.5244, longitude: 3.3792 },
      });

      expect(response.statusCode).toBe(402);
      expect(fetchStub).not.toHaveBeenCalled();
    });

    it('rejects a structurally valid but facilitator-invalid payment with 402 and never calls the capability provider', async () => {
      const fetchStub = stubFetchSequence([jsonResponse(200, RAW_FORECAST)]);
      const unpaid = await app.inject({ method: 'POST', url: '/v1/weather', payload: { latitude: 6.5244, longitude: 3.3792 } });
      const requirements = firstRequirementsFrom402(unpaid);
      const header = encodePaymentSignatureHeader(buildFakePaymentPayload(requirements));

      const response = await app.inject({
        method: 'POST',
        url: '/v1/weather',
        headers: { 'payment-signature': header },
        payload: { latitude: 6.5244, longitude: 3.3792 },
      });

      expect(response.statusCode).toBe(402);
      expect(fetchStub).not.toHaveBeenCalled();
      expect(facilitator.settle).not.toHaveBeenCalled();
    });
  });

  describe('valid payment', () => {
    let app: NestFastifyApplication;
    let facilitator: FakeFacilitatorClient;

    beforeAll(async () => {
      facilitator = createFakeFacilitatorClient(TESTNET_NETWORK);
      app = await createProtectedApp({ x402FacilitatorClient: facilitator });
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
    });

    afterAll(async () => {
      await app.close();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('executes the capability and returns its normal response once payment verifies', async () => {
      stubFetchSequence([jsonResponse(200, RAW_OPENALEX_SEARCH)]);
      const unpaid = await app.inject({ method: 'POST', url: '/v1/academic/search', payload: { query: 'test' } });
      const requirements = firstRequirementsFrom402(unpaid);
      const header = encodePaymentSignatureHeader(buildFakePaymentPayload(requirements));

      const response = await app.inject({
        method: 'POST',
        url: '/v1/academic/search',
        headers: { 'payment-signature': header },
        payload: { query: 'test' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      // The response shape is exactly the capability's normal shape - x402
      // adds nothing to the business payload.
      expect(body.data.results[0]).toMatchObject({ title: 'Test Work' });
      expect(facilitator.verify).toHaveBeenCalledTimes(1);
      expect(facilitator.settle).toHaveBeenCalledTimes(1);
    });

    it('verifies payment before executing the capability (never the reverse)', async () => {
      const callOrder: string[] = [];
      const trackingFacilitator = createFakeFacilitatorClient(TESTNET_NETWORK, {
        verify: async () => {
          callOrder.push('verify');
          return { isValid: true };
        },
      });
      const orderedApp = await createProtectedApp({ x402FacilitatorClient: trackingFacilitator });
      await orderedApp.init();
      await orderedApp.getHttpAdapter().getInstance().ready();

      const fetchStub = vi.fn(async () => {
        callOrder.push('provider-fetch');
        return jsonResponse(200, RAW_FORECAST);
      });
      vi.stubGlobal('fetch', fetchStub);

      const unpaid = await orderedApp.inject({ method: 'POST', url: '/v1/weather', payload: { latitude: 6.5244, longitude: 3.3792 } });
      const requirements = firstRequirementsFrom402(unpaid);
      const header = encodePaymentSignatureHeader(buildFakePaymentPayload(requirements));

      await orderedApp.inject({
        method: 'POST',
        url: '/v1/weather',
        headers: { 'payment-signature': header },
        payload: { latitude: 6.5244, longitude: 3.3792 },
      });

      expect(callOrder).toEqual(['verify', 'provider-fetch']);
      await orderedApp.close();
    });
  });

  describe('free routes', () => {
    let app: NestFastifyApplication;

    beforeAll(async () => {
      const facilitator = createFakeFacilitatorClient(TESTNET_NETWORK);
      app = await createProtectedApp({ x402FacilitatorClient: facilitator });
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it('keeps /health free of payment protection', async () => {
      const response = await app.inject({ method: 'GET', url: '/health' });
      expect(response.statusCode).toBe(200);
    });

    it('keeps /health/ready free of payment protection', async () => {
      const response = await app.inject({ method: 'GET', url: '/health/ready' });
      expect([200, 503]).toContain(response.statusCode);
    });

    it('keeps /docs/json free of payment protection', async () => {
      const response = await app.inject({ method: 'GET', url: '/docs/json' });
      expect(response.statusCode).toBe(200);
    });
  });

  describe('startup validation', () => {
    it('fails startup when the facilitator cannot be reached', async () => {
      const brokenFacilitator = createFakeFacilitatorClient(TESTNET_NETWORK, {});
      brokenFacilitator.getSupported.mockRejectedValue(new Error('network unreachable'));

      // The facilitator never returning any supported kind means the
      // registered scheme has no facilitator support - a structural error
      // x402 itself detects and rejects during initialize().
      await expect(createProtectedApp({ x402FacilitatorClient: brokenFacilitator })).rejects.toThrow();
    });
  });

  describe('existing capability behavior is unaffected by createApp() (no x402 installed)', () => {
    it('still returns 200 without any payment for a plain createApp() instance', async () => {
      const { createApp } = await import('../../src/bootstrap.js');
      const app = await createApp();
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
      stubFetchSequence([jsonResponse(200, RAW_FORECAST)]);

      const response = await app.inject({ method: 'POST', url: '/v1/weather', payload: { latitude: 6.5244, longitude: 3.3792 } });

      expect(response.statusCode).toBe(200);
      vi.unstubAllGlobals();
      await app.close();
    });
  });
});
