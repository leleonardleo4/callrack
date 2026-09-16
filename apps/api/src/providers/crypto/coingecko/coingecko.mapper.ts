import { ProviderError, ProviderErrorCode } from '../../common/index.js';
import type { CryptoMarketDataResult, CryptoPriceResult } from '../crypto.types.js';
import type { CoinGeckoMarketCoin, CoinGeckoMarketsResponse, CoinGeckoSimplePriceResponse } from './coingecko.types.js';

const PROVIDER_SLUG = 'crypto.coingecko';

export function mapCoinGeckoPrices(
  raw: CoinGeckoSimplePriceResponse,
  vsCurrency: string,
): CryptoPriceResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ProviderError({
      code: ProviderErrorCode.PROVIDER_BAD_RESPONSE,
      message: 'CoinGecko simple price response was not an object',
      providerSlug: PROVIDER_SLUG,
    });
  }

  const prices: Record<string, number> = {};
  for (const [assetId, currencies] of Object.entries(raw)) {
    const price = currencies?.[vsCurrency];
    if (typeof price === 'number') {
      prices[assetId] = price;
    }
  }

  return { vsCurrency, prices };
}

function mapCoinGeckoMarketCoin(raw: CoinGeckoMarketCoin, vsCurrency: string): CryptoMarketDataResult['markets'][number] {
  if (!raw || typeof raw.id !== 'string' || typeof raw.symbol !== 'string' || typeof raw.name !== 'string') {
    throw new ProviderError({
      code: ProviderErrorCode.PROVIDER_BAD_RESPONSE,
      message: 'CoinGecko market entry is missing required fields (id, symbol, name)',
      providerSlug: PROVIDER_SLUG,
    });
  }

  return {
    asset: { id: raw.id, symbol: raw.symbol, name: raw.name, sourceProvider: 'coingecko' },
    vsCurrency,
    price: raw.current_price,
    marketCap: raw.market_cap,
    volume24h: raw.total_volume,
    changePercent24h: raw.price_change_percentage_24h,
  };
}

export function mapCoinGeckoMarkets(raw: CoinGeckoMarketsResponse, vsCurrency: string): CryptoMarketDataResult {
  if (!Array.isArray(raw)) {
    throw new ProviderError({
      code: ProviderErrorCode.PROVIDER_BAD_RESPONSE,
      message: 'CoinGecko markets response was not an array',
      providerSlug: PROVIDER_SLUG,
    });
  }

  return { markets: raw.map((coin) => mapCoinGeckoMarketCoin(coin, vsCurrency)) };
}
