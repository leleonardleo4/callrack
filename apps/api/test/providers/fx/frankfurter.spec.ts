import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProviderErrorCode } from '../../../src/providers/common/index.js';
import { FrankfurterProvider } from '../../../src/providers/fx/frankfurter/frankfurter.provider.js';
import { mapFrankfurterRates } from '../../../src/providers/fx/frankfurter/frankfurter.mapper.js';
import { jsonResponse, malformedJsonResponse, stubFetchSequence } from '../mock-fetch.js';
import { NO_RETRY_OPTIONS } from '../test-provider-config.js';

describe('Frankfurter mapper', () => {
  it('normalizes a rates response', () => {
    const result = mapFrankfurterRates({ amount: 1, base: 'USD', date: '2023-01-01', rates: { EUR: 0.93 } });
    expect(result).toEqual({ base: 'USD', date: '2023-01-01', rates: { EUR: 0.93 } });
  });

  it('normalizes an empty rates object', () => {
    expect(mapFrankfurterRates({ base: 'USD', date: '2023-01-01', rates: {} })).toEqual({
      base: 'USD',
      date: '2023-01-01',
      rates: {},
    });
  });

  it('throws PROVIDER_BAD_RESPONSE when required fields are missing', () => {
    expect(() => mapFrankfurterRates({} as never)).toThrowError(
      expect.objectContaining({ code: ProviderErrorCode.PROVIDER_BAD_RESPONSE }),
    );
  });
});

describe('FrankfurterProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches and normalizes current rates', async () => {
    stubFetchSequence([jsonResponse(200, { base: 'USD', date: '2023-01-01', rates: { EUR: 0.93 } })]);
    const provider = new FrankfurterProvider(NO_RETRY_OPTIONS);

    const result = await provider.getCurrentRates({ base: 'USD', symbols: ['EUR'] });

    expect(result).toEqual({ base: 'USD', date: '2023-01-01', rates: { EUR: 0.93 } });
  });

  it('converts an amount using the fetched rate', async () => {
    stubFetchSequence([jsonResponse(200, { base: 'USD', date: '2023-01-01', rates: { EUR: 0.5 } })]);
    const provider = new FrankfurterProvider(NO_RETRY_OPTIONS);

    const result = await provider.convert({ from: 'USD', to: 'EUR', amount: 10 });

    expect(result).toEqual({ from: 'USD', to: 'EUR', amount: 10, convertedAmount: 5, rate: 0.5, date: '2023-01-01' });
  });

  it('short-circuits conversion when from equals to', async () => {
    const provider = new FrankfurterProvider(NO_RETRY_OPTIONS);

    const result = await provider.convert({ from: 'USD', to: 'USD', amount: 10, date: '2023-01-01' });

    expect(result).toEqual({ from: 'USD', to: 'USD', amount: 10, convertedAmount: 10, rate: 1, date: '2023-01-01' });
  });

  it('maps a malformed response to a provider error', async () => {
    stubFetchSequence([malformedJsonResponse()]);
    const provider = new FrankfurterProvider(NO_RETRY_OPTIONS);

    await expect(provider.getCurrentRates({ base: 'USD' })).rejects.toMatchObject({
      code: ProviderErrorCode.PROVIDER_BAD_RESPONSE,
    });
  });

  it('surfaces PROVIDER_RATE_LIMITED for a 429 response', async () => {
    stubFetchSequence([jsonResponse(429, {})]);
    const provider = new FrankfurterProvider(NO_RETRY_OPTIONS);

    await expect(provider.getCurrentRates({ base: 'USD' })).rejects.toMatchObject({
      code: ProviderErrorCode.PROVIDER_RATE_LIMITED,
    });
  });

  it('surfaces a normalized error for an upstream 5xx failure', async () => {
    stubFetchSequence([jsonResponse(503, {})]);
    const provider = new FrankfurterProvider(NO_RETRY_OPTIONS);

    await expect(provider.getCurrentRates({ base: 'USD' })).rejects.toMatchObject({
      code: ProviderErrorCode.PROVIDER_UNAVAILABLE,
    });
  });

  it('reports health status from a probe request', async () => {
    stubFetchSequence([jsonResponse(200, { base: 'USD', date: '2023-01-01', rates: { EUR: 0.93 } })]);
    const provider = new FrankfurterProvider(NO_RETRY_OPTIONS);

    const health = await provider.checkHealth();

    expect(health.healthy).toBe(true);
    expect(health.provider).toBe('fx.frankfurter');
  });
});
