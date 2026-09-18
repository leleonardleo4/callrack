import { afterEach, describe, expect, it, vi } from 'vitest';
import { CallrackHttpClient } from '../src/http-client.js';
import {
  CallrackApiError,
  CallrackPaymentError,
  CallrackPaymentRequiredError,
  CallrackTimeoutError,
  CallrackValidationError,
} from '../src/errors.js';
import { buildPaymentRequired, jsonResponse, paymentRequiredResponse } from './fixtures/http.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('CallrackHttpClient', () => {
  it('returns data and meta on a successful response', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { data: { ok: true }, meta: { requestId: 'req_1' } }));
    const client = new CallrackHttpClient({ baseUrl: 'http://localhost:3000', fetchImpl });

    const result = await client.request<{ ok: boolean }>('/v1/capabilities');
    expect(result.data).toEqual({ ok: true });
    expect(result.meta.requestId).toBe('req_1');
  });

  it('throws CallrackApiError for a non-2xx, non-402 error envelope', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(400, { error: { code: 'BAD_REQUEST', message: 'invalid query' }, meta: { requestId: 'req_2' } }),
    );
    const client = new CallrackHttpClient({ baseUrl: 'http://localhost:3000', fetchImpl });

    const error = await client.request('/v1/news/search').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(CallrackApiError);
    const apiError = error as CallrackApiError;
    expect(apiError.status).toBe(400);
    expect(apiError.code).toBe('BAD_REQUEST');
    expect(apiError.requestId).toBe('req_2');
  });

  it('throws CallrackValidationError on malformed JSON', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('not json{{{', { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const client = new CallrackHttpClient({ baseUrl: 'http://localhost:3000', fetchImpl });

    await expect(client.request('/v1/capabilities')).rejects.toBeInstanceOf(CallrackValidationError);
  });

  it('throws CallrackValidationError when the success envelope is missing data/meta', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { unexpected: true }));
    const client = new CallrackHttpClient({ baseUrl: 'http://localhost:3000', fetchImpl });

    await expect(client.request('/v1/capabilities')).rejects.toBeInstanceOf(CallrackValidationError);
  });

  it('throws CallrackTimeoutError when the request exceeds timeoutMs', async () => {
    vi.useFakeTimers();
    const hangingFetch = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    ) as unknown as typeof fetch;
    const client = new CallrackHttpClient({ baseUrl: 'http://localhost:3000', fetchImpl: hangingFetch, timeoutMs: 50 });

    const pending = client.request('/v1/weather');
    const assertion = expect(pending).rejects.toBeInstanceOf(CallrackTimeoutError);
    await vi.advanceTimersByTimeAsync(50);
    await assertion;
  });

  it('throws CallrackPaymentRequiredError with the live accepts list when no signer paid the 402', async () => {
    const paymentRequired = buildPaymentRequired({ resourceUrl: 'http://localhost:3000/v1/weather' });
    const fetchImpl = vi.fn(async () => paymentRequiredResponse(paymentRequired));
    const client = new CallrackHttpClient({ baseUrl: 'http://localhost:3000', fetchImpl });

    const error = await client.request('/v1/weather').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(CallrackPaymentRequiredError);
    const paymentError = error as CallrackPaymentRequiredError;
    expect(paymentError.resource).toBe('http://localhost:3000/v1/weather');
    expect(paymentError.accepts).toHaveLength(1);
    expect(paymentError.accepts[0]?.asset).toBe('10458941');
  });

  it('throws CallrackPaymentError (not CallrackPaymentRequiredError) when a signer already attempted the payment', async () => {
    const paymentRequired = buildPaymentRequired({
      resourceUrl: 'http://localhost:3000/v1/weather',
      error: 'Transaction simulation failed: receiver error: must optin, asset 10458941 missing from PAYTOADDR',
    });
    const fetchImpl = vi.fn(async () => paymentRequiredResponse(paymentRequired));
    const client = new CallrackHttpClient({ baseUrl: 'http://localhost:3000', fetchImpl, hasSigner: true });

    const error = await client.request('/v1/weather').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(CallrackPaymentError);
    expect(error).not.toBeInstanceOf(CallrackPaymentRequiredError);
    expect((error as CallrackPaymentError).message).toContain('must optin');
  });
});
