import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../src/bootstrap.js';

describe('OpenAPI / Swagger Documentation (E2E)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves OpenAPI documentation specification at /docs/json', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/docs/json',
    });

    expect(response.statusCode).toBe(200);
    const spec = JSON.parse(response.payload);
    expect(spec.openapi).toMatch(/^3\./);
    expect(spec.info.title).toBe('Callrack API');
    expect(spec.info.version).toBe('0.1.0');
    expect(spec.paths['/health']).toBeDefined();
    expect(spec.paths['/health'].get).toBeDefined();
  });

  it('serves Swagger UI endpoint at /docs', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/docs/',
    });

    // Swagger UI serves HTML (200) or redirects to /docs/ (302/301)
    expect([200, 301, 302]).toContain(response.statusCode);
  });
});
