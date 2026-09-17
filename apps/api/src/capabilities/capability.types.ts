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
}

/** A `CapabilityMetadata` entry with its price resolved from configuration — the registry's public shape. */
export interface CapabilityDefinition extends Omit<CapabilityMetadata, 'priceKey'> {
  readonly price: CapabilityPricing;
}
