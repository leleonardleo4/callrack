import { afterEach, describe, expect, it, vi } from 'vitest';
import { BadGatewayException, GatewayTimeoutException } from '@nestjs/common';
import { WeatherService } from '../../src/weather/weather.service.js';
import { ProviderError, ProviderErrorCode } from '../../src/providers/common/index.js';
import type { WeatherData, WeatherProvider } from '../../src/providers/weather/weather.types.js';
import type { OpenMeteoProvider } from '../../src/providers/weather/openmeteo/openmeteo.provider.js';
import type { CapabilityCacheService } from '../../src/common/cache/index.js';
import type { RequestTrackingService } from '../../src/common/tracking/index.js';

function fakeOpenMeteo(): WeatherProvider & { getForecast: ReturnType<typeof vi.fn> } {
  return {
    metadata: { slug: 'weather.openmeteo', name: 'Open-Meteo', description: '', category: 'weather', website: '', attributionRequired: true },
    getForecast: vi.fn(),
    async checkHealth() {
      return { provider: 'weather.openmeteo', healthy: true };
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

const FORECAST: WeatherData = {
  latitude: 6.5244,
  longitude: 3.3792,
  timezone: 'Africa/Lagos',
  current: { time: '2026-09-16T12:00', temperatureC: 27.4, humidityPercent: 80, windSpeedKph: 12.4, precipitationMm: 0, weatherCode: 3 },
  daily: [{ time: '2026-09-16', temperatureC: 30.1, temperatureMinC: 24.0, weatherCode: 3 }],
};

describe('WeatherService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a normalized forecast for valid coordinates', async () => {
    const openMeteo = fakeOpenMeteo();
    openMeteo.getForecast.mockResolvedValue(FORECAST);
    const service = new WeatherService(openMeteo as unknown as OpenMeteoProvider, fakePassthroughCache(), fakeTracking());

    const result = await service.getForecast({ latitude: 6.5244, longitude: 3.3792 }, 'req_1');

    expect(result.location).toEqual({ latitude: 6.5244, longitude: 3.3792, timezone: 'Africa/Lagos' });
    expect(result.current?.temperature).toBe(27.4);
  });

  it('passes the requested number of days through to the provider, defaulting to 3', async () => {
    const openMeteo = fakeOpenMeteo();
    openMeteo.getForecast.mockResolvedValue(FORECAST);
    const service = new WeatherService(openMeteo as unknown as OpenMeteoProvider, fakePassthroughCache(), fakeTracking());

    await service.getForecast({ latitude: 1, longitude: 1 }, 'req_1');
    expect(openMeteo.getForecast).toHaveBeenCalledWith({ latitude: 1, longitude: 1, days: 3 });

    await service.getForecast({ latitude: 2, longitude: 2, days: 7 }, 'req_2');
    expect(openMeteo.getForecast).toHaveBeenCalledWith({ latitude: 2, longitude: 2, days: 7 });
  });

  it('maps a persistent PROVIDER_TIMEOUT to a 504 and records a TIMEOUT status', async () => {
    const openMeteo = fakeOpenMeteo();
    openMeteo.getForecast.mockRejectedValue(
      new ProviderError({ code: ProviderErrorCode.PROVIDER_TIMEOUT, message: 'timed out', providerSlug: 'weather.openmeteo' }),
    );
    const tracking = fakeTracking();
    const service = new WeatherService(openMeteo as unknown as OpenMeteoProvider, fakePassthroughCache(), tracking);

    await expect(service.getForecast({ latitude: 1, longitude: 1 }, 'req_1')).rejects.toBeInstanceOf(GatewayTimeoutException);
    expect(tracking.record).toHaveBeenCalledWith(expect.objectContaining({ status: 'TIMEOUT' }));
  });

  it('maps a provider failure to a 502', async () => {
    const openMeteo = fakeOpenMeteo();
    openMeteo.getForecast.mockRejectedValue(
      new ProviderError({ code: ProviderErrorCode.PROVIDER_UNAVAILABLE, message: 'down', providerSlug: 'weather.openmeteo' }),
    );
    const service = new WeatherService(openMeteo as unknown as OpenMeteoProvider, fakePassthroughCache(), fakeTracking());

    await expect(service.getForecast({ latitude: 1, longitude: 1 }, 'req_1')).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('is a cache miss then a cache hit for an identical request', async () => {
    const openMeteo = fakeOpenMeteo();
    openMeteo.getForecast.mockResolvedValue(FORECAST);
    const tracking = fakeTracking();
    const service = new WeatherService(openMeteo as unknown as OpenMeteoProvider, fakePassthroughCache(), tracking);

    await service.getForecast({ latitude: 6.5244, longitude: 3.3792 }, 'req_1');
    await service.getForecast({ latitude: 6.5244, longitude: 3.3792 }, 'req_2');

    expect(openMeteo.getForecast).toHaveBeenCalledTimes(1);
    expect(tracking.record).toHaveBeenNthCalledWith(1, expect.objectContaining({ cacheHit: false }));
    expect(tracking.record).toHaveBeenNthCalledWith(2, expect.objectContaining({ cacheHit: true }));
  });

  it('does not collide cache entries for different coordinates or day counts', async () => {
    const openMeteo = fakeOpenMeteo();
    openMeteo.getForecast.mockResolvedValue(FORECAST);
    const service = new WeatherService(openMeteo as unknown as OpenMeteoProvider, fakePassthroughCache(), fakeTracking());

    await service.getForecast({ latitude: 6.5244, longitude: 3.3792 }, 'req_1');
    await service.getForecast({ latitude: 6.5244, longitude: 3.3792, days: 7 }, 'req_2');
    await service.getForecast({ latitude: 1, longitude: 1 }, 'req_3');

    expect(openMeteo.getForecast).toHaveBeenCalledTimes(3);
  });
});
