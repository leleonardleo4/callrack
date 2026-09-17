import type { KnowledgeSearchResult } from '../providers/knowledge/knowledge.types.js';
import type { KnowledgeSearchResponseData } from './knowledge-response.types.js';

/**
 * Normalizes Wikidata's already-clean domain type into Callrack's public
 * knowledge contract. No `type`/`coordinates` fields — the Phase 3 adapter
 * only calls Wikidata's lightweight entity-search action, which doesn't
 * return classification or coordinate claims, so neither is fabricated here.
 */
export function toKnowledgeSearchResponse(result: KnowledgeSearchResult): KnowledgeSearchResponseData {
  return {
    results: result.entities.map((entity) => ({
      id: entity.id,
      name: entity.label,
      description: entity.description ?? null,
      url: entity.url,
      source: entity.sourceProvider,
    })),
  };
}
