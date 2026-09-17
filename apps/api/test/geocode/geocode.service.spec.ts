import { afterEach, describe, expect, it, vi } from 'vitest';
import { BadGatewayException } from '@nestjs/common';
import { GeocodeService } from '../../src/geocode/geocode.service.js';
import { ProviderError, ProviderErrorCode } from '../../src/providers/common/index.js';
import type { GeocodeProvider } from '../../src/providers/geocode/geocode.types.js';
import type { PhotonProvider } from '../../src/providers/geocode/photon/photon.provider.js';
import type { CapabilityCacheService } from '../../src/common/cache/index.js';
import type { RequestTrackingService } from '../../src/common/tracking/index.js';

function fakePhoton(): GeocodeProvider & { forward: ReturnType<typeof vi.fn>; reverse: ReturnType<typeof vi.fn> } {
  return {
    metadata: { slug: 'geocode.photon', name: 'Photon', description: '', category: 'geocode', website: '', attributionRequired: true },
    forward: vi.fn(),
    reverse: vi.fn(),
    async checkHealth() {
      return { provider: 'geocode.photon', healthy: true };
    },
  };
}

function fakePassthroughCache(): CapabilityCacheService {
  const store = new Map<string, unknown>();
  return {
    async getOrSet<T>(key: string, _ttl: number, loader: () => Promise<T>) {
      if (store.has(key)) {
        return { value: store.get(key) as T, cacheHit: true };
      }
      const value = await loader();
      store.set(key, value);
      return { value, cacheHit: false };
    },
  } as unknown as CapabilityCacheService;
}

function fakeTracking(): RequestTrackingService & { record: ReturnType<typeof vi.fn> } {
  return { record: vi.fn() } as unknown as RequestTrackingService & { record: ReturnType<typeof vi.fn> };
}

const LAGOS_RESULT = {
  locations: [{ id: '1', latitude: 6.45, longitude: 3.39, label: 'Lagos, Nigeria', name: 'Lagos', city: 'Lagos', country: 'Nigeria' }],
};

