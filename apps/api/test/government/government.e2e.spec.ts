import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../../src/bootstrap.js';
import { jsonResponse, stubFetchAlways, stubFetchSequence } from '../providers/mock-fetch.js';

const RAW_TABLE = [
  ['NAME', 'B01001_001E'],
  ['California', '39029342'],
];

describe('Government Capability (E2E)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a normalized result for a valid query, with source and request ID', async () => {
    stubFetchSequence([jsonResponse(200, RAW_TABLE)]);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/government/census',
      headers: { 'x-request-id': 'e2e-census-1' },
      payload: { dataset: 'acs/acs1', year: 2021, variables: ['NAME', 'B01001_001E'], forGeography: 'state:*' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-request-id']).toBe('e2e-census-1');
    const body = JSON.parse(response.payload);
    expect(body.meta.requestId).toBe('e2e-census-1');
    expect(body.meta.source).toBe('us-census');
    expect(body.data).toEqual({
      dataset: 'acs/acs1',
      year: 2021,
      columns: ['NAME', 'B01001_001E'],
      rows: [{ NAME: 'California', B01001_001E: '39029342' }],
    });
  });

  it('rejects a dataset outside the allowlist', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/government/census',
      payload: { dataset: 'not/allowed', year: 2021, variables: ['NAME'], forGeography: 'state:*' },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error.details.fields.dataset).toBeDefined();
  });

  it('rejects a malformed geography clause', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/government/census',
      payload: { dataset: 'acs/acs1', year: 2021, variables: ['NAME'], forGeography: 'state:06&in=nation:1' },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error.details.fields.forGeography).toBeDefined();
  });

  it('rejects too many requested variables', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/government/census',
      payload: {
        dataset: 'acs/acs1',
        year: 2021,
        variables: Array.from({ length: 11 }, (_, i) => `VAR${i}`),
        forGeography: 'state:*',
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error.details.fields.variables).toBeDefined();
  });

  it('rejects an out-of-range year', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/government/census',
      payload: { dataset: 'acs/acs1', year: 1500, variables: ['NAME'], forGeography: 'state:*' },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error.details.fields.year).toBeDefined();
  });

  it('returns an empty rows array for a header-only response, without error', async () => {
    stubFetchSequence([jsonResponse(200, [['NAME']])]);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/government/census',
      payload: { dataset: 'acs/acs1', year: 2021, variables: ['NAME'], forGeography: 'state:99' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.rows).toEqual([]);
  });

  it('translates a persistent upstream failure into 502', async () => {
    stubFetchAlways(jsonResponse(503, {}));

    const response = await app.inject({
      method: 'POST',
      url: '/v1/government/census',
      payload: { dataset: 'acs/acs1', year: 2021, variables: ['NAME'], forGeography: 'state:*' },
    });

    expect(response.statusCode).toBe(502);
  }, 10_000);
});
