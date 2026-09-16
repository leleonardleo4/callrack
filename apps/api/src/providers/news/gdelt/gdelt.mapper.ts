import { ProviderError, ProviderErrorCode } from '../../common/index.js';
import type { NewsArticle, NewsSearchResult, NewsTrendsResult } from '../news.types.js';
import type { GdeltArticle, GdeltArticleListResponse, GdeltTimelineResponse } from './gdelt.types.js';

const PROVIDER_SLUG = 'news.gdelt';

function parseGdeltDate(seendate: string | undefined): string | undefined {
  if (!seendate) {
    return undefined;
  }
  const match = /^(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?(\d{2})?/.exec(seendate);
  if (!match) {
    return undefined;
  }
  const [, year, month, day, hour = '00', minute = '00', second = '00'] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
}

export function mapGdeltArticle(raw: GdeltArticle): NewsArticle {
  if (!raw || typeof raw.url !== 'string' || typeof raw.title !== 'string') {
    throw new ProviderError({
      code: ProviderErrorCode.PROVIDER_BAD_RESPONSE,
      message: 'GDELT article is missing required fields (url, title)',
      providerSlug: PROVIDER_SLUG,
    });
  }

  return {
    title: raw.title,
    url: raw.url,
    source: raw.domain,
    publishedAt: parseGdeltDate(raw.seendate),
    language: raw.language,
    country: raw.sourcecountry,
    sourceProvider: 'gdelt',
  };
}

export function mapGdeltSearchResponse(raw: GdeltArticleListResponse): NewsSearchResult {
  if (!raw || !Array.isArray(raw.articles)) {
    throw new ProviderError({
      code: ProviderErrorCode.PROVIDER_BAD_RESPONSE,
      message: 'GDELT search response is missing an "articles" array',
      providerSlug: PROVIDER_SLUG,
    });
  }

  return { articles: raw.articles.map(mapGdeltArticle) };
}

export function mapGdeltTrends(raw: GdeltTimelineResponse, term: string): NewsTrendsResult {
  if (!raw || !Array.isArray(raw.timeline)) {
    throw new ProviderError({
      code: ProviderErrorCode.PROVIDER_BAD_RESPONSE,
      message: 'GDELT timeline response is missing a "timeline" array',
      providerSlug: PROVIDER_SLUG,
    });
  }

  const series = raw.timeline[0];
  const points = (series?.data ?? [])
    .filter((point) => typeof point.date === 'string' && typeof point.value === 'number')
    .map((point) => ({ date: point.date as string, volume: point.value as number }));

  return { term, points };
}
