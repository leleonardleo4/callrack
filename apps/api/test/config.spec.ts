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
});
