import { ProviderError, ProviderErrorCode } from '../../common/index.js';
import { extractDomain } from '../news.mapper.utils.js';
import type { NewsArticle, NewsSearchResult } from '../news.types.js';
import type { GNewsArticle, GNewsSearchResponse } from './gnews.types.js';

const PROVIDER_SLUG = 'news.gnews';

function mapGNewsArticle(raw: GNewsArticle, requestedLanguage: string | undefined): NewsArticle | undefined {
  if (typeof raw?.url !== 'string' || typeof raw?.title !== 'string') {
    return undefined;
  }
  return {
    title: raw.title,
    url: raw.url,
    source: raw.source?.name ?? (raw.source?.url ? extractDomain(raw.source.url) : extractDomain(raw.url)),
    publishedAt: raw.publishedAt,
    language: raw.lang ?? requestedLanguage,
    country: raw.source?.country,
    sourceProvider: 'gnews',
  };
}

export function mapGNewsSearchResponse(raw: GNewsSearchResponse, requestedLanguage?: string): NewsSearchResult {
  if (!raw || !Array.isArray(raw.articles)) {
    throw new ProviderError({
      code: ProviderErrorCode.PROVIDER_BAD_RESPONSE,
      message: 'GNews search response is missing an "articles" array',
      providerSlug: PROVIDER_SLUG,
    });
  }

  const articles = raw.articles
    .map((article) => mapGNewsArticle(article, requestedLanguage))
    .filter((article): article is NewsArticle => article !== undefined);
  return { articles };
}
