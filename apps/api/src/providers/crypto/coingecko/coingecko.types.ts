export type CoinGeckoSimplePriceResponse = Record<string, Record<string, number>>;

export interface CoinGeckoMarketCoin {
  id?: string;
  symbol?: string;
  name?: string;
  current_price?: number;
  market_cap?: number;
  total_volume?: number;
  price_change_percentage_24h?: number;
}

export type CoinGeckoMarketsResponse = CoinGeckoMarketCoin[];
