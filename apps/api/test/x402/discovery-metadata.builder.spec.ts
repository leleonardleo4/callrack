import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../../src/bootstrap.js';
import {
  buildBazaarDiscoveryExtension,
  buildDiscoveryExtensionsMap,
} from '../../src/x402/discovery-metadata.builder.js';
import { CAPABILITY_METADATA } from '../../src/capabilities/capability-definitions.js';
import { resolveCapabilityDefinition } from '../../src/capabilities/capability-registry.util.js';
import type { CapabilityDefinition } from '../../src/capabilities/capability.types.js';
import type { RequestJsonSchema } from '../../src/x402/discovery-schema.util.js';

const PRICES: Record<string, string> = {
  PRICE_ACADEMIC_SEARCH: '0.01',
  PRICE_ACADEMIC_WORK: '0.005',
  PRICE_NEWS_SEARCH: '0.01',
  PRICE_NEWS_TRENDS: '0.02',
  PRICE_CRYPTO_PRICE: '0.002',
  PRICE_CRYPTO_MARKET: '0.005',
  PRICE_FX_RATES: '0.002',
  PRICE_WEATHER: '0.003',
  PRICE_GEOCODE: '0.002',
  PRICE_HOLIDAYS: '0.002',
  PRICE_KNOWLEDGE_SEARCH: '0.005',
  PRICE_GOVERNMENT_CENSUS: '0.01',
  PRICE_RESEARCH: '0.05',
  PRICE_INFORMATION_VERIFY: '0.05',
  PRICE_INFORMATION_EVIDENCE: '0.05',
  PRICE_INFORMATION_COMPARE: '0.10',
};

function realCapabilities(): CapabilityDefinition[] {
  return CAPABILITY_METADATA.map((metadata) => resolveCapabilityDefinition(metadata, (key) => PRICES[key]));
}

interface Extracted {
  bazaar: {
    info: {
      input: { type: string; bodyType: string; body: unknown };
      output?: { type: string; example: unknown };
    };
    schema: {
      properties: {
        input: { properties: { body: unknown } };
        output?: { properties: { example: { properties?: unknown; required?: unknown } } };
      };
    };
  };
}

describe('buildBazaarDiscoveryExtension (pure)', () => {
  const weather = realCapabilities().find((c) => c.id === 'weather')!;
  const requestSchema: RequestJsonSchema = {
    type: 'object',
    properties: { latitude: { type: 'number' }, longitude: { type: 'number' } },
    required: ['latitude', 'longitude'],
  };

  it('declares an HTTP JSON body extension carrying the registry\'s input example', () => {
    const extension = buildBazaarDiscoveryExtension(weather, requestSchema) as unknown as Extracted;

    expect(extension.bazaar.info.input.type).toBe('http');
    expect(extension.bazaar.info.input.bodyType).toBe('json');
    expect(extension.bazaar.info.input.body).toEqual(weather.discovery.inputExample);
  });

  it('embeds the request JSON Schema (from the live DTO reflection) into the declared schema', () => {
    const extension = buildBazaarDiscoveryExtension(weather, requestSchema) as unknown as Extracted;
    expect(extension.bazaar.schema.properties.input.properties.body).toEqual(requestSchema);
  });

  it('carries the registry\'s output example and schema', () => {
    const extension = buildBazaarDiscoveryExtension(weather, requestSchema) as unknown as Extracted;

    expect(extension.bazaar.info.output?.type).toBe('json');
    expect(extension.bazaar.info.output?.example).toEqual(weather.discovery.outputExample);
    expect(extension.bazaar.schema.properties.output?.properties.example).toMatchObject({
      properties: weather.discovery.outputSchema.properties,
    });
  });

  it('falls back to an empty object schema when no live request schema was found', () => {
    const extension = buildBazaarDiscoveryExtension(weather, undefined) as unknown as Extracted;
    expect(extension.bazaar.schema.properties.input.properties.body).toEqual({ type: 'object', properties: {} });
  });
});

describe('buildDiscoveryExtensionsMap (E2E - needs a live Nest app for reflection)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('builds exactly one discovery extension per capability, keyed by capability id', () => {
    const capabilities = realCapabilities();
    const extensions = buildDiscoveryExtensionsMap(app, capabilities);

    expect(extensions.size).toBe(capabilities.length);
    for (const capability of capabilities) {
      expect(extensions.has(capability.id), `missing discovery extension for ${capability.id}`).toBe(true);
    }
  });

  it('every generated extension carries a "bazaar" key with info + schema', () => {
    const extensions = buildDiscoveryExtensionsMap(app, realCapabilities());
    for (const [id, extension] of extensions) {
      const bazaar = (extension as unknown as Extracted).bazaar;
      expect(bazaar.info, `missing info for ${id}`).toBeDefined();
      expect(bazaar.schema, `missing schema for ${id}`).toBeDefined();
    }
  });

  it('uses the live request schema for a capability with a required field, not an empty fallback', () => {
    const extensions = buildDiscoveryExtensionsMap(app, realCapabilities());
    const academicSearch = extensions.get('academic.search') as unknown as Extracted;
    const bodySchema = academicSearch.bazaar.schema.properties.input.properties.body as RequestJsonSchema;
    expect(bodySchema.required).toEqual(['query']);
  });
});
