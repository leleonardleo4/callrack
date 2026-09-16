import type { NewsSearchResult, NewsTrendsResult } from '../providers/news/news.types.js';
import type { NewsSearchResponseData, NewsTrendsResponseData } from './news-response.types.js';

/**
 * Normalizes GDELT's already-clean domain types into Callrack's public news
 * contracts. No `snippet`/description field is included — GDELT's article
 * list mode doesn't provide one, and this layer never fabricates data.
 */
export function toNewsSearchResponse(result: NewsSearchResult): NewsSearchResponseData {
  return {
    results: result.articles.map((article) => ({
      title: article.title,
      url: article.url,
      source: article.source ?? null,
      publishedAt: article.publishedAt ?? null,
      language: article.language ?? null,
      country: article.country ?? null,
    })),
  };
}

export function toNewsTrendsResponse(result: NewsTrendsResult): NewsTrendsResponseData {
  return {
    term: result.term,
    points: result.points.map((point) => ({ date: point.date, volume: point.volume })),
  };
}
