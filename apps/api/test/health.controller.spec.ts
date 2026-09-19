import { describe, expect, it } from 'vitest';
import { HealthController } from '../src/health/health.controller.js';
import { HealthService } from '../src/health/health.service.js';
import { ApiConfigService } from '../src/config/api-config.service.js';

describe('HealthController', () => {
  it('returns healthy system status', () => {
    const configService = new ApiConfigService({
      NODE_ENV: 'test',
      API_VERSION: '0.1.0',
    });
    const healthService = new HealthService(configService);
    const controller = new HealthController(healthService);

    const health = controller.getHealth();

    expect(health.status).toBe('ok');
    expect(health.version).toBe('0.1.0');
    expect(typeof health.uptime).toBe('number');
    expect(typeof health.timestamp).toBe('string');
  });
});
