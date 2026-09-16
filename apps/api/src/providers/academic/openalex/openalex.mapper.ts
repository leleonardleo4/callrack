import { ProviderError, ProviderErrorCode } from '../../common/index.js';
import type { AcademicSearchResult, AcademicWork } from '../academic.types.js';
import type { OpenAlexWork, OpenAlexWorksResponse } from './openalex.types.js';

const PROVIDER_SLUG = 'academic.openalex';

function cleanDoi(doi: string | null | undefined): string | undefined {
  if (!doi) {
    return undefined;
  }
  return doi.replace(/^https?:\/\/doi\.org\//i, '');
}

function shortId(rawId: string): string {
  const segments = rawId.split('/');
  return segments[segments.length - 1] ?? rawId;
}

export function mapOpenAlexWork(raw: OpenAlexWork): AcademicWork {
  if (!raw || typeof raw.id !== 'string' || typeof raw.title !== 'string') {
    throw new ProviderError({
      code: ProviderErrorCode.PROVIDER_BAD_RESPONSE,
      message: 'OpenAlex work is missing required fields (id, title)',
      providerSlug: PROVIDER_SLUG,
    });
  }

  return {
    id: `openalex:${shortId(raw.id)}`,
    title: raw.title,
    authors: (raw.authorships ?? [])
      .map((authorship) => authorship.author?.display_name)
      .filter((name): name is string => Boolean(name)),
    publicationYear: raw.publication_year ?? undefined,
    doi: cleanDoi(raw.doi),
    venue: raw.primary_location?.source?.display_name ?? undefined,
    citationCount: raw.cited_by_count,
    openAccessUrl: raw.open_access?.oa_url ?? undefined,
    sourceProvider: 'openalex',
  };
}

export function mapOpenAlexSearchResponse(raw: OpenAlexWorksResponse): AcademicSearchResult {
  if (!raw || !Array.isArray(raw.results)) {
    throw new ProviderError({
      code: ProviderErrorCode.PROVIDER_BAD_RESPONSE,
      message: 'OpenAlex search response is missing a "results" array',
      providerSlug: PROVIDER_SLUG,
    });
  }

  return {
    works: raw.results.map(mapOpenAlexWork),
    totalCount: raw.meta?.count,
  };
}
