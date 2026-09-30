import { ProviderError, ProviderErrorCode } from '../../common/index.js';
import { extractDomain } from '../news.mapper.utils.js';
import type { NewsArticle, NewsSearchResult } from '../news.types.js';
import type { CurrentsArticle, CurrentsSearchResponse } from './currents.types.js';

const PROVIDER_SLUG = 'news.currents';

function mapCurrentsArticle(raw: CurrentsArticle): NewsArticle | undefined {
  if (typeof raw?.url !== 'string' || typeof raw?.title !== 'string') {
    return undefined;
  }
  return {
    title: raw.title,
    url: raw.url,
    source: extractDomain(raw.url),
    publishedAt: raw.published,
    language: raw.language,
    country: undefined,
    sourceProvider: 'currents',
  };
}

/**
 * Currents doesn't provide a domain/country field per article the way GDELT
 * does - malformed individual entries (missing url/title) are dropped rather
 * than failing the whole response, since one bad item shouldn't make an
 * otherwise-healthy provider look broken to the fallback chain.
 */
export function mapCurrentsSearchResponse(raw: CurrentsSearchResponse): NewsSearchResult {
  if (!raw || !Array.isArray(raw.news)) {
    throw new ProviderError({
      code: ProviderErrorCode.PROVIDER_BAD_RESPONSE,
      message: 'Currents search response is missing a "news" array',
      providerSlug: PROVIDER_SLUG,
    });
  }

  const articles = raw.news.map(mapCurrentsArticle).filter((article): article is NewsArticle => article !== undefined);
  return { articles };
}
