import type { ProviderAdapter } from '../common/index.js';

export interface KnowledgeEntity {
  id: string;
  label: string;
  description?: string;
  url: string;
  sourceProvider: string;
}

export interface KnowledgeSearchInput {
  query: string;
  limit?: number;
  /** ISO-style language code (e.g. "en", "fr"). Defaults to the adapter's own default. */
  language?: string;
}

export interface KnowledgeSearchResult {
  entities: KnowledgeEntity[];
}

export interface KnowledgeProvider extends ProviderAdapter {
  search(input: KnowledgeSearchInput): Promise<KnowledgeSearchResult>;
}
