import type { AcademicSearchResult, AcademicWork } from '../providers/academic/academic.types.js';
import type { AcademicSearchResponseData, AcademicWorkResponse } from './academic-response.types.js';

/**
 * Normalizes a provider-owned AcademicWork into Callrack's public academic
 * work contract. Only fields the provider layer can reliably supply are
 * included - no fabricated data (e.g. no `abstract`/`publisher`, since
 * neither OpenAlex nor Crossref mappers currently populate them).
 */
export function toAcademicWorkResponse(work: AcademicWork): AcademicWorkResponse {
  const url = work.doi ? `https://doi.org/${work.doi}` : (work.openAccessUrl ?? null);

  return {
    id: work.id,
    title: work.title,
    authors: work.authors,
    publicationYear: work.publicationYear ?? null,
    doi: work.doi ?? null,
    url,
    journal: work.venue ?? null,
    citations: work.citationCount ?? null,
    openAccess: work.openAccessUrl != null,
    source: work.sourceProvider,
  };
}

export function toAcademicSearchResponse(result: AcademicSearchResult): AcademicSearchResponseData {
  const results = result.works.map(toAcademicWorkResponse);
  return {
    results,
    meta: { count: result.totalCount ?? results.length },
  };
}
