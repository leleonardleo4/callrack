export interface CryptoPriceEntry {
  id: string;
  symbol: string;
  price: number | null;
  currency: string;
  change24h: number | null;
}

export interface CryptoPriceResponseData {
  assets: CryptoPriceEntry[];
  /** Requested asset ids CoinGecko did not recognize (never silently dropped). */
  missing: string[];
}

export interface CryptoMarketEntry {
  id: string;
  symbol: string;
  name: string;
  price: number | null;
  currency: string;
  marketCap: number | null;
  marketCapRank: number | null;
  volume24h: number | null;
  change24h: number | null;
  circulatingSupply: number | null;
  totalSupply: number | null;
  maxSupply: number | null;
}

export interface CryptoMarketResponseData {
  markets: CryptoMarketEntry[];
  /** Requested asset ids CoinGecko did not recognize (never silently dropped). */
  missing: string[];
}
