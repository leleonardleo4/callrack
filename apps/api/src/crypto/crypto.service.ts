import { Injectable } from '@nestjs/common';
import { mapProviderErrorToHttpException } from '../common/errors/index.js';
import { buildCacheKey, CACHE_TTL_SECONDS, CapabilityCacheService } from '../common/cache/index.js';
import { RequestTrackingService } from '../common/tracking/index.js';
import { ProviderError, ProviderErrorCode } from '../providers/common/index.js';
import { CoinGeckoProvider } from '../providers/crypto/coingecko/coingecko.provider.js';
import { toCryptoMarketResponse, toCryptoPriceResponse } from './crypto.mapper.js';
import type { CryptoAssetsRequestDto } from './dto/crypto-assets-request.dto.js';
import type { CryptoMarketResponseData, CryptoPriceResponseData } from './crypto-response.types.js';

const DEFAULT_CURRENCY = 'usd';

const PRICE_CAPABILITY = {
  slug: 'crypto-price',
  name: 'Crypto Price',
  endpoint: 'POST /v1/crypto/price',
};

const MARKET_CAPABILITY = {
  slug: 'crypto-market',
  name: 'Crypto Market',
  endpoint: 'POST /v1/crypto/market',
};

@Injectable()
export class CryptoService {
  constructor(
    private readonly coinGecko: CoinGeckoProvider,
    private readonly cache: CapabilityCacheService,
    private readonly tracking: RequestTrackingService,
  ) {}

  async getPrices(dto: CryptoAssetsRequestDto, requestId: string): Promise<CryptoPriceResponseData> {
    const { assets, currency } = this.normalize(dto);
    const cacheKey = buildCacheKey('crypto:price', { currency, assets: assets.join(',') });
    const startedAt = Date.now();

    try {
      const { value, cacheHit } = await this.cache.getOrSet(cacheKey, CACHE_TTL_SECONDS.CRYPTO_PRICE, async () => {
        const result = await this.coinGecko.getMarketData({ assetIds: assets, vsCurrency: currency });
        return toCryptoPriceResponse(result, assets);
      });

      this.tracking.record({
        requestId,
        endpoint: PRICE_CAPABILITY.endpoint,
        capabilitySlug: PRICE_CAPABILITY.slug,
        capabilityName: PRICE_CAPABILITY.name,
        providerSlug: cacheHit ? undefined : this.coinGecko.metadata.slug,
        status: 'SUCCESS',
        durationMs: Date.now() - startedAt,
        cacheHit,
      });

      return value;
    } catch (error) {
      this.tracking.record({
        requestId,
        endpoint: PRICE_CAPABILITY.endpoint,
        capabilitySlug: PRICE_CAPABILITY.slug,
        capabilityName: PRICE_CAPABILITY.name,
        status: this.classifyError(error),
        durationMs: Date.now() - startedAt,
        cacheHit: false,
      });

      if (error instanceof ProviderError) {
        throw mapProviderErrorToHttpException(error);
      }
      throw error;
    }
  }

  async getMarketData(dto: CryptoAssetsRequestDto, requestId: string): Promise<CryptoMarketResponseData> {
    const { assets, currency } = this.normalize(dto);
    const cacheKey = buildCacheKey('crypto:market', { currency, assets: assets.join(',') });
    const startedAt = Date.now();

    try {
      const { value, cacheHit } = await this.cache.getOrSet(cacheKey, CACHE_TTL_SECONDS.CRYPTO_MARKET, async () => {
        const result = await this.coinGecko.getMarketData({ assetIds: assets, vsCurrency: currency });
        return toCryptoMarketResponse(result, assets);
      });

      this.tracking.record({
        requestId,
        endpoint: MARKET_CAPABILITY.endpoint,
        capabilitySlug: MARKET_CAPABILITY.slug,
        capabilityName: MARKET_CAPABILITY.name,
        providerSlug: cacheHit ? undefined : this.coinGecko.metadata.slug,
        status: 'SUCCESS',
        durationMs: Date.now() - startedAt,
        cacheHit,
      });

      return value;
    } catch (error) {
      this.tracking.record({
        requestId,
        endpoint: MARKET_CAPABILITY.endpoint,
        capabilitySlug: MARKET_CAPABILITY.slug,
        capabilityName: MARKET_CAPABILITY.name,
        status: this.classifyError(error),
        durationMs: Date.now() - startedAt,
        cacheHit: false,
      });

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

  /** Dedupes and sorts assets so semantically identical requests share one cache entry. */
  private normalize(dto: CryptoAssetsRequestDto): { assets: string[]; currency: string } {
    return {
      assets: [...new Set(dto.assets)].sort(),
      currency: dto.currency ?? DEFAULT_CURRENCY,
    };
  }
}
