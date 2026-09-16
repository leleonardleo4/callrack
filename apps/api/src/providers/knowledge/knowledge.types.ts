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
}

export interface KnowledgeSearchResult {
  entities: KnowledgeEntity[];
}

export interface KnowledgeProvider extends ProviderAdapter {
  search(input: KnowledgeSearchInput): Promise<KnowledgeSearchResult>;
}
