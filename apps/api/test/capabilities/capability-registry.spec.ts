import { describe, expect, it } from 'vitest';
import type { ProviderAdapter, ProviderHealth, ProviderMetadata } from '../../src/providers/common/index.js';
import { ProviderRegistry } from '../../src/providers/provider-registry.service.js';
import { PricingConfigService } from '../../src/config/pricing-config.service.js';
import { CAPABILITY_METADATA } from '../../src/capabilities/capability-definitions.js';
import {
  indexCapabilities,
  resolveCapabilityDefinition,
  validateCapabilityDefinitions,
} from '../../src/capabilities/capability-registry.util.js';
import { CapabilityRegistryService } from '../../src/capabilities/capability-registry.service.js';
import type { CapabilityDefinition, CapabilityMetadata } from '../../src/capabilities/capability.types.js';

const VALID_ENV: Record<string, string> = {
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

// Derived directly from each capability's controller (one route per file):
// academic.controller.ts -> academic.search, academic.work
// news.controller.ts -> news.search, news.trends
// crypto.controller.ts -> crypto.price, crypto.market
// fx.controller.ts -> fx.rates
// weather.controller.ts -> weather
// geocode.controller.ts -> geocode
// holidays.controller.ts -> holidays
// knowledge.controller.ts -> knowledge.search
// government.controller.ts -> government.census
// research.controller.ts -> research
// verify.controller.ts -> information.verify
// evidence.controller.ts -> information.evidence
// compare.controller.ts -> information.compare
const EXPECTED_CAPABILITY_IDS = [
  'academic.search',
  'academic.work',
  'news.search',
  'news.trends',
  'crypto.price',
  'crypto.market',
  'fx.rates',
  'weather',
  'geocode',
  'holidays',
  'knowledge.search',
  'government.census',
  'research',
  'information.verify',
  'information.evidence',
  'information.compare',
].sort();

const KNOWN_PROVIDER_SLUGS = [
  'academic.openalex',
  'academic.crossref',
  'news.gdelt',
  'crypto.coingecko',
  'fx.frankfurter',
  'weather.openmeteo',
  'geocode.photon',
  'holidays.nager',
  'knowledge.wikimedia',
  'government.census',
];

function fakeProviderAdapter(slug: string): ProviderAdapter {
  const metadata: ProviderMetadata = {
    slug,
    name: slug,
    description: 'fake',
    category: 'academic',
    website: 'https://example.test',
    attributionRequired: false,
  };
  return {
    metadata,
    async checkHealth(): Promise<ProviderHealth> {
      return { provider: slug, healthy: true };
    },
  };
}

function buildProviderRegistry(slugs: string[]): ProviderRegistry {
  const registry = new ProviderRegistry();
  for (const slug of slugs) {
    registry.register(slug, fakeProviderAdapter(slug));
  }
  return registry;
}

function resolveAll(pricing: PricingConfigService): CapabilityDefinition[] {
  return CAPABILITY_METADATA.map((metadata) => resolveCapabilityDefinition(metadata, (key) => pricing.getAmount(key)));
}

describe('CAPABILITY_METADATA (registration)', () => {
  it('registers exactly the capabilities implemented by the current controllers, no more and no fewer', () => {
    const actualIds = CAPABILITY_METADATA.map((c) => c.id).sort();
    expect(actualIds).toEqual(EXPECTED_CAPABILITY_IDS);
    expect(CAPABILITY_METADATA.length).toBe(EXPECTED_CAPABILITY_IDS.length);
  });

  it('gives every capability a complete, non-empty metadata shape', () => {
    for (const capability of CAPABILITY_METADATA) {
      expect(capability.id.length).toBeGreaterThan(0);
      expect(capability.name.length).toBeGreaterThan(0);
      expect(capability.description.length).toBeGreaterThan(0);
      expect(capability.method).toBe('POST');
      expect(capability.path.startsWith('/v1/')).toBe(true);
      expect(capability.status).toBe('active');
      expect(capability.responseSchemaName.length).toBeGreaterThan(0);
      expect(typeof capability.requestSchema).toBe('function');
      expect(capability.priceKey.startsWith('PRICE_')).toBe(true);
    }
  });

  it('never names a capability after an external vendor brand (e.g. "openalex", "coingecko")', () => {
    // "census" and "government" are generic, descriptive product terms (the
    // capability really is a Census query), not a private vendor's brand —
    // unlike "openalex"/"coingecko"/etc., which are specific companies'
    // product names that must stay confined to the provider layer.
    const externalVendorBrands = [
      'openalex',
      'crossref',
      'gdelt',
      'coingecko',
      'frankfurter',
      'openmeteo',
      'open-meteo',
      'photon',
      'nager',
      'wikimedia',
      'wikidata',
    ];
    for (const capability of CAPABILITY_METADATA) {
      for (const brand of externalVendorBrands) {
        expect(capability.id.toLowerCase()).not.toContain(brand);
      }
    }
  });

  it('marks research as a composition capability, never a single-provider one', () => {
    const research = CAPABILITY_METADATA.find((c) => c.id === 'research');
    expect(research?.provider).toEqual({ kind: 'composite' });
  });

  it('gives academic.work a provider fallback chain (openalex, then crossref)', () => {
    const work = CAPABILITY_METADATA.find((c) => c.id === 'academic.work');
    expect(work?.provider).toEqual({ kind: 'provider', slugs: ['academic.openalex', 'academic.crossref'] });
  });

  it('declares every non-composite capability path exactly once (no duplicate routes)', () => {
    const routes = CAPABILITY_METADATA.map((c) => `${c.method} ${c.path}`);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it('gives every capability Bazaar discovery metadata: an input example, an output example, and an output schema', () => {
    for (const capability of CAPABILITY_METADATA) {
      expect(capability.discovery, `missing discovery block for ${capability.id}`).toBeDefined();
      expect(
        Object.keys(capability.discovery.inputExample).length,
        `empty input example for ${capability.id}`,
      ).toBeGreaterThan(0);
      expect(
        Object.keys(capability.discovery.outputExample).length,
        `empty output example for ${capability.id}`,
      ).toBeGreaterThan(0);
      expect(
        Object.keys(capability.discovery.outputSchema.properties).length,
        `empty output schema for ${capability.id}`,
      ).toBeGreaterThan(0);
    }
  });

  it('describes research as deterministic composition, never as using an LLM', () => {
    const research = CAPABILITY_METADATA.find((c) => c.id === 'research')!;
    expect(research.description.toLowerCase()).not.toContain('llm');
    expect(research.description.toLowerCase()).not.toContain('artificial intelligence');
    expect(research.description.toLowerCase()).toContain('deterministic');
  });
});

describe('resolveCapabilityDefinition', () => {
  const sample: CapabilityMetadata = CAPABILITY_METADATA.find((c) => c.id === 'academic.search')!;

  it('attaches the resolved price as an exact string, never a number', () => {
    const definition = resolveCapabilityDefinition(sample, () => '0.01');
    expect(definition.price).toEqual({ amount: '0.01', currency: 'USDC' });
    expect(typeof definition.price.amount).toBe('string');
  });

  it('does not perform arithmetic on the resolved amount', () => {
    const definition = resolveCapabilityDefinition(sample, () => '0.010');
    // If this were coerced through a number, "0.010" would become "0.01".
    expect(definition.price.amount).toBe('0.010');
  });

  it('drops priceKey from the resolved definition', () => {
    const definition = resolveCapabilityDefinition(sample, () => '0.01');
    expect('priceKey' in definition).toBe(false);
  });
});

describe('indexCapabilities', () => {
  const pricing = new PricingConfigService(VALID_ENV);
  const definitions = resolveAll(pricing);

  it('indexes every capability by id and by route', () => {
    const { byId, byRoute } = indexCapabilities(definitions);
    expect(byId.size).toBe(definitions.length);
    expect(byRoute.size).toBe(definitions.length);
    expect(byId.get('research')?.id).toBe('research');
    expect(byRoute.get('POST /v1/research')?.id).toBe('research');
  });

  it('throws on a duplicate capability id', () => {
    const duplicated = [...definitions, { ...definitions[0], path: '/v1/duplicate-path' }];
    expect(() => indexCapabilities(duplicated)).toThrow(/Duplicate capability id/);
  });

  it('throws on a duplicate method+path route, even with distinct ids', () => {
    const duplicated = [...definitions, { ...definitions[0], id: 'academic.search.duplicate' }];
    expect(() => indexCapabilities(duplicated)).toThrow(/Duplicate capability route/);
  });
});

describe('validateCapabilityDefinitions', () => {
  const pricing = new PricingConfigService(VALID_ENV);
  const definitions = resolveAll(pricing);
  const allProvidersKnown = () => true;

  it('passes for the real, fully-resolved capability list when every provider is known', () => {
    expect(() => validateCapabilityDefinitions(definitions, allProvidersKnown)).not.toThrow();
  });

  it('throws when a capability references an unknown provider', () => {
    expect(() => validateCapabilityDefinitions(definitions, () => false)).toThrow(
      /references unknown provider/,
    );
  });

  it('throws when a capability has an empty name', () => {
    const broken = definitions.map((d) => (d.id === 'weather' ? { ...d, name: '' } : d));
    expect(() => validateCapabilityDefinitions(broken, allProvidersKnown)).toThrow(/missing a name/);
  });

  it('throws when a capability has an empty description', () => {
    const broken = definitions.map((d) => (d.id === 'weather' ? { ...d, description: '  ' } : d));
    expect(() => validateCapabilityDefinitions(broken, allProvidersKnown)).toThrow(/missing a description/);
  });

  it('throws when a capability has an invalid price amount', () => {
    const broken = definitions.map((d) =>
      d.id === 'weather' ? { ...d, price: { ...d.price, amount: 'not-a-number' } } : d,
    );
    expect(() => validateCapabilityDefinitions(broken, allProvidersKnown)).toThrow(/invalid price amount/);
  });

  it('throws when a capability has a negative price amount', () => {
    const broken = definitions.map((d) => (d.id === 'weather' ? { ...d, price: { ...d.price, amount: '-1' } } : d));
    expect(() => validateCapabilityDefinitions(broken, allProvidersKnown)).toThrow(/invalid price amount/);
  });

  it('throws when a capability has an unsupported currency', () => {
    const broken = definitions.map((d) =>
      d.id === 'weather' ? { ...d, price: { amount: d.price.amount, currency: 'USD' as 'USDC' } } : d,
    );
    expect(() => validateCapabilityDefinitions(broken, allProvidersKnown)).toThrow(/unsupported currency/);
  });

  it('throws when a provider-backed capability declares no provider slugs', () => {
    const broken = definitions.map((d) =>
      d.id === 'weather' ? { ...d, provider: { kind: 'provider' as const, slugs: [] } } : d,
    );
    expect(() => validateCapabilityDefinitions(broken, allProvidersKnown)).toThrow(/with no slugs/);
  });

  it('throws when a capability is missing discovery metadata entirely', () => {
    const broken = definitions.map((d) => {
      if (d.id !== 'weather') return d;
      const { discovery: _discovery, ...rest } = d;
      return rest as typeof d;
    });
    expect(() => validateCapabilityDefinitions(broken, allProvidersKnown)).toThrow(/missing discovery metadata/);
  });

  it('throws when a capability has an empty discovery input example', () => {
    const broken = definitions.map((d) =>
      d.id === 'weather' ? { ...d, discovery: { ...d.discovery, inputExample: {} } } : d,
    );
    expect(() => validateCapabilityDefinitions(broken, allProvidersKnown)).toThrow(/missing a discovery input example/);
  });

  it('throws when a capability has an empty discovery output example', () => {
    const broken = definitions.map((d) =>
      d.id === 'weather' ? { ...d, discovery: { ...d.discovery, outputExample: {} } } : d,
    );
    expect(() => validateCapabilityDefinitions(broken, allProvidersKnown)).toThrow(/missing a discovery output example/);
  });

  it('throws when a capability has an empty discovery output schema', () => {
    const broken = definitions.map((d) =>
      d.id === 'weather' ? { ...d, discovery: { ...d.discovery, outputSchema: { properties: {} } } } : d,
    );
    expect(() => validateCapabilityDefinitions(broken, allProvidersKnown)).toThrow(/missing a discovery output schema/);
  });
});

describe('CapabilityRegistryService', () => {
  function buildService(): CapabilityRegistryService {
    const pricing = new PricingConfigService(VALID_ENV);
    const providers = buildProviderRegistry(KNOWN_PROVIDER_SLUGS);
    return new CapabilityRegistryService(pricing, providers);
  }

  it('lists exactly the expected number of capabilities', () => {
    const registry = buildService();
    expect(registry.list().length).toBe(EXPECTED_CAPABILITY_IDS.length);
  });

  it('resolves a capability by id', () => {
    const registry = buildService();
    const academic = registry.getById('academic.search');
    expect(academic?.id).toBe('academic.search');
    expect(academic?.price).toEqual({ amount: '0.01', currency: 'USDC' });
  });

  it('returns undefined for an unknown id', () => {
    const registry = buildService();
    expect(registry.getById('coingecko.price')).toBeUndefined();
  });

  it('resolves a capability by method and path', () => {
    const registry = buildService();
    expect(registry.getByPath('POST', '/v1/research')?.id).toBe('research');
    expect(registry.getByPath('post', '/v1/research')?.id).toBe('research');
  });

  it('returns undefined for an unregistered route', () => {
    const registry = buildService();
    expect(registry.getByPath('POST', '/v1/does-not-exist')).toBeUndefined();
    expect(registry.getByPath('GET', '/v1/research')).toBeUndefined();
  });

  it('has() reflects registered vs. unregistered ids', () => {
    const registry = buildService();
    expect(registry.has('research')).toBe(true);
    expect(registry.has('research.summary')).toBe(false);
  });

  it('resolves capabilities by provider, including multi-capability providers', () => {
    const registry = buildService();
    expect(registry.getByProvider('academic.openalex').map((c) => c.id).sort()).toEqual([
      'academic.search',
      'academic.work',
    ]);
    expect(registry.getByProvider('news.gdelt').map((c) => c.id).sort()).toEqual(['news.search', 'news.trends']);
    expect(registry.getByProvider('crypto.coingecko').map((c) => c.id).sort()).toEqual([
      'crypto.market',
      'crypto.price',
    ]);
  });

  it('returns no capabilities for an unrecognized provider, including composite capabilities', () => {
    const registry = buildService();
    expect(registry.getByProvider('unknown.provider')).toEqual([]);
    // "research" is composite, so it must never show up under any provider slug.
    expect(registry.getByProvider('research')).toEqual([]);
  });

  it('fails fast at construction when the underlying pricing config is invalid', () => {
    const { PRICE_RESEARCH, ...brokenEnv } = VALID_ENV;
    const brokenPricing = () => new PricingConfigService(brokenEnv);
    expect(brokenPricing).toThrow(/Callrack pricing configuration validation failed/);
  });

  it('onModuleInit succeeds when every referenced provider is known', () => {
    const registry = buildService();
    expect(() => registry.onModuleInit()).not.toThrow();
  });

  it('onModuleInit throws when a referenced provider is unknown', () => {
    const pricing = new PricingConfigService(VALID_ENV);
    const incompleteProviders = buildProviderRegistry(KNOWN_PROVIDER_SLUGS.filter((s) => s !== 'weather.openmeteo'));
    const registry = new CapabilityRegistryService(pricing, incompleteProviders);
    expect(() => registry.onModuleInit()).toThrow(/references unknown provider "weather.openmeteo"/);
  });

  it('list() returns a snapshot that callers cannot use to mutate internal state', () => {
    const registry = buildService();
    const first = registry.list();
    first.push({ ...first[0], id: 'injected' });
    expect(registry.list().length).toBe(EXPECTED_CAPABILITY_IDS.length);
  });
});
