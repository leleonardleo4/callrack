export interface NewsArticleResponse {
  title: string;
  url: string;
  source: string | null;
  publishedAt: string | null;
  language: string | null;
  country: string | null;
}

export interface NewsSearchResponseData {
  results: NewsArticleResponse[];
}

export interface NewsTrendPointResponse {
  date: string;
  volume: number;
}

export interface NewsTrendsResponseData {
  term: string;
  points: NewsTrendPointResponse[];
}
