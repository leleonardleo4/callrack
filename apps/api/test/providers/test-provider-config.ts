import { ApiConfigService } from '../../src/config/api-config.service.js';
import { ProviderConfigService, type ProviderAdapterOptions } from '../../src/providers/common/index.js';

/** Fast, no-retry options so failure-path tests don't wait on backoff delays. */
export const NO_RETRY_OPTIONS: ProviderAdapterOptions = {
  timeoutMs: 200,
  retry: { maxAttempts: 0 },
};

const BASE_TEST_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://callrack:callrack_dev_password@localhost:5432/callrack_test',
  REDIS_URL: 'redis://localhost:6379',
  API_PORT: '3000',
  WEB_PORT: '5173',
};

export function createTestProviderConfig(overrides: Record<string, string> = {}): ProviderConfigService {
  const apiConfig = new ApiConfigService({ ...BASE_TEST_ENV, ...overrides });
  return new ProviderConfigService(apiConfig);
}
