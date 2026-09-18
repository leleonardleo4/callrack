import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../../src/bootstrap.js';
import { CapabilityRegistryService } from '../../src/capabilities/capability-registry.service.js';

describe('Capability Registry (E2E)', () => {
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

  it('boots the whole app successfully with the configured test prices', () => {
    // Reaching this point at all proves PricingConfigService and
    // CapabilityRegistryService validated cleanly at startup.
    expect(registry.list().length).toBeGreaterThan(0);
  });

  it('every registered capability price resolves from the environment, as an exact string', () => {
    const academicSearch = registry.getById('academic.search');
    expect(academicSearch?.price).toEqual({ amount: '0.01', currency: 'USDC' });

    const research = registry.getById('research');
    expect(research?.price).toEqual({ amount: '0.05', currency: 'USDC' });
  });

  it('every registered capability route actually exists on the live app (never a phantom route)', async () => {
    for (const capability of registry.list()) {
      const response = await app.inject({
        method: capability.method,
        url: capability.path,
        payload: {},
      });

      const isPhantomRoute =
        response.statusCode === 404 && JSON.parse(response.payload)?.error?.message?.startsWith('Cannot ');
      expect(isPhantomRoute, `expected a real route at ${capability.method} ${capability.path}`).toBe(false);
    }
  });

  it('getByPath resolves the same capability the live router actually dispatches to', async () => {
    const bySearch = registry.getByPath('POST', '/v1/academic/search');
    expect(bySearch?.id).toBe('academic.search');

    const response = await app.inject({ method: 'POST', url: '/v1/academic/search', payload: {} });
    // A validation error (400), not a 404 - proves the route is real and reached the DTO pipeline.
    expect(response.statusCode).toBe(400);
  });

  it('marks research as a composition capability end to end', () => {
    const research = registry.getById('research');
    expect(research?.provider).toEqual({ kind: 'composite' });
  });
});
