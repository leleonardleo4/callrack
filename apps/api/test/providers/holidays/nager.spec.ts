import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProviderErrorCode } from '../../../src/providers/common/index.js';
import { NagerProvider } from '../../../src/providers/holidays/nager/nager.provider.js';
import { mapNagerHolidaysResponse } from '../../../src/providers/holidays/nager/nager.mapper.js';
import { jsonResponse, malformedJsonResponse, stubFetchSequence } from '../mock-fetch.js';
import { NO_RETRY_OPTIONS } from '../test-provider-config.js';

const RAW_HOLIDAY = { date: '2024-01-01', localName: 'Neujahr', name: "New Year's Day", countryCode: 'DE', global: true };

describe('Nager mapper', () => {
  it('normalizes a raw holiday', () => {
    expect(mapNagerHolidaysResponse([RAW_HOLIDAY])).toEqual({
      holidays: [{ date: '2024-01-01', localName: 'Neujahr', name: "New Year's Day", countryCode: 'DE', global: true }],
    });
  });

  it('normalizes an empty holiday list', () => {
    expect(mapNagerHolidaysResponse([])).toEqual({ holidays: [] });
  });

  it('throws PROVIDER_BAD_RESPONSE for a non-array response', () => {
    expect(() => mapNagerHolidaysResponse({} as never)).toThrowError(
      expect.objectContaining({ code: ProviderErrorCode.PROVIDER_BAD_RESPONSE }),
    );
  });

  it('throws PROVIDER_BAD_RESPONSE for a malformed holiday entry', () => {
    expect(() => mapNagerHolidaysResponse([{} as never])).toThrowError(
      expect.objectContaining({ code: ProviderErrorCode.PROVIDER_BAD_RESPONSE }),
    );
  });
});

describe('NagerProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches and normalizes public holidays', async () => {
    stubFetchSequence([jsonResponse(200, [RAW_HOLIDAY])]);
    const provider = new NagerProvider(NO_RETRY_OPTIONS);

    const result = await provider.getPublicHolidays({ year: 2024, countryCode: 'DE' });

    expect(result.holidays).toHaveLength(1);
  });

  it('returns an empty list for a country/year with no holidays', async () => {
    stubFetchSequence([jsonResponse(200, [])]);
    const provider = new NagerProvider(NO_RETRY_OPTIONS);

    expect(await provider.getPublicHolidays({ year: 2024, countryCode: 'ZZ' })).toEqual({ holidays: [] });
  });

  it('maps a malformed response to a provider error', async () => {
    stubFetchSequence([malformedJsonResponse()]);
    const provider = new NagerProvider(NO_RETRY_OPTIONS);

    await expect(provider.getPublicHolidays({ year: 2024, countryCode: 'DE' })).rejects.toMatchObject({
      code: ProviderErrorCode.PROVIDER_BAD_RESPONSE,
    });
  });

  it('surfaces PROVIDER_RATE_LIMITED for a 429 response', async () => {
    stubFetchSequence([jsonResponse(429, {})]);
    const provider = new NagerProvider(NO_RETRY_OPTIONS);

    await expect(provider.getPublicHolidays({ year: 2024, countryCode: 'DE' })).rejects.toMatchObject({
      code: ProviderErrorCode.PROVIDER_RATE_LIMITED,
    });
  });

  it('surfaces a normalized error for an upstream 5xx failure', async () => {
    stubFetchSequence([jsonResponse(503, {})]);
    const provider = new NagerProvider(NO_RETRY_OPTIONS);

    await expect(provider.getPublicHolidays({ year: 2024, countryCode: 'DE' })).rejects.toMatchObject({
      code: ProviderErrorCode.PROVIDER_UNAVAILABLE,
    });
  });

  it('reports health status from a probe request', async () => {
    stubFetchSequence([jsonResponse(200, [RAW_HOLIDAY])]);
    const provider = new NagerProvider(NO_RETRY_OPTIONS);

    const health = await provider.checkHealth();

    expect(health.healthy).toBe(true);
    expect(health.provider).toBe('holidays.nager');
  });
});
