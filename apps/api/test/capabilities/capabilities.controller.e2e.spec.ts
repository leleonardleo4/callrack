import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../../src/bootstrap.js';
import { CapabilityRegistryService } from '../../src/capabilities/capability-registry.service.js';
import type { PublicCapabilitiesData } from '../../src/capabilities/public-capability.types.js';
import type { ApiSuccessResponse } from '../../src/common/http/api-response.interface.js';

describe('GET /v1/capabilities (E2E)', () => {
  let app: NestFastifyApplication;
  let registry: CapabilityRegistryService;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    registry = app.get(CapabilityRegistryService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function fetchCapabilities(): Promise<PublicCapabilitiesData> {
    const response = await app.inject({ method: 'GET', url: '/v1/capabilities' });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload) as ApiSuccessResponse<PublicCapabilitiesData>;
    return body.data;
  }

  it('returns 200 with JSON content and a request ID', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/capabilities' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    const body = JSON.parse(response.payload) as ApiSuccessResponse<PublicCapabilitiesData>;
    expect(body.meta.requestId).toMatch(/^req_/);
  });

  it('never requires payment (not in the x402 route config)', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/capabilities' });
    expect(response.statusCode).not.toBe(402);
    expect(response.headers['payment-required']).toBeUndefined();
  });

  it('lists every capability in the registry, one to one, with matching id/price/path', async () => {
    const data = await fetchCapabilities();
    const registryCapabilities = registry.list();
    expect(data.capabilities).toHaveLength(registryCapabilities.length);

    for (const expected of registryCapabilities) {
      const actual = data.capabilities.find((c) => c.id === expected.id);
      expect(actual, `expected capability ${expected.id} in the response`).toBeDefined();
      expect(actual?.name).toBe(expected.name);
      expect(actual?.description).toBe(expected.description);
      expect(actual?.category).toBe(expected.category);
      expect(actual?.method).toBe(expected.method);
      expect(actual?.path).toBe(expected.path);
      expect(actual?.provider).toEqual(expected.provider);
      expect(actual?.price).toEqual(expected.price);
      expect(actual?.status).toBe(expected.status);
    }
  });

  it('attaches a dereferenced JSON Schema for every capability request body', async () => {
    const data = await fetchCapabilities();
    const academicSearch = data.capabilities.find((c) => c.id === 'academic.search');
    expect(academicSearch?.requestSchema).toEqual({
      type: 'object',
      properties: expect.objectContaining({
        query: expect.objectContaining({ type: 'string' }),
      }),
      required: ['query'],
    });

    // The research capability's schema nests ResearchGovernmentOptionsDto -
    // this must be a real, self-contained schema, never a dangling $ref
    // (see discovery-schema.util.ts's dereferenceSchema).
    const research = data.capabilities.find((c) => c.id === 'research');
    expect(JSON.stringify(research?.requestSchema)).not.toContain('$ref');
  });

  it('includes a representative request/response example and response schema for every capability', async () => {
    const data = await fetchCapabilities();
    for (const capability of data.capabilities) {
      expect(capability.example.request).toBeTypeOf('object');
      expect(capability.example.response).toBeTypeOf('object');
      expect(capability.responseSchema.properties).toBeTypeOf('object');
    }
  });

  it('reports the active network, matching X402ConfigService', async () => {
    const data = await fetchCapabilities();
    expect(data.network).toEqual({
      name: 'testnet',
      caip2: expect.stringMatching(/^algorand:/),
      facilitatorUrl: 'https://facilitator.goplausible.xyz',
    });
  });

  it('never exposes a payTo address or provider credentials', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/capabilities' });
    expect(response.payload).not.toContain('payTo');
    expect(response.payload.toLowerCase()).not.toContain('apikey');
    expect(response.payload.toLowerCase()).not.toContain('privatekey');
  });
});