describe('GeocodeService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('forward mode', () => {
    it('returns normalized results for a valid query', async () => {
      const photon = fakePhoton();
      photon.forward.mockResolvedValue(LAGOS_RESULT);
      const service = new GeocodeService(photon as unknown as PhotonProvider, fakePassthroughCache(), fakeTracking());

      const result = await service.geocode({ mode: 'forward', query: 'Lagos, Nigeria' }, 'req_1');

      expect(result.results[0]).toMatchObject({ name: 'Lagos', city: 'Lagos', country: 'Nigeria' });
      expect(photon.reverse).not.toHaveBeenCalled();
    });

    it('returns an empty result set without error when nothing matches', async () => {
      const photon = fakePhoton();
      photon.forward.mockResolvedValue({ locations: [] });
      const service = new GeocodeService(photon as unknown as PhotonProvider, fakePassthroughCache(), fakeTracking());

      const result = await service.geocode({ mode: 'forward', query: 'zzz-nowhere' }, 'req_1');

      expect(result).toEqual({ results: [] });
    });

    it('shares a cache entry across harmless whitespace/casing differences', async () => {
      const photon = fakePhoton();
      photon.forward.mockResolvedValue(LAGOS_RESULT);
      const service = new GeocodeService(photon as unknown as PhotonProvider, fakePassthroughCache(), fakeTracking());

      await service.geocode({ mode: 'forward', query: 'Lagos  Nigeria' }, 'req_1');
      await service.geocode({ mode: 'forward', query: 'lagos nigeria' }, 'req_2');

      expect(photon.forward).toHaveBeenCalledTimes(1);
    });

    it('does not collide cache entries for a different limit', async () => {
      const photon = fakePhoton();
      photon.forward.mockResolvedValue(LAGOS_RESULT);
      const service = new GeocodeService(photon as unknown as PhotonProvider, fakePassthroughCache(), fakeTracking());

      await service.geocode({ mode: 'forward', query: 'Lagos' }, 'req_1');
      await service.geocode({ mode: 'forward', query: 'Lagos', limit: 10 }, 'req_2');

      expect(photon.forward).toHaveBeenCalledTimes(2);
    });

    it('maps a provider failure to a 502', async () => {
      const photon = fakePhoton();
      photon.forward.mockRejectedValue(
        new ProviderError({ code: ProviderErrorCode.PROVIDER_UNAVAILABLE, message: 'down', providerSlug: 'geocode.photon' }),
      );
      const service = new GeocodeService(photon as unknown as PhotonProvider, fakePassthroughCache(), fakeTracking());

      await expect(service.geocode({ mode: 'forward', query: 'x' }, 'req_1')).rejects.toBeInstanceOf(BadGatewayException);
    });
  });

  describe('reverse mode', () => {
    it('returns a normalized result for valid coordinates', async () => {
      const photon = fakePhoton();
      photon.reverse.mockResolvedValue(LAGOS_RESULT);
      const service = new GeocodeService(photon as unknown as PhotonProvider, fakePassthroughCache(), fakeTracking());

      const result = await service.geocode({ mode: 'reverse', latitude: 6.5244, longitude: 3.3792 }, 'req_1');

      expect(result.results[0]).toMatchObject({ name: 'Lagos' });
      expect(photon.forward).not.toHaveBeenCalled();
    });

    it('does not collide cache entries for different coordinates', async () => {
      const photon = fakePhoton();
      photon.reverse.mockResolvedValue(LAGOS_RESULT);
      const service = new GeocodeService(photon as unknown as PhotonProvider, fakePassthroughCache(), fakeTracking());

      await service.geocode({ mode: 'reverse', latitude: 6.5244, longitude: 3.3792 }, 'req_1');
      await service.geocode({ mode: 'reverse', latitude: 51.5, longitude: -0.12 }, 'req_2');

      expect(photon.reverse).toHaveBeenCalledTimes(2);
    });

    it('is a cache miss then a cache hit for identical coordinates', async () => {
      const photon = fakePhoton();
      photon.reverse.mockResolvedValue(LAGOS_RESULT);
      const tracking = fakeTracking();
      const service = new GeocodeService(photon as unknown as PhotonProvider, fakePassthroughCache(), tracking);

      await service.geocode({ mode: 'reverse', latitude: 6.5244, longitude: 3.3792 }, 'req_1');
      await service.geocode({ mode: 'reverse', latitude: 6.5244, longitude: 3.3792 }, 'req_2');

      expect(photon.reverse).toHaveBeenCalledTimes(1);
      expect(tracking.record).toHaveBeenNthCalledWith(2, expect.objectContaining({ cacheHit: true }));
    });

    it('maps a provider failure to a 502', async () => {
      const photon = fakePhoton();
      photon.reverse.mockRejectedValue(
        new ProviderError({ code: ProviderErrorCode.PROVIDER_UNAVAILABLE, message: 'down', providerSlug: 'geocode.photon' }),
      );
      const service = new GeocodeService(photon as unknown as PhotonProvider, fakePassthroughCache(), fakeTracking());

      await expect(
        service.geocode({ mode: 'reverse', latitude: 6.5244, longitude: 3.3792 }, 'req_1'),
      ).rejects.toBeInstanceOf(BadGatewayException);
    });
  });

  it('does not collide cache entries between forward and reverse modes', async () => {
    const photon = fakePhoton();
    photon.forward.mockResolvedValue(LAGOS_RESULT);
    photon.reverse.mockResolvedValue(LAGOS_RESULT);
    const service = new GeocodeService(photon as unknown as PhotonProvider, fakePassthroughCache(), fakeTracking());

    await service.geocode({ mode: 'forward', query: 'Lagos' }, 'req_1');
    await service.geocode({ mode: 'reverse', latitude: 6.5244, longitude: 3.3792 }, 'req_2');

    expect(photon.forward).toHaveBeenCalledTimes(1);
    expect(photon.reverse).toHaveBeenCalledTimes(1);
  });
});
