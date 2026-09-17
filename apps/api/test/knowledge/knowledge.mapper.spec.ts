import { describe, expect, it } from 'vitest';
import { toKnowledgeSearchResponse } from '../../src/knowledge/knowledge.mapper.js';
import type { KnowledgeEntity } from '../../src/providers/knowledge/knowledge.types.js';

const FULL_ENTITY: KnowledgeEntity = {
  id: 'Q8673',
  label: 'Lagos',
  description: 'city in Lagos State, Nigeria',
  url: 'https://www.wikidata.org/wiki/Q8673',
  sourceProvider: 'wikimedia',
};

describe('knowledge.mapper', () => {
  it('maps a fully-populated entity to the public contract', () => {
    const result = toKnowledgeSearchResponse({ entities: [FULL_ENTITY] });
    expect(result.results[0]).toEqual({
      id: 'Q8673',
      name: 'Lagos',
      description: 'city in Lagos State, Nigeria',
      url: 'https://www.wikidata.org/wiki/Q8673',
      source: 'wikimedia',
    });
  });

  it('uses null for a missing description', () => {
    const minimal: KnowledgeEntity = { id: 'Q1', label: 'x', url: 'https://example.test/Q1', sourceProvider: 'wikimedia' };
    expect(toKnowledgeSearchResponse({ entities: [minimal] }).results[0]?.description).toBeNull();
  });

  it('normalizes an empty result set', () => {
    expect(toKnowledgeSearchResponse({ entities: [] })).toEqual({ results: [] });
  });

  it('does not include type or coordinates fields (unsupported by the adapter)', () => {
    const result = toKnowledgeSearchResponse({ entities: [FULL_ENTITY] });
    expect(result.results[0]).not.toHaveProperty('type');
    expect(result.results[0]).not.toHaveProperty('coordinates');
  });
});
