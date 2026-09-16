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

export interface NewsProvider extends ProviderAdapter {
  search(input: NewsSearchInput): Promise<NewsSearchResult>;
  getTrends(input: NewsTrendsInput): Promise<NewsTrendsResult>;
}
