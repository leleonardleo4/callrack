import { describe, expect, it } from 'vitest';
import {
  academicToEvidence,
  dedupeSources,
  detectDisagreements,
  knowledgeToEvidence,
  newsToEvidence,
} from '../../src/information/evidence.util.js';
import type { AcademicSearchResponseData } from '../../src/academic/academic-response.types.js';
import type { NewsSearchResponseData } from '../../src/news/news-response.types.js';
import type { KnowledgeSearchResponseData } from '../../src/knowledge/knowledge-response.types.js';
import type { EvidenceItem } from '../../src/information/information.types.js';

const RETRIEVED_AT = '2026-01-15T12:00:00.000Z';

describe('academicToEvidence', () => {
  it('maps title/url/provider and real structured data, never a fabricated excerpt', () => {
    const data: AcademicSearchResponseData = {
      results: [
        {
          id: 'w1',
          title: 'The state of OA',
          authors: ['Heather Piwowar'],
          publicationYear: 2018,
          doi: '10.7717/peerj.4375',
          url: 'https://doi.org/10.7717/peerj.4375',
          journal: 'PeerJ',
          citations: 391,
          openAccess: true,
          source: 'openalex',
        },
      ],
      meta: { count: 1 },
    };

    const [item] = academicToEvidence(data, RETRIEVED_AT);

    expect(item).toBeDefined();
    expect(item!.source).toEqual({ title: 'The state of OA', url: 'https://doi.org/10.7717/peerj.4375', provider: 'academic.search' });
    expect(item!.excerpt).toBeUndefined();
    expect(item!.retrievedAt).toBe(RETRIEVED_AT);
    expect(item!.data).toEqual({ authors: ['Heather Piwowar'], publicationYear: 2018, journal: 'PeerJ', citations: 391, openAccess: true, doi: '10.7717/peerj.4375' });
  });

  it('omits null fields from data rather than including them as null', () => {
    const data: AcademicSearchResponseData = {
      results: [{ id: 'w1', title: 'x', authors: [], publicationYear: null, doi: null, url: null, journal: null, citations: null, openAccess: false, source: 'crossref' }],
      meta: { count: 1 },
    };
    const [item] = academicToEvidence(data, RETRIEVED_AT);
    expect(item!.source.url).toBeUndefined();
    expect(item!.data).toEqual({ authors: [], openAccess: false });
  });
});

describe('newsToEvidence', () => {
  it('maps title/url/provider and real structured data, never a fabricated excerpt', () => {
    const data: NewsSearchResponseData = {
      results: [{ title: 'Example headline', url: 'https://example.com/a', source: 'example.com', publishedAt: '2026-01-15T12:00:00Z', language: 'English', country: 'Nigeria' }],
    };
    const [item] = newsToEvidence(data, RETRIEVED_AT);
    expect(item!.source).toEqual({ title: 'Example headline', url: 'https://example.com/a', provider: 'news.search' });
    expect(item!.excerpt).toBeUndefined();
    expect(item!.data).toEqual({ publishedAt: '2026-01-15T12:00:00Z', language: 'English', country: 'Nigeria', sourceDomain: 'example.com' });
  });
});

describe('knowledgeToEvidence', () => {
  it('is the only mapper that populates a real excerpt (the entity description)', () => {
    const data: KnowledgeSearchResponseData = {
      results: [{ id: 'Q8673', name: 'Lagos', description: 'city in Lagos State, Nigeria', url: 'https://www.wikidata.org/wiki/Q8673', source: 'wikimedia' }],
    };
    const [item] = knowledgeToEvidence(data, RETRIEVED_AT);
    expect(item!.source).toEqual({ title: 'Lagos', url: 'https://www.wikidata.org/wiki/Q8673', provider: 'knowledge.search' });
    expect(item!.excerpt).toBe('city in Lagos State, Nigeria');
    expect(item!.data).toEqual({ id: 'Q8673' });
  });

  it('omits excerpt when the entity has no description', () => {
    const data: KnowledgeSearchResponseData = {
      results: [{ id: 'Q1', name: 'x', description: null, url: 'https://example.test', source: 'wikimedia' }],
    };
    const [item] = knowledgeToEvidence(data, RETRIEVED_AT);
    expect(item!.excerpt).toBeUndefined();
  });
});

describe('dedupeSources', () => {
  it('deduplicates identical (provider, title, url) triples', () => {
    const items: EvidenceItem[] = [
      { source: { title: 'A', url: 'https://a.test', provider: 'news.search' }, retrievedAt: RETRIEVED_AT },
      { source: { title: 'A', url: 'https://a.test', provider: 'news.search' }, retrievedAt: RETRIEVED_AT },
      { source: { title: 'B', url: 'https://b.test', provider: 'academic.search' }, retrievedAt: RETRIEVED_AT },
    ];
    expect(dedupeSources(items)).toHaveLength(2);
  });
});

describe('detectDisagreements', () => {
  it('returns an empty array when every subject appears once', () => {
    const items: EvidenceItem[] = [
      { source: { title: 'A', provider: 'news.search' }, excerpt: 'about A', retrievedAt: RETRIEVED_AT },
      { source: { title: 'B', provider: 'knowledge.search' }, excerpt: 'about B', retrievedAt: RETRIEVED_AT },
    ];
    expect(detectDisagreements(items)).toEqual([]);
  });

  it('returns an empty array when the same subject appears twice with the SAME excerpt', () => {
    const items: EvidenceItem[] = [
      { source: { title: 'Lagos', provider: 'news.search' }, excerpt: 'a big city', retrievedAt: RETRIEVED_AT },
      { source: { title: 'Lagos', provider: 'knowledge.search' }, excerpt: 'a big city', retrievedAt: RETRIEVED_AT },
    ];
    expect(detectDisagreements(items)).toEqual([]);
  });

  it('detects a real disagreement when the same subject has two different excerpts', () => {
    const items: EvidenceItem[] = [
      { source: { title: 'Lagos', provider: 'news.search' }, excerpt: 'former capital of Nigeria', retrievedAt: RETRIEVED_AT },
      { source: { title: 'Lagos', provider: 'knowledge.search' }, excerpt: 'current capital of Nigeria', retrievedAt: RETRIEVED_AT },
    ];
    const disagreements = detectDisagreements(items);
    expect(disagreements).toHaveLength(1);
    expect(disagreements[0]?.subject).toBe('Lagos');
    expect(disagreements[0]?.attribute).toBe('excerpt');
    expect(disagreements[0]?.values).toHaveLength(2);
  });

  it('matches subjects case- and whitespace-insensitively', () => {
    const items: EvidenceItem[] = [
      { source: { title: 'Lagos', provider: 'news.search' }, excerpt: 'value one', retrievedAt: RETRIEVED_AT },
      { source: { title: ' lagos ', provider: 'knowledge.search' }, excerpt: 'value two', retrievedAt: RETRIEVED_AT },
    ];
    expect(detectDisagreements(items)).toHaveLength(1);
  });

  it('ignores items with no excerpt at all', () => {
    const items: EvidenceItem[] = [
      { source: { title: 'Work', provider: 'academic.search' }, retrievedAt: RETRIEVED_AT },
      { source: { title: 'Work', provider: 'academic.search' }, retrievedAt: RETRIEVED_AT },
    ];
    expect(detectDisagreements(items)).toEqual([]);
  });
});
