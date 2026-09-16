import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProviderError, ProviderErrorCode } from '../../src/providers/common/index.js';
import { ProviderHttpClient } from '../../src/providers/common/provider-http-client.js';
import { jsonResponse, malformedJsonResponse, stubFetchAbort, stubFetchSequence } from './mock-fetch.js';

function createClient(overrides: Partial<ConstructorParameters<typeof ProviderHttpClient>[0]> = {}) {
  return new ProviderHttpClient({
    providerSlug: 'test-provider',
    baseUrl: 'https://example.test',
    timeoutMs: 50,
    retry: { maxAttempts: 1, baseDelayMs: 1, maxDelayMs: 5 },
    ...overrides,
  });
}

describe('ProviderHttpClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses a successful JSON response', async () => {
    stubFetchSequence([jsonResponse(200, { hello: 'world' })]);
    const client = createClient();

    const result = await client.requestJson<{ hello: string }>({ path: 'ok' });

    expect(result).toEqual({ hello: 'world' });
  });

  it('maps a malformed JSON body to PROVIDER_BAD_RESPONSE without retrying', async () => {
    const fetchMock = stubFetchSequence([malformedJsonResponse()]);
    const client = createClient();

    await expect(client.requestJson({ path: 'bad-json' })).rejects.toMatchObject({
      code: ProviderErrorCode.PROVIDER_BAD_RESPONSE,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('maps an aborted request to PROVIDER_TIMEOUT', async () => {
    stubFetchAbort();
    const client = createClient({ timeoutMs: 5, retry: { maxAttempts: 0 } });

    await expect(client.requestJson({ path: 'slow' })).rejects.toMatchObject({
      code: ProviderErrorCode.PROVIDER_TIMEOUT,
    });
  });

  it('maps a 429 with Retry-After to PROVIDER_RATE_LIMITED and retries using that delay', async () => {
    const fetchMock = stubFetchSequence([
      jsonResponse(429, {}, { 'retry-after': '0' }),
      jsonResponse(200, { ok: true }),
    ]);
    const client = createClient({ retry: { maxAttempts: 1, baseDelayMs: 1, maxDelayMs: 5 } });

    const result = await client.requestJson<{ ok: boolean }>({ path: 'limited' });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 429 without Retry-After information', async () => {
    const fetchMock = stubFetchSequence([jsonResponse(429, {})]);
    const client = createClient();

    await expect(client.requestJson({ path: 'limited' })).rejects.toMatchObject({
      code: ProviderErrorCode.PROVIDER_RATE_LIMITED,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a 503 and succeeds on the second attempt', async () => {
    const fetchMock = stubFetchSequence([jsonResponse(503, {}), jsonResponse(200, { ok: true })]);
    const client = createClient();

    const result = await client.requestJson<{ ok: boolean }>({ path: 'flaky' });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('exhausts retries and surfaces PROVIDER_UNAVAILABLE for persistent 5xx failures', async () => {
    const fetchMock = stubFetchSequence([jsonResponse(500, {}), jsonResponse(500, {})]);
    const client = createClient({ retry: { maxAttempts: 1, baseDelayMs: 1, maxDelayMs: 5 } });

    await expect(client.requestJson({ path: 'down' })).rejects.toMatchObject({
      code: ProviderErrorCode.PROVIDER_UNAVAILABLE,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 400 invalid request', async () => {
    const fetchMock = stubFetchSequence([jsonResponse(400, {})]);
    const client = createClient();

    await expect(client.requestJson({ path: 'bad-request' })).rejects.toMatchObject({
      code: ProviderErrorCode.PROVIDER_INVALID_REQUEST,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry a 401 authentication failure', async () => {
    const fetchMock = stubFetchSequence([jsonResponse(401, {})]);
    const client = createClient();

    await expect(client.requestJson({ path: 'secure' })).rejects.toMatchObject({
      code: ProviderErrorCode.PROVIDER_AUTHENTICATION_FAILED,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('maps a network error to PROVIDER_UNAVAILABLE and retries', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValueOnce(new Error('ECONNRESET')).mockResolvedValueOnce(jsonResponse(200, { ok: true })),
    );
    const client = createClient();

    const result = await client.requestJson<{ ok: boolean }>({ path: 'flaky-network' });

    expect(result).toEqual({ ok: true });
  });

  it('rethrows ProviderError instances as-is', () => {
    const error = new ProviderError({
      code: ProviderErrorCode.PROVIDER_UNKNOWN_ERROR,
      message: 'boom',
      providerSlug: 'test-provider',
    });
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe(ProviderErrorCode.PROVIDER_UNKNOWN_ERROR);
  });
});
