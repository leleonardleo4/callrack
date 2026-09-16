import { describe, expect, it } from 'vitest';
import { ProviderRegistry } from '../../src/providers/provider-registry.service.js';
import type { ProviderAdapter, ProviderHealth, ProviderMetadata } from '../../src/providers/common/index.js';

function fakeProvider(slug: string): ProviderAdapter {
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

describe('ProviderRegistry', () => {
  it('registers and resolves a provider by slug', () => {
    const registry = new ProviderRegistry();
    const provider = fakeProvider('academic.openalex');

    registry.register('academic.openalex', provider);

    expect(registry.has('academic.openalex')).toBe(true);
    expect(registry.resolve('academic.openalex')).toBe(provider);
  });

  it('throws when resolving an unregistered provider', () => {
    const registry = new ProviderRegistry();
    expect(() => registry.resolve('missing.provider')).toThrow(/not registered/);
  });

  it('throws when registering the same slug twice', () => {
    const registry = new ProviderRegistry();
    registry.register('academic.openalex', fakeProvider('academic.openalex'));

    expect(() => registry.register('academic.openalex', fakeProvider('academic.openalex'))).toThrow(
      /already registered/,
    );
  });

  it('lists all registered providers', () => {
    const registry = new ProviderRegistry();
    registry.register('academic.openalex', fakeProvider('academic.openalex'));
    registry.register('crypto.coingecko', fakeProvider('crypto.coingecko'));

    expect(registry.list()).toHaveLength(2);
  });

  it('reports false for an unregistered slug', () => {
    const registry = new ProviderRegistry();
    expect(registry.has('nothing.here')).toBe(false);
  });
});
