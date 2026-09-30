import { ProviderError, ProviderErrorCode } from '../../common/index.js';
import type { NewsArticle, NewsSearchResult } from '../news.types.js';
import type { NewsDataArticle, NewsDataSearchResponse } from './newsdata.types.js';

const PROVIDER_SLUG = 'news.newsdata';

function mapNewsDataArticle(raw: NewsDataArticle): NewsArticle | undefined {
  if (typeof raw?.link !== 'string' || typeof raw?.title !== 'string') {
    return undefined;
  }
  return {
    title: raw.title,
    url: raw.link,
    source: raw.source_name ?? raw.source_id,
    publishedAt: raw.pubDate,
    language: raw.language,
    country: raw.country?.[0],
    sourceProvider: 'newsdata',
  };
}

export function mapNewsDataSearchResponse(raw: NewsDataSearchResponse): NewsSearchResult {
  if (!raw || !Array.isArray(raw.results)) {
    throw new ProviderError({
      code: ProviderErrorCode.PROVIDER_BAD_RESPONSE,
      message: 'NewsData.io search response is missing a "results" array',
      providerSlug: PROVIDER_SLUG,
    });
  }

  const articles = raw.results
    .map(mapNewsDataArticle)
    .filter((article): article is NewsArticle => article !== undefined);
  return { articles };
}
