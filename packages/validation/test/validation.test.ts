import { describe, expect, it } from 'vitest';
import { paginationQuerySchema } from '../src';

describe('packages/validation schema tests', () => {
  it('parses valid pagination query parameters', () => {
    const parsed = paginationQuerySchema.parse({ page: '2', limit: '50' });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(50);
  });

  it('uses default values when query is empty', () => {
    const parsed = paginationQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(20);
  });
});
