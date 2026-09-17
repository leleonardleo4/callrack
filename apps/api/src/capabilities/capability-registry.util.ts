import { isValidMoneyAmount } from '../config/money.js';
import type { PricingConfig } from '../config/pricing.schema.js';
import type { CapabilityDefinition, CapabilityMetadata } from './capability.types.js';

/** Resolves one capability's price from configuration, producing its public `CapabilityDefinition`. */
export function resolveCapabilityDefinition(
  metadata: CapabilityMetadata,
  getPrice: (key: keyof PricingConfig) => string,
): CapabilityDefinition {
  const { priceKey, ...rest } = metadata;
  return { ...rest, price: { amount: getPrice(priceKey), currency: 'USDC' } };
}

export interface CapabilityIndex {
  readonly byId: ReadonlyMap<string, CapabilityDefinition>;
  readonly byRoute: ReadonlyMap<string, CapabilityDefinition>;
}

function routeKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`;
}

/** Builds id/route lookup maps, throwing immediately on any duplicate — the registry's single source of truth. */
export function indexCapabilities(definitions: readonly CapabilityDefinition[]): CapabilityIndex {
  const byId = new Map<string, CapabilityDefinition>();
  const byRoute = new Map<string, CapabilityDefinition>();

  for (const definition of definitions) {
    if (byId.has(definition.id)) {
      throw new Error(`Duplicate capability id "${definition.id}" in capability registry`);
    }
    byId.set(definition.id, definition);

    const key = routeKey(definition.method, definition.path);
    const existing = byRoute.get(key);
    if (existing) {
      throw new Error(
        `Duplicate capability route "${key}" — used by both "${existing.id}" and "${definition.id}"`,
      );
    }
    byRoute.set(key, definition);
  }

  return { byId, byRoute };
}

/**
 * Structural validation beyond duplicate detection: every capability must
 * have real metadata, a valid price, and (for provider-backed capabilities)
 * only reference providers that actually exist. Throws on the first problem
 * found — this is meant to fail application startup, not a request.
 */
export function validateCapabilityDefinitions(
  definitions: readonly CapabilityDefinition[],
  hasProvider: (slug: string) => boolean,
): void {
  for (const definition of definitions) {
    if (!definition.id.trim()) {
      throw new Error('A capability is missing an id');
    }
    if (!definition.name.trim()) {
      throw new Error(`Capability "${definition.id}" is missing a name`);
    }
    if (!definition.description.trim()) {
      throw new Error(`Capability "${definition.id}" is missing a description`);
    }
    if (!definition.responseSchemaName.trim()) {
      throw new Error(`Capability "${definition.id}" is missing response schema metadata`);
    }
    if (!definition.path.startsWith('/')) {
      throw new Error(`Capability "${definition.id}" has an invalid path "${definition.path}"`);
    }

    if (definition.provider.kind === 'provider') {
      if (definition.provider.slugs.length === 0) {
        throw new Error(`Capability "${definition.id}" declares a provider reference with no slugs`);
      }
      for (const slug of definition.provider.slugs) {
        if (!hasProvider(slug)) {
          throw new Error(`Capability "${definition.id}" references unknown provider "${slug}"`);
        }
      }
    }

    if (!isValidMoneyAmount(definition.price.amount)) {
      throw new Error(`Capability "${definition.id}" has an invalid price amount "${definition.price.amount}"`);
    }
    if (definition.price.currency !== 'USDC') {
      throw new Error(`Capability "${definition.id}" has an unsupported currency "${definition.price.currency}"`);
    }
  }
}
