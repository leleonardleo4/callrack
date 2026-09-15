import { describe, expect, it } from 'vitest';
import { parseEnv, baseEnvSchema } from '../src/env';

describe('packages/config env parser', () => {
  it('parses valid default environment variables', () => {
    const env = parseEnv(baseEnvSchema, {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      REDIS_URL: 'redis://localhost:6379',
      API_PORT: '3000',
      WEB_PORT: '5173',
    });

    expect(env.NODE_ENV).toBe('test');
    expect(env.API_PORT).toBe(3000);
    expect(env.WEB_PORT).toBe(5173);
  });
});
