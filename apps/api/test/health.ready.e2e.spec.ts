import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../src/bootstrap.js';

describe('Readiness Endpoint (E2E)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health/ready reports infrastructure readiness', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health/ready',
    });

    expect([200, 503]).toContain(response.statusCode);
    const body = JSON.parse(response.payload);
    expect(['ok', 'degraded']).toContain(body.status);
    expect(['ok', 'down']).toContain(body.checks.database);
    expect(['ok', 'down']).toContain(body.checks.redis);
    expect(typeof body.timestamp).toBe('string');
    expect(response.statusCode).toBe(body.status === 'ok' ? 200 : 503);
  });
});
