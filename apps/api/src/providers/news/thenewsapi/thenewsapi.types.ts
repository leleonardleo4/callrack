export interface TheNewsApiArticle {
  uuid?: string;
  title?: string;
  description?: string;
  url?: string;
  image_url?: string;
  language?: string;
  published_at?: string;
  source?: string;
  locale?: string;
}

export interface TheNewsApiMeta {
  found?: number;
  returned?: number;
  limit?: number;
  page?: number;
}

export interface TheNewsApiSearchResponse {
  meta?: TheNewsApiMeta;
  data?: TheNewsApiArticle[];
}
