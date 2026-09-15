import { describe, expect, it } from 'vitest';
import type { SystemHealthStatus } from '../src';

describe('packages/types interface contract test', () => {
  it('instantiates valid health status type contract', () => {
    const health: SystemHealthStatus = {
      status: 'ok',
      service: 'api',
      version: '0.1.0',
      uptime: 100,
      timestamp: new Date().toISOString(),
    };
    expect(health.status).toBe('ok');
    expect(health.service).toBe('api');
  });
});
