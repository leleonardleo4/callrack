import type { ProviderAdapter } from '../common/index.js';

export interface CryptoAsset {
  id: string;
  symbol: string;
  name: string;
  sourceProvider: string;
}

export interface CryptoPriceInput {
  assetIds: string[];
  vsCurrency?: string;
}

export interface CryptoPriceResult {
  vsCurrency: string;
  prices: Record<string, number>;
}

export interface CryptoMarketDataInput {
  assetIds: string[];
  vsCurrency?: string;
}

export interface CryptoMarketDatum {
  asset: CryptoAsset;
  vsCurrency: string;
  price?: number;
  marketCap?: number;
  volume24h?: number;
  changePercent24h?: number;
}

export interface CryptoMarketDataResult {
  markets: CryptoMarketDatum[];
}

export interface CryptoProvider extends ProviderAdapter {
  getPrices(input: CryptoPriceInput): Promise<CryptoPriceResult>;
  getMarketData(input: CryptoMarketDataInput): Promise<CryptoMarketDataResult>;
}
