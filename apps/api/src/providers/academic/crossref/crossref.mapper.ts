import { ProviderError, ProviderErrorCode } from '../../common/index.js';
import type { AcademicSearchResult, AcademicWork } from '../academic.types.js';
import type { CrossrefWork, CrossrefWorksResponse } from './crossref.types.js';

const PROVIDER_SLUG = 'academic.crossref';

function extractYear(work: CrossrefWork): number | undefined {
  const parts = work['published-print']?.['date-parts'] ?? work['published-online']?.['date-parts'];
  return parts?.[0]?.[0];
}

export function mapCrossrefWork(raw: CrossrefWork): AcademicWork {
  const title = raw?.title?.[0];
  if (!raw || typeof raw.DOI !== 'string' || typeof title !== 'string') {
    throw new ProviderError({
      code: ProviderErrorCode.PROVIDER_BAD_RESPONSE,
      message: 'Crossref work is missing required fields (DOI, title)',
      providerSlug: PROVIDER_SLUG,
    });
  }

  return {
    id: `crossref:${raw.DOI}`,
    title,
    authors: (raw.author ?? [])
      .map((author) => [author.given, author.family].filter(Boolean).join(' ').trim())
      .filter((name) => name.length > 0),
    publicationYear: extractYear(raw),
    doi: raw.DOI,
    venue: raw['container-title']?.[0],
    citationCount: raw['is-referenced-by-count'],
    openAccessUrl: undefined,
    sourceProvider: 'crossref',
  };
}

export function mapCrossrefSearchResponse(raw: CrossrefWorksResponse): AcademicSearchResult {
  if (!raw?.message || !Array.isArray(raw.message.items)) {
    throw new ProviderError({
      code: ProviderErrorCode.PROVIDER_BAD_RESPONSE,
      message: 'Crossref search response is missing "message.items"',
      providerSlug: PROVIDER_SLUG,
    });
  }

  return {
    works: raw.message.items.map(mapCrossrefWork),
    totalCount: raw.message['total-results'],
  };
}
