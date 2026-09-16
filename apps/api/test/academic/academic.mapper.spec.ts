import { describe, expect, it } from 'vitest';
import { toAcademicSearchResponse, toAcademicWorkResponse } from '../../src/academic/academic.mapper.js';
import type { AcademicWork } from '../../src/providers/academic/academic.types.js';

const FULL_WORK: AcademicWork = {
  id: 'openalex:W1',
  title: 'A paper',
  authors: ['Jane Doe'],
  publicationYear: 2020,
  doi: '10.1/abc',
  venue: 'Journal of Examples',
  citationCount: 5,
  openAccessUrl: 'https://example.com/oa.pdf',
  sourceProvider: 'openalex',
};

describe('academic.mapper', () => {
  it('maps a fully-populated work to the public contract', () => {
    expect(toAcademicWorkResponse(FULL_WORK)).toEqual({
      id: 'openalex:W1',
      title: 'A paper',
      authors: ['Jane Doe'],
      publicationYear: 2020,
      doi: '10.1/abc',
      url: 'https://doi.org/10.1/abc',
      journal: 'Journal of Examples',
      citations: 5,
      openAccess: true,
      source: 'openalex',
    });
  });

  it('uses null (not fabricated data) for fields the provider did not supply', () => {
    const minimalWork: AcademicWork = {
      id: 'crossref:10.1/abc',
      title: 'A paper',
      authors: [],
      sourceProvider: 'crossref',
    };

    expect(toAcademicWorkResponse(minimalWork)).toEqual({
      id: 'crossref:10.1/abc',
      title: 'A paper',
      authors: [],
      publicationYear: null,
      doi: null,
      url: null,
      journal: null,
      citations: null,
      openAccess: false,
      source: 'crossref',
    });
  });

  it('falls back to the open-access URL when no DOI is present', () => {
    const work: AcademicWork = {
      id: 'x',
      title: 'x',
      authors: [],
      openAccessUrl: 'https://example.com/oa.pdf',
      sourceProvider: 'openalex',
    };

    expect(toAcademicWorkResponse(work).url).toBe('https://example.com/oa.pdf');
  });

  it('maps a search result and uses the provider total count when available', () => {
    const response = toAcademicSearchResponse({ works: [FULL_WORK], totalCount: 42 });
    expect(response.meta.count).toBe(42);
    expect(response.results).toHaveLength(1);
  });

  it('falls back to results.length when no total count is available', () => {
    const response = toAcademicSearchResponse({ works: [FULL_WORK] });
    expect(response.meta.count).toBe(1);
  });

  it('normalizes an empty search result', () => {
    expect(toAcademicSearchResponse({ works: [] })).toEqual({ results: [], meta: { count: 0 } });
  });
});
