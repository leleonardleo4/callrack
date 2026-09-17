import type { AcademicSearchResponseData } from '../academic/academic-response.types.js';
import type { NewsSearchResponseData } from '../news/news-response.types.js';
import type { KnowledgeSearchResponseData } from '../knowledge/knowledge-response.types.js';
import type { CensusQueryResponseData } from '../government/government-response.types.js';

export type ResearchSourceStatus = 'success' | 'empty' | 'failed';

export interface ResearchSourceError {
  code: string;
  message: string;
}

export interface ResearchSourceEntry<T> {
  status: ResearchSourceStatus;
  /** Present when status is "success" or "empty". */
  data?: T;
  /** Present only when status is "failed". Never a raw provider error. */
  error?: ResearchSourceError;
}

export interface ResearchSourcesMap {
  academic?: ResearchSourceEntry<AcademicSearchResponseData>;
  news?: ResearchSourceEntry<NewsSearchResponseData>;
  knowledge?: ResearchSourceEntry<KnowledgeSearchResponseData>;
  government?: ResearchSourceEntry<CensusQueryResponseData>;
}

/** complete: no failures. partial: some sources failed. failed: every requested source failed. */
export type ResearchOverallStatus = 'complete' | 'partial' | 'failed';

export interface ResearchResponseData {
  query: string;
  status: ResearchOverallStatus;
  sources: ResearchSourcesMap;
}
