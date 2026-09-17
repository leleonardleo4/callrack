import type { Type } from '@nestjs/common';
import type { MoneyAmount } from '../config/money.js';
import type { PricingConfig } from '../config/pricing.schema.js';

export type CapabilityCategory =
  | 'academic'
  | 'news'
  | 'crypto'
  | 'finance'
  | 'weather'
  | 'geography'
  | 'calendar'
  | 'knowledge'
  | 'government'
  | 'research';

/**
 * How a capability is actually served: one or more provider adapters
 * (ordered primary-first, e.g. an in-capability fallback chain), or —
 * currently only `research` — a composition of other Callrack capabilities
 * rather than any single external provider.
 */
export type CapabilityProviderRef =
  | { readonly kind: 'provider'; readonly slugs: readonly string[] }
  | { readonly kind: 'composite' };

export interface CapabilityPricing {
  readonly amount: MoneyAmount;
  readonly currency: 'USDC';
}

export interface CapabilityCacheInfo {
  readonly ttlSeconds: number;
}

export type CapabilityStatus = 'active';

/**
 * A minimal JSON-Schema-shaped object description — deliberately not the
 * full JSON Schema spec type, just the subset the Bazaar discovery
 * extension actually consumes (see x402/discovery-metadata.builder.ts).
 */
export interface JsonObjectSchema {
  readonly properties: Record<string, unknown>;
  readonly required?: readonly string[];
}

/**
 * Everything needed to describe a capability's request/response contract to
 * an external, machine-readable discovery catalog (x402 Bazaar). Kept on the
 * registry — not in the x402 layer — because it's product/API metadata that
 * would remain meaningful even if x402 were replaced; `requestSchema` above
 * already covers the input *shape*, so only a representative input example
 * lives here (the live JSON Schema is derived from `requestSchema` at
 * discovery-build time — see x402/discovery-schema.util.ts). The response
 * shape has no runtime schema to introspect (response types are plain TS
 * interfaces), so its example and schema are both declared explicitly here.
 */
export interface CapabilityDiscoveryInfo {
  /** A small, valid, representative request body — never secrets or provider-specific fields. */
  readonly inputExample: Record<string, unknown>;
  /** A small, representative example of the actual public Callrack response envelope. */
  readonly outputExample: Record<string, unknown>;
  /** JSON-Schema-shaped description of `outputExample`'s top-level structure. */
  readonly outputSchema: JsonObjectSchema;
}

/**
 * Static, config-independent capability metadata — everything about a
 * capability except its resolved price. `priceKey` names which pricing-config
 * field supplies the price; `CapabilityRegistryService` resolves the actual
 * amount, so no price ever appears as a literal here.
 */
export interface CapabilityMetadata {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: CapabilityCategory;
  readonly method: 'POST';
  readonly path: string;
  readonly provider: CapabilityProviderRef;
  readonly priceKey: keyof PricingConfig;
  readonly cache?: CapabilityCacheInfo;
  readonly status: CapabilityStatus;
  /** The actual class-validator DTO this route validates against — never duplicated. */
  readonly requestSchema: Type<object>;
  /** Name of the response type (a plain TS interface, so no runtime class exists to reference). */
  readonly responseSchemaName: string;
  readonly discovery: CapabilityDiscoveryInfo;
}

/** A `CapabilityMetadata` entry with its price resolved from configuration — the registry's public shape. */
export interface CapabilityDefinition extends Omit<CapabilityMetadata, 'priceKey'> {
  readonly price: CapabilityPricing;
}
