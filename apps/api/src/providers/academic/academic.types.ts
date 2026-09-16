import type { ProviderAdapter } from '../common/index.js';

export interface AcademicWork {
  id: string;
  title: string;
  authors: string[];
  publicationYear?: number;
  doi?: string;
  venue?: string;
  citationCount?: number;
  openAccessUrl?: string;
  sourceProvider: string;
}

export interface AcademicSearchInput {
  query: string;
  limit?: number;
}

export interface AcademicSearchResult {
  works: AcademicWork[];
  totalCount?: number;
}

export interface AcademicWorkInput {
  /** Provider-native identifier or a DOI, depending on the adapter. */
  id: string;
}

export interface AcademicWorkResult {
  work: AcademicWork;
}

export interface AcademicProvider extends ProviderAdapter {
  searchWorks(input: AcademicSearchInput): Promise<AcademicSearchResult>;
  getWork(input: AcademicWorkInput): Promise<AcademicWorkResult>;
}
