import { describe, expect, it } from 'vitest';
import { toNewsSearchResponse, toNewsTrendsResponse } from '../../src/news/news.mapper.js';
import type { NewsArticle } from '../../src/providers/news/news.types.js';

const ARTICLE: NewsArticle = {
  title: 'Example headline',
  url: 'https://example.com/a',
  source: 'example.com',
  publishedAt: '2023-01-01T00:00:00Z',
  language: 'English',
  country: 'United States',
  sourceProvider: 'gdelt',
};

describe('news.mapper', () => {
  it('maps a fully-populated article to the public contract', () => {
    expect(toNewsSearchResponse({ articles: [ARTICLE] })).toEqual({
      results: [
        {
          title: 'Example headline',
          url: 'https://example.com/a',
          source: 'example.com',
          publishedAt: '2023-01-01T00:00:00Z',
          language: 'English',
          country: 'United States',
        },
      ],
    });
  });

  it('uses null for fields GDELT did not supply', () => {
    const minimal: NewsArticle = { title: 't', url: 'u', sourceProvider: 'gdelt' };
    expect(toNewsSearchResponse({ articles: [minimal] }).results[0]).toEqual({
      title: 't',
      url: 'u',
      source: null,
      publishedAt: null,
      language: null,
      country: null,
    });
  });

  it('normalizes an empty article list', () => {
    expect(toNewsSearchResponse({ articles: [] })).toEqual({ results: [] });
  });

  it('maps trend points through unchanged', () => {
    expect(toNewsTrendsResponse({ term: 'x', points: [{ date: '20230101', volume: 12.3 }] })).toEqual({
      term: 'x',
      points: [{ date: '20230101', volume: 12.3 }],
    });
  });

  it('normalizes an empty trend result', () => {
    expect(toNewsTrendsResponse({ term: 'x', points: [] })).toEqual({ term: 'x', points: [] });
  });
});
