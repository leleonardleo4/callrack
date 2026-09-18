import type { CryptoMarketDataResult, CryptoMarketDatum } from '../providers/crypto/crypto.types.js';
import type { CryptoMarketEntry, CryptoMarketResponseData, CryptoPriceEntry, CryptoPriceResponseData } from './crypto-response.types.js';

/**
 * Both /crypto/price and /crypto/market are built from the same underlying
 * CoinGecko "markets" call (the only Phase 3 operation that reliably returns
 * price + symbol + 24h change together) - price exposes a slim subset,
 * market exposes the full normalized dataset.
 */
function findMissingAssets(requestedAssetIds: string[], markets: CryptoMarketDatum[]): string[] {
  const found = new Set(markets.map((datum) => datum.asset.id));
  return requestedAssetIds.filter((id) => !found.has(id));
}

export function toCryptoPriceResponse(
  result: CryptoMarketDataResult,
  requestedAssetIds: string[],
): CryptoPriceResponseData {
  const assets: CryptoPriceEntry[] = result.markets.map((datum) => ({
    id: datum.asset.id,
    symbol: datum.asset.symbol,
    price: datum.price ?? null,
    currency: datum.vsCurrency,
    change24h: datum.changePercent24h ?? null,
  }));

  return { assets, missing: findMissingAssets(requestedAssetIds, result.markets) };
}

export function toCryptoMarketResponse(
  result: CryptoMarketDataResult,
  requestedAssetIds: string[],
): CryptoMarketResponseData {
  const markets: CryptoMarketEntry[] = result.markets.map((datum) => ({
    id: datum.asset.id,
    symbol: datum.asset.symbol,
    name: datum.asset.name,
    price: datum.price ?? null,
    currency: datum.vsCurrency,
    marketCap: datum.marketCap ?? null,
    marketCapRank: datum.marketCapRank ?? null,
    volume24h: datum.volume24h ?? null,
    change24h: datum.changePercent24h ?? null,
    circulatingSupply: datum.circulatingSupply ?? null,
    totalSupply: datum.totalSupply ?? null,
    maxSupply: datum.maxSupply ?? null,
  }));

  return { markets, missing: findMissingAssets(requestedAssetIds, result.markets) };
}
