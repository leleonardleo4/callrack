import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProviderErrorCode } from '../../../src/providers/common/index.js';
import { PhotonProvider } from '../../../src/providers/geocode/photon/photon.provider.js';
import { mapPhotonResponse } from '../../../src/providers/geocode/photon/photon.mapper.js';
import { jsonResponse, malformedJsonResponse, stubFetchSequence } from '../mock-fetch.js';
import { createTestProviderConfig, NO_RETRY_OPTIONS } from '../test-provider-config.js';

const RAW_FEATURE = {
  geometry: { coordinates: [13.4, 52.5] },
  properties: { name: 'Berlin', city: 'Berlin', country: 'Germany' },
};

describe('Photon mapper', () => {
  it('normalizes a feature into a GeoLocation', () => {
    const result = mapPhotonResponse({ features: [RAW_FEATURE] });
    expect(result.locations[0]).toEqual({
      latitude: 52.5,
      longitude: 13.4,
      label: 'Berlin, Germany',
      name: 'Berlin',
      city: 'Berlin',
      country: 'Germany',
    });
  });

  it('normalizes an empty feature list', () => {
    expect(mapPhotonResponse({ features: [] })).toEqual({ locations: [] });
  });

  it('throws PROVIDER_BAD_RESPONSE when "features" is missing', () => {
    expect(() => mapPhotonResponse({} as never)).toThrowError(
      expect.objectContaining({ code: ProviderErrorCode.PROVIDER_BAD_RESPONSE }),
    );
  });
});

describe('PhotonProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('forward-geocodes and normalizes results', async () => {
    stubFetchSequence([jsonResponse(200, { features: [RAW_FEATURE] })]);
    const provider = new PhotonProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    const result = await provider.forward({ query: 'Berlin' });

    expect(result.locations).toHaveLength(1);
  });

  it('uses the configured base URL (self-hosted override)', async () => {
    const fetchMock = stubFetchSequence([jsonResponse(200, { features: [] })]);
    const provider = new PhotonProvider(
      createTestProviderConfig({ PHOTON_BASE_URL: 'https://internal-geocoder.example.test' }),
      NO_RETRY_OPTIONS,
    );

    await provider.forward({ query: 'Berlin' });

    const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(calledUrl.startsWith('https://internal-geocoder.example.test/')).toBe(true);
  });

  it('reverse-geocodes and returns an empty result set for no matches', async () => {
    stubFetchSequence([jsonResponse(200, { features: [] })]);
    const provider = new PhotonProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    expect(await provider.reverse({ latitude: 0, longitude: 0 })).toEqual({ locations: [] });
  });

  it('maps a malformed response to a provider error', async () => {
    stubFetchSequence([malformedJsonResponse()]);
    const provider = new PhotonProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    await expect(provider.forward({ query: 'x' })).rejects.toMatchObject({
      code: ProviderErrorCode.PROVIDER_BAD_RESPONSE,
    });
  });

  it('surfaces PROVIDER_RATE_LIMITED for a 429 response', async () => {
    stubFetchSequence([jsonResponse(429, {})]);
    const provider = new PhotonProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    await expect(provider.forward({ query: 'x' })).rejects.toMatchObject({
      code: ProviderErrorCode.PROVIDER_RATE_LIMITED,
    });
  });

  it('surfaces a normalized error for an upstream 5xx failure', async () => {
    stubFetchSequence([jsonResponse(503, {})]);
    const provider = new PhotonProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    await expect(provider.reverse({ latitude: 0, longitude: 0 })).rejects.toMatchObject({
      code: ProviderErrorCode.PROVIDER_UNAVAILABLE,
    });
  });

  it('reports health status from a probe request', async () => {
    stubFetchSequence([jsonResponse(200, { features: [] })]);
    const provider = new PhotonProvider(createTestProviderConfig(), NO_RETRY_OPTIONS);

    const health = await provider.checkHealth();

    expect(health.healthy).toBe(true);
    expect(health.provider).toBe('geocode.photon');
  });
});
