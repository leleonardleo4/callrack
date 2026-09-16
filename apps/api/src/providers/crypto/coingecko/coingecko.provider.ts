import { Injectable, Optional } from '@nestjs/common';
import {
  BaseProviderAdapter,
  defineProviderMetadata,
  ProviderConfigService,
  ProviderHttpClient,
  type ProviderAdapterOptions,
  type ProviderMetadata,
} from '../../common/index.js';
import type {
  CryptoMarketDataInput,
  CryptoMarketDataResult,
  CryptoPriceInput,
  CryptoPriceResult,
  CryptoProvider,
} from '../crypto.types.js';
import { mapCoinGeckoMarkets, mapCoinGeckoPrices } from './coingecko.mapper.js';
import type { CoinGeckoMarketsResponse, CoinGeckoSimplePriceResponse } from './coingecko.types.js';

const PROVIDER_SLUG = 'crypto.coingecko';
const DEFAULT_VS_CURRENCY = 'usd';

@Injectable()
export class CoinGeckoProvider extends BaseProviderAdapter implements CryptoProvider {
  readonly metadata: ProviderMetadata = defineProviderMetadata({
    slug: PROVIDER_SLUG,
    name: 'CoinGecko',
    description: 'Cryptocurrency price and market data.',
    category: 'crypto',
    website: 'https://www.coingecko.com',
    attributionRequired: true,
    attributionText: 'Data provided by CoinGecko (coingecko.com)',
    commercialUse: 'restricted',
  });

  private readonly apiKey: string | undefined;

  constructor(config: ProviderConfigService, @Optional() options?: ProviderAdapterOptions) {
    super(
      new ProviderHttpClient({
        providerSlug: PROVIDER_SLUG,
        baseUrl: 'https://api.coingecko.com/api/v3',
        timeoutMs: options?.timeoutMs,
        retry: options?.retry,
      }),
    );
    this.apiKey = config.coinGeckoApiKey;
  }

  private authHeaders(): Record<string, string> {
    return this.apiKey ? { 'x-cg-demo-api-key': this.apiKey } : {};
  }

  async getPrices(input: CryptoPriceInput): Promise<CryptoPriceResult> {
    const vsCurrency = input.vsCurrency ?? DEFAULT_VS_CURRENCY;
    const raw = await this.http.requestJson<CoinGeckoSimplePriceResponse>({
      path: 'simple/price',
      query: { ids: input.assetIds.join(','), vs_currencies: vsCurrency },
      headers: this.authHeaders(),
    });
    return mapCoinGeckoPrices(raw, vsCurrency);
  }

  async getMarketData(input: CryptoMarketDataInput): Promise<CryptoMarketDataResult> {
    const vsCurrency = input.vsCurrency ?? DEFAULT_VS_CURRENCY;
    const raw = await this.http.requestJson<CoinGeckoMarketsResponse>({
      path: 'coins/markets',
      query: { vs_currency: vsCurrency, ids: input.assetIds.join(',') },
      headers: this.authHeaders(),
    });
    return mapCoinGeckoMarkets(raw, vsCurrency);
  }

  protected async probeHealth(): Promise<unknown> {
    return this.http.requestJson({
      path: 'ping',
      headers: this.authHeaders(),
    });
  }
}
