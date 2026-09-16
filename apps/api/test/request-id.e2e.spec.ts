import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../src/bootstrap.js';

describe('Request ID (E2E)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('preserves valid client-provided X-Request-ID header', async () => {
    const customId = 'client-trace-id-abc123';
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: {
        'x-request-id': customId,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-request-id']).toBe(customId);
  });

  it('generates a new collision-resistant ID if client header is invalid', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: {
        'x-request-id': 'invalid header with spaces and <chars>',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-request-id']).toMatch(/^req_[a-f0-9]{32}$/);
  });

  it('exposes request ID in error response envelope and headers', async () => {
    const customId = 'trace-err-999';
    const response = await app.inject({
      method: 'GET',
      url: '/v1/non-existent-endpoint',
      headers: {
        'x-request-id': customId,
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers['x-request-id']).toBe(customId);
    const body = JSON.parse(response.payload);
    expect(body.meta.requestId).toBe(customId);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
