import type { AcademicSearchResponseData } from '../academic/academic-response.types.js';
import type { NewsSearchResponseData } from '../news/news-response.types.js';
import type { KnowledgeSearchResponseData } from '../knowledge/knowledge-response.types.js';
import type { CensusQueryResponseData } from '../government/government-response.types.js';
import type { EvidenceDisagreement, EvidenceItem } from '../information/information.types.js';
import type { ResearchSourceName } from './research-sources.constants.js';

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

export interface ResearchCompositionMetadata {
  readonly sourcesRequested: readonly ResearchSourceName[];
  readonly sourcesSucceeded: readonly ResearchSourceName[];
  readonly sourcesEmpty: readonly ResearchSourceName[];
  readonly sourcesFailed: readonly ResearchSourceName[];
  readonly retrievedAt: string;
}

export interface ResearchResponseData {
  query: string;
  status: ResearchOverallStatus;
  /** Per-source raw capability responses, kept for backward compatibility with existing consumers. */
  sources: ResearchSourcesMap;
  /** The same sources' results, normalized into provenance-preserving evidence items - see `EvidenceItem`. */
  findings: readonly EvidenceItem[];
  /** Same-titled results described differently by two different sources - see `detectDisagreements`. Empty is the common, correct result. */
  disagreements: readonly EvidenceDisagreement[];
  composition: ResearchCompositionMetadata;
}
