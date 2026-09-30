import type { ProviderAdapter } from '../common/index.js';

export interface NewsArticle {
  title: string;
  url: string;
  source?: string;
  publishedAt?: string;
  language?: string;
  country?: string;
  sourceProvider: string;
}

export interface NewsSearchInput {
  query: string;
  limit?: number;
}

export interface NewsSearchResult {
  articles: NewsArticle[];
}

export interface NewsTrendPoint {
  date: string;
  volume: number;
}

export interface NewsTrendsInput {
  query: string;
  timespan?: string;
}

export interface NewsTrendsResult {
  term: string;
  points: NewsTrendPoint[];
}

/** A provider that can serve news search results. Every news provider implements at least this. */
export interface NewsSearchProvider extends ProviderAdapter {
  /** Whether this provider is usable at all - false for a fallback provider with no configured API key. Always true for a keyless provider like GDELT. */
  readonly isConfigured: boolean;
  search(input: NewsSearchInput): Promise<NewsSearchResult>;
}

/** A provider that can serve trend/volume time series. Not every news provider does - see the fallback providers under providers/news/, none of which implement this. */
export interface NewsTrendsProvider extends ProviderAdapter {
  getTrends(input: NewsTrendsInput): Promise<NewsTrendsResult>;
}

/** GDELT implements both; kept as a combined type since it's still the only trends source. */
export interface NewsProvider extends NewsSearchProvider, NewsTrendsProvider {}
