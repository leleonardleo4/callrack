export interface GNewsSource {
  id?: string;
  name?: string;
  url?: string;
  country?: string;
}

export interface GNewsArticle {
  title?: string;
  description?: string;
  content?: string;
  url?: string;
  image?: string;
  publishedAt?: string;
  lang?: string;
  source?: GNewsSource;
}

export interface GNewsSearchResponse {
  totalArticles?: number;
  articles?: GNewsArticle[];
}
