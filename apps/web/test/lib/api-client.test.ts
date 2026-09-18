import { afterEach, describe, expect, it, vi } from 'vitest';
import { callCapability, getCapabilities } from '@/lib/api-client';
import { jsonResponse, mockFetchOnce } from '../fixtures/mock-fetch';
import { CAPABILITIES_FIXTURE } from '../fixtures/capabilities';

function base64Encode(value: unknown): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getCapabilities', () => {
  it('returns a success result with the decoded capability list', async () => {
    mockFetchOnce(jsonResponse({ data: CAPABILITIES_FIXTURE, meta: { requestId: 'req_abc' } }, { requestId: 'req_abc' }));

    const result = await getCapabilities();

    expect(result.kind).toBe('success');
    if (result.kind === 'success') {
      expect(result.data.capabilities).toHaveLength(3);
      expect(result.requestId).toBe('req_abc');
    }
  });

  it('returns a network-error result when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')));

    const result = await getCapabilities();

    expect(result.kind).toBe('network-error');
    if (result.kind === 'network-error') {
      expect(result.message).toContain('Failed to fetch');
    }
  });
});

describe('callCapability', () => {
  it('decodes a 402 response into a payment-required result', async () => {
    const challenge = {
      x402Version: 2,
      resource: { url: 'http://localhost/v1/weather' },
      accepts: [
        {
          scheme: 'exact',
          network: 'algorand:test',
          asset: '10458941',
          amount: '3000',
          payTo: 'TTCZHJ24VWV64DMFCXKHS2GMLFVUTBA673THZR7LNYY3GEB3XV7HNUEQXQ',
          maxTimeoutSeconds: 300,
          extra: {},
        },
      ],
    };
    const headers = new Headers();
    headers.set('payment-required', base64Encode(challenge));
    headers.set('x-request-id', 'req_402');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(new Response('{}', { status: 402, headers })),
    );

    const result = await callCapability('/v1/weather', { latitude: 1, longitude: 1 });

    expect(result.kind).toBe('payment-required');
    if (result.kind === 'payment-required') {
      expect(result.paymentRequired.accepts[0].amount).toBe('3000');
      expect(result.requestId).toBe('req_402');
    }
  });

  it('returns an api-error result for a malformed (undecodable) PAYMENT-REQUIRED header', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        new Response('{}', { status: 402, headers: { 'payment-required': 'not-valid-base64-json!!', 'x-request-id': 'req_bad' } }),
      ),
    );

    const result = await callCapability('/v1/weather', { latitude: 1, longitude: 1 });

    expect(result.kind).toBe('api-error');
    if (result.kind === 'api-error') {
      expect(result.status).toBe(402);
      expect(result.error.code).toBe('PAYMENT_REQUIRED_HEADER_INVALID');
    }
  });

  it('returns an api-error result for a 402 with no PAYMENT-REQUIRED header at all', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('{}', { status: 402 })));

    const result = await callCapability('/v1/weather', { latitude: 1, longitude: 1 });

    expect(result.kind).toBe('api-error');
    if (result.kind === 'api-error') {
      expect(result.error.code).toBe('PAYMENT_REQUIRED_HEADER_MISSING');
    }
  });

  it('returns an api-error result for a validation failure', async () => {
    mockFetchOnce(
      new Response(
        JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'latitude is required' }, meta: { requestId: 'req_400' } }),
        { status: 400, headers: { 'content-type': 'application/json', 'x-request-id': 'req_400' } },
      ),
    );

    const result = await callCapability('/v1/weather', {});

    expect(result.kind).toBe('api-error');
    if (result.kind === 'api-error') {
      expect(result.status).toBe(400);
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('surfaces a decoded PAYMENT-RESPONSE header only on a real successful (paid) response', async () => {
    const settlement = { success: true, transaction: 'FAKE_TEST_TRANSACTION_ID' };
    const headers = new Headers();
    headers.set('content-type', 'application/json');
    headers.set('x-request-id', 'req_paid');
    headers.set('payment-response', base64Encode(settlement));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { ok: true }, meta: { requestId: 'req_paid' } }), { status: 200, headers }),
      ),
    );

    const result = await callCapability('/v1/weather', { latitude: 1, longitude: 1 }, 'signed-payment-header');

    expect(result.kind).toBe('success');
    if (result.kind === 'success') {
      expect(result.paymentResponse).toEqual(settlement);
    }
  });

  it('never populates paymentResponse on a success result when no header was sent', async () => {
    mockFetchOnce(jsonResponse({ data: { ok: true }, meta: { requestId: 'req_free' } }, { requestId: 'req_free' }));

    const result = await callCapability('/v1/weather', { latitude: 1, longitude: 1 });

    expect(result.kind).toBe('success');
    if (result.kind === 'success') {
      expect(result.paymentResponse).toBeUndefined();
    }
  });

  it('forwards the PAYMENT-SIGNATURE header verbatim when provided', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ data: {}, meta: { requestId: 'req_1' } }));
    vi.stubGlobal('fetch', fetchMock);

    await callCapability('/v1/weather', { latitude: 1, longitude: 1 }, 'my-signature');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get('PAYMENT-SIGNATURE')).toBe('my-signature');
  });
});
