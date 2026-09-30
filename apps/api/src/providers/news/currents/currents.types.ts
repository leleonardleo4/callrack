export interface CurrentsArticle {
  id?: string;
  title?: string;
  description?: string;
  url?: string;
  author?: string;
  image?: string;
  language?: string;
  category?: string[];
  published?: string;
}

export interface CurrentsSearchResponse {
  status?: string;
  news?: CurrentsArticle[];
}
