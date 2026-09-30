export interface NewsDataArticle {
  article_id?: string;
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
  image_url?: string;
  source_id?: string;
  source_name?: string;
  language?: string;
  country?: string[];
}

export interface NewsDataSearchResponse {
  status?: string;
  totalResults?: number;
  results?: NewsDataArticle[];
}
