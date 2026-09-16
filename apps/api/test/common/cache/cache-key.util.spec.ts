import { describe, expect, it } from 'vitest';
import { buildCacheKey } from '../../../src/common/cache/cache-key.util.js';

describe('buildCacheKey', () => {
  it('produces different keys for different query values', () => {
    expect(buildCacheKey('news:search', { query: 'Africa' })).not.toBe(
      buildCacheKey('news:search', { query: 'Europe' }),
    );
  });

  it('produces different keys for different limits', () => {
    expect(buildCacheKey('academic:search', { query: 'x', limit: 10 })).not.toBe(
      buildCacheKey('academic:search', { query: 'x', limit: 50 }),
    );
  });

  it('is stable regardless of parameter insertion order', () => {
    const a = buildCacheKey('academic:search', { query: 'x', limit: 10 });
    const b = buildCacheKey('academic:search', { limit: 10, query: 'x' });
    expect(a).toBe(b);
  });

  it('normalizes string casing and whitespace', () => {
    const a = buildCacheKey('news:search', { query: 'Renewable Energy' });
    const b = buildCacheKey('news:search', { query: '  renewable energy  ' });
    expect(a).toBe(b);
  });

  it('omits undefined parameters', () => {
    const a = buildCacheKey('news:trends', { query: 'x', timespan: undefined });
    const b = buildCacheKey('news:trends', { query: 'x' });
    expect(a).toBe(b);
  });
});
