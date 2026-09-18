import { describe, expect, it } from 'vitest';
import { hasNegationCue, termOverlap, tokenize } from '../../src/information/text-relevance.util.js';

describe('tokenize', () => {
  it('lowercases and strips punctuation', () => {
    expect(tokenize('Nigeria, Africa!')).toEqual(['nigeria', 'africa']);
  });

  it('filters out short words and stopwords', () => {
    expect(tokenize('the a is of an it')).toEqual([]);
    expect(tokenize('to be or to be')).toEqual([]);
  });

  it('keeps genuinely significant terms', () => {
    expect(tokenize('renewable energy investment')).toEqual(['renewable', 'energy', 'investment']);
  });
});

describe('termOverlap', () => {
  it('returns 0 for an empty claim-term list — nothing to compare against', () => {
    expect(termOverlap([], 'anything at all')).toBe(0);
  });

  it('returns 1 when every claim term appears in the text', () => {
    expect(termOverlap(['nigeria', 'population'], 'Nigeria has the largest population in Africa')).toBe(1);
  });

  it('returns a fraction when only some claim terms appear', () => {
    expect(termOverlap(['nigeria', 'population', 'largest'], 'Nigeria has a growing economy')).toBeCloseTo(1 / 3);
  });

  it('returns 0 when no claim terms appear at all', () => {
    expect(termOverlap(['nigeria', 'population'], 'completely unrelated text about weather')).toBe(0);
  });
});

describe('hasNegationCue', () => {
  it('detects an explicit denial word', () => {
    expect(hasNegationCue('This claim has been debunked by researchers.')).toBe(true);
    expect(hasNegationCue('Officials denied the report.')).toBe(true);
  });

  it('returns false for plain affirming text', () => {
    expect(hasNegationCue('Nigeria has the largest population in Africa.')).toBe(false);
  });
});
