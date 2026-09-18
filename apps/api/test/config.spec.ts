import { describe, expect, it } from 'vitest';
import { ApiConfigService } from '../src/config/api-config.service.js';
import { validateApiConfig } from '../src/config/api-config.schema.js';

describe('ApiConfigService', () => {
  it('loads valid configuration and establishes defaults', () => {
    const config = new ApiConfigService({
      NODE_ENV: 'test',
      API_PORT: '4000',
      API_PREFIX: 'v1',
    });

    expect(config.nodeEnv).toBe('test');
    expect(config.isTest).toBe(true);
    expect(config.isProduction).toBe(false);
    expect(config.port).toBe(4000);
    expect(config.apiPrefix).toBe('v1');
    expect(config.serviceName).toBe('callrack-api');
  });

  it('fails validation on invalid configuration', () => {
    expect(() => {
      validateApiConfig({
        NODE_ENV: 'invalid-env' as unknown as string,
        API_PORT: 'not-a-number',
      });
    }).toThrow(/Callrack API configuration validation failed/);
  });

  it('defaults production-hardening options to safe values when unset', () => {
    const config = new ApiConfigService({ NODE_ENV: 'test' });
    expect(config.trustProxy).toBe(true);
    expect(config.bodyLimitBytes).toBe(1_048_576);
    expect(config.rateLimitMax).toBe(300);
    expect(config.rateLimitWindowMs).toBe(60_000);
  });

  it.each([
    ['true', true],
    ['1', true],
    ['yes', true],
    ['on', true],
    ['false', false],
    ['0', false],
    ['no', false],
    ['off', false],
    ['', true], // treated as unset, falls back to the default
  ])('parses TRUST_PROXY=%s as %s', (value, expected) => {
    const config = new ApiConfigService({ NODE_ENV: 'test', TRUST_PROXY: value });
    expect(config.trustProxy).toBe(expected);
  });

  it('reads numeric hardening overrides from the environment', () => {
    const config = new ApiConfigService({
      NODE_ENV: 'test',
      BODY_LIMIT_BYTES: '2097152',
      RATE_LIMIT_MAX: '50',
      RATE_LIMIT_WINDOW_MS: '30000',
    });
    expect(config.bodyLimitBytes).toBe(2_097_152);
    expect(config.rateLimitMax).toBe(50);
    expect(config.rateLimitWindowMs).toBe(30_000);
  });
});
