export interface MediastackArticle {
  author?: string;
  title?: string;
  description?: string;
  url?: string;
  source?: string;
  image?: string;
  category?: string;
  language?: string;
  country?: string;
  published_at?: string;
}

export interface MediastackSearchResponse {
  pagination?: { limit?: number; offset?: number; count?: number; total?: number };
  data?: MediastackArticle[];
}
