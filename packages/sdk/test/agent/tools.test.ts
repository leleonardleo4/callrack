import { describe, expect, it } from 'vitest';
import { buildToolsFromCapabilities } from '../../src/agent/tools.js';
import { ACADEMIC_SEARCH_CAPABILITY, NEWS_SEARCH_CAPABILITY } from '../fixtures/capabilities.js';

describe('buildToolsFromCapabilities', () => {
  it('projects capabilities into tools with atomic pricing, never exposing the upstream provider', () => {
    const [academic] = buildToolsFromCapabilities([ACADEMIC_SEARCH_CAPABILITY], 6);
    expect(academic).toMatchObject({
      id: 'academic.search',
      name: 'Academic Search',
      category: 'academic',
      priceAtomic: '10000',
    });
    expect(academic).not.toHaveProperty('provider');
    expect(JSON.stringify(academic)).not.toMatch(/openalex|crossref/i);
  });

  it('builds one tool per discovered capability', () => {
    const tools = buildToolsFromCapabilities([ACADEMIC_SEARCH_CAPABILITY, NEWS_SEARCH_CAPABILITY], 6);
    expect(tools.map((tool) => tool.id)).toEqual(['academic.search', 'news.search']);
    expect(tools[1]?.priceAtomic).toBe('5000');
  });
});
