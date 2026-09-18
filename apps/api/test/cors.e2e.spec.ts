import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../src/bootstrap.js';

describe('CORS (E2E)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reflects an arbitrary cross-origin caller on a preflight request', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: {
        origin: 'https://some-third-party-agent.example',
        'access-control-request-method': 'GET',
      },
    });

    expect(response.statusCode).toBeLessThan(300);
    expect(response.headers['access-control-allow-origin']).toBe(
      'https://some-third-party-agent.example',
    );
  });

  it('reflects an arbitrary cross-origin caller on an actual request', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://another-example-client.test' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(
      'https://another-example-client.test',
    );
  });

  it('never sets Access-Control-Allow-Credentials, since the API uses no cookie-based auth', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://another-example-client.test' },
    });

    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('exposes PAYMENT-REQUIRED and PAYMENT-RESPONSE so a real browser can read x402 headers cross-origin', async () => {
    // A browser only lets JS read response headers listed here for a
    // cross-origin request - curl/server-to-server callers were never
    // affected by this (no CORS enforcement outside a browser), but any
    // browser-based x402 client (the Playground included) could see a 402
    // or a paid response over the wire yet never actually read either
    // header without both listed. Regression coverage for that exact bug.
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://another-example-client.test' },
    });

    const exposedHeaders = (response.headers['access-control-expose-headers'] as string)
      .split(',')
      .map((header) => header.trim().toUpperCase());
    expect(exposedHeaders).toContain('PAYMENT-REQUIRED');
    expect(exposedHeaders).toContain('PAYMENT-RESPONSE');
  });

  it('allows the PAYMENT-SIGNATURE request header on a preflight request', async () => {
    // Without this, a real cross-origin browser retrying a paid request
    // would have PAYMENT-SIGNATURE stripped by CORS preflight before it
    // ever reached the API.
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: {
        origin: 'https://some-third-party-agent.example',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'payment-signature',
      },
    });

    expect(response.statusCode).toBeLessThan(300);
    const allowedHeaders = (response.headers['access-control-allow-headers'] as string)
      .split(',')
      .map((header) => header.trim().toUpperCase());
    expect(allowedHeaders).toContain('PAYMENT-SIGNATURE');
  });

  it('allows the Access-Control-Expose-Headers request header on a preflight request', async () => {
    // Not our doing: @x402/fetch's own paid-retry logic (wrapFetchWithPayment)
    // sets "Access-Control-Expose-Headers" directly on the *request* it
    // sends - normally only ever a response header - presumably so a
    // facilitator proxy can forward it. Without this allowed, a real
    // browser's preflight rejects the paid retry outright, surfacing as a
    // bare "Failed to fetch" *after* the wallet already signed and
    // submitted payment. Regression coverage for that exact bug.
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: {
        origin: 'https://some-third-party-agent.example',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'access-control-expose-headers',
      },
    });

    expect(response.statusCode).toBeLessThan(300);
    const allowedHeaders = (response.headers['access-control-allow-headers'] as string)
      .split(',')
      .map((header) => header.trim().toUpperCase());
    expect(allowedHeaders).toContain('ACCESS-CONTROL-EXPOSE-HEADERS');
  });
});
