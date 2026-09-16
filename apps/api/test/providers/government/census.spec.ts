import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProviderErrorCode } from '../../../src/providers/common/index.js';
import { CensusProvider } from '../../../src/providers/government/census/census.provider.js';
import { mapCensusResponse } from '../../../src/providers/government/census/census.mapper.js';
import { jsonResponse, malformedJsonResponse, stubFetchSequence } from '../mock-fetch.js';
import { createTestProviderConfig, NO_RETRY_OPTIONS } from '../test-provider-config.js';

const RAW_TABLE = [
  ['NAME', 'B01001_001E', 'state'],
  ['Alabama', '4921532', '01'],
];

describe('Census mapper', () => {
  it('normalizes a header-first table into rows', () => {
    const result = mapCensusResponse(RAW_TABLE, 'acs/acs1');
    expect(result).toEqual({
      dataset: 'acs/acs1',
      columns: ['NAME', 'B01001_001E', 'state'],
      rows: [{ NAME: 'Alabama', B01001_001E: '4921532', state: '01' }],
    });
  });

  it('normalizes a header-only (empty) table', () => {
    expect(mapCensusResponse([['NAME', 'state']], 'acs/acs1')).toEqual({
      dataset: 'acs/acs1',
      columns: ['NAME', 'state'],
      rows: [],
    });
  });

  it('throws PROVIDER_BAD_RESPONSE for a non-array response', () => {
    expect(() => mapCensusResponse({} as never, 'acs/acs1')).toThrowError(
      expect.objectContaining({ code: ProviderErrorCode.PROVIDER_BAD_RESPONSE }),
    );
  });

  it('throws PROVIDER_BAD_RESPONSE when a row length mismatches the header', () => {
    expect(() => mapCensusResponse([['NAME', 'state'], ['Alabama']], 'acs/acs1')).toThrowError(
      expect.objectContaining({ code: ProviderErrorCode.PROVIDER_BAD_RESPONSE }),
    );
  });
});

describe('CensusProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('queries and normalizes a dataset', async () => {
    stubFetchSequence([jsonResponse(200, RAW_TABLE)]);
    const provider = new CensusProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    const result = await provider.query({
      dataset: 'acs/acs1',
      year: '2021',
      variables: ['NAME', 'B01001_001E'],
      forGeography: 'state:01',
    });

    expect(result.rows).toHaveLength(1);
  });

  it('returns no rows for a header-only response', async () => {
    stubFetchSequence([jsonResponse(200, [['NAME', 'state']])]);
    const provider = new CensusProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    const result = await provider.query({
      dataset: 'acs/acs1',
      year: '2021',
      variables: ['NAME'],
      forGeography: 'state:99',
    });

    expect(result.rows).toEqual([]);
  });

  it('maps a malformed response to a provider error', async () => {
    stubFetchSequence([malformedJsonResponse()]);
    const provider = new CensusProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    await expect(
      provider.query({ dataset: 'acs/acs1', year: '2021', variables: ['NAME'], forGeography: 'state:01' }),
    ).rejects.toMatchObject({ code: ProviderErrorCode.PROVIDER_BAD_RESPONSE });
  });

  it('surfaces PROVIDER_RATE_LIMITED for a 429 response', async () => {
    stubFetchSequence([jsonResponse(429, {})]);
    const provider = new CensusProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    await expect(
      provider.query({ dataset: 'acs/acs1', year: '2021', variables: ['NAME'], forGeography: 'state:01' }),
    ).rejects.toMatchObject({ code: ProviderErrorCode.PROVIDER_RATE_LIMITED });
  });

  it('surfaces a normalized error for an upstream 5xx failure', async () => {
    stubFetchSequence([jsonResponse(503, {})]);
    const provider = new CensusProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    await expect(
      provider.query({ dataset: 'acs/acs1', year: '2021', variables: ['NAME'], forGeography: 'state:01' }),
    ).rejects.toMatchObject({ code: ProviderErrorCode.PROVIDER_UNAVAILABLE });
  });

  it('reports health status from a probe request', async () => {
    stubFetchSequence([jsonResponse(200, RAW_TABLE)]);
    const provider = new CensusProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    const health = await provider.checkHealth();

    expect(health.healthy).toBe(true);
    expect(health.provider).toBe('government.census');
  });
});
