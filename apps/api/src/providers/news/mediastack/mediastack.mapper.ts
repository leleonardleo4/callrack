import { ProviderError, ProviderErrorCode } from '../../common/index.js';
import { extractDomain } from '../news.mapper.utils.js';
import type { NewsArticle, NewsSearchResult } from '../news.types.js';
import type { MediastackArticle, MediastackSearchResponse } from './mediastack.types.js';

const PROVIDER_SLUG = 'news.mediastack';

function mapMediastackArticle(raw: MediastackArticle): NewsArticle | undefined {
  if (typeof raw?.url !== 'string' || typeof raw?.title !== 'string') {
    return undefined;
  }
  return {
    title: raw.title,
    url: raw.url,
    source: raw.source ?? extractDomain(raw.url),
    publishedAt: raw.published_at,
    language: raw.language,
    country: raw.country,
    sourceProvider: 'mediastack',
  };
}

export function mapMediastackSearchResponse(raw: MediastackSearchResponse): NewsSearchResult {
  if (!raw || !Array.isArray(raw.data)) {
    throw new ProviderError({
      code: ProviderErrorCode.PROVIDER_BAD_RESPONSE,
      message: 'Mediastack search response is missing a "data" array',
      providerSlug: PROVIDER_SLUG,
    });
  }

  const articles = raw.data
    .map(mapMediastackArticle)
    .filter((article): article is NewsArticle => article !== undefined);
  return { articles };
}
