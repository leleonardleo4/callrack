export interface GdeltArticle {
  url?: string;
  title?: string;
  seendate?: string;
  domain?: string;
  language?: string;
  sourcecountry?: string;
}

export interface GdeltArticleListResponse {
  articles?: GdeltArticle[];
}

export interface GdeltTimelineDataPoint {
  date?: string;
  value?: number;
}

export interface GdeltTimelineSeries {
  series?: string;
  data?: GdeltTimelineDataPoint[];
}

export interface GdeltTimelineResponse {
  timeline?: GdeltTimelineSeries[];
}
