import { BadRequestException, Injectable } from '@nestjs/common';
import { ApiErrorCode, mapProviderErrorToHttpException } from '../common/errors/index.js';
import { buildCacheKey, CACHE_TTL_SECONDS, CapabilityCacheService } from '../common/cache/index.js';
import { RequestTrackingService } from '../common/tracking/index.js';
import { ProviderError, ProviderErrorCode } from '../providers/common/index.js';
import { FrankfurterProvider } from '../providers/fx/frankfurter/frankfurter.provider.js';
import type { FxRates } from '../providers/fx/fx.types.js';
import { buildFxRatesResponse, UnsupportedCurrencyError } from './fx.mapper.js';
import type { FxRatesRequestDto } from './dto/fx-rates-request.dto.js';
import type { FxRatesResponseData } from './fx-response.types.js';

const RATES_CAPABILITY = {
  slug: 'fx-rates',
  name: 'FX Rates',
  endpoint: 'POST /v1/fx/rates',
};

@Injectable()
export class FxService {
  constructor(
    private readonly frankfurter: FrankfurterProvider,
    private readonly cache: CapabilityCacheService,
    private readonly tracking: RequestTrackingService,
  ) {}

  async getRates(dto: FxRatesRequestDto, requestId: string): Promise<FxRatesResponseData> {
    const currencies = [...new Set(dto.currencies)].sort();
    const cacheNamespace = dto.date ? 'fx:historical' : 'fx:current';
    const ttl = dto.date ? CACHE_TTL_SECONDS.FX_HISTORICAL : CACHE_TTL_SECONDS.FX_CURRENT;
    const cacheKey = buildCacheKey(cacheNamespace, {
      base: dto.base,
      currencies: currencies.join(','),
      date: dto.date,
    });
    const startedAt = Date.now();

    try {
      const { value, cacheHit } = await this.cache.getOrSet(cacheKey, ttl, async () => {
        const rates = await this.fetchRates(dto.base, currencies, dto.date);
        return buildFxRatesResponse(rates, currencies);
      });

      this.tracking.record({
        requestId,
        endpoint: RATES_CAPABILITY.endpoint,
        capabilitySlug: RATES_CAPABILITY.slug,
        capabilityName: RATES_CAPABILITY.name,
        providerSlug: cacheHit ? undefined : this.frankfurter.metadata.slug,
        status: 'SUCCESS',
        durationMs: Date.now() - startedAt,
        cacheHit,
      });

      return value;
    } catch (error) {
      this.tracking.record({
        requestId,
        endpoint: RATES_CAPABILITY.endpoint,
        capabilitySlug: RATES_CAPABILITY.slug,
        capabilityName: RATES_CAPABILITY.name,
        status: this.classifyError(error),
        durationMs: Date.now() - startedAt,
        cacheHit: false,
      });

      if (error instanceof UnsupportedCurrencyError) {
        throw new BadRequestException({ code: ApiErrorCode.INVALID_REQUEST, message: error.message });
      }
      if (error instanceof ProviderError) {
        throw mapProviderErrorToHttpException(error);
      }
      throw error;
    }
  }

  private classifyError(error: unknown): 'ERROR' | 'TIMEOUT' {
    return error instanceof ProviderError && error.code === ProviderErrorCode.PROVIDER_TIMEOUT
      ? 'TIMEOUT'
      : 'ERROR';
  }

  /**
   * Frankfurter never echoes the base currency back inside its own `rates`
   * map, so a trivial self-rate of 1 is injected here when the caller
   * explicitly asked for it. If the base is the *only* requested currency,
   * no upstream call is needed at all.
   */
  private async fetchRates(base: string, currencies: string[], date?: string): Promise<FxRates> {
    const symbols = currencies.filter((code) => code !== base);

    if (symbols.length === 0) {
      return { base, date: date ?? new Date().toISOString().slice(0, 10), rates: { [base]: 1 } };
    }

    const rates = date
      ? await this.frankfurter.getHistoricalRates({ base, symbols, date })
      : await this.frankfurter.getCurrentRates({ base, symbols });

    if (currencies.includes(base)) {
      return { ...rates, rates: { ...rates.rates, [base]: 1 } };
    }
    return rates;
  }
}
