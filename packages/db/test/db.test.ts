import { describe, expect, it } from 'vitest';
import { db } from '../src';

describe('packages/db client initialization', () => {
  it('exports a valid Prisma client instance', () => {
    expect(db).toBeDefined();
    expect(typeof db.$connect).toBe('function');
  });
});
