import type { RequestJsonSchema } from '../x402/discovery-schema.util.js';
import type { CapabilityCategory, CapabilityPricing, CapabilityProviderRef, CapabilityStatus, JsonObjectSchema } from './capability.types.js';

/**
 * The safe, public shape of a capability - everything a developer or agent
 * needs to discover, price, and call it, and nothing else. Deliberately
 * excludes `priceKey` (an internal config field name), the request DTO
 * *class* (a server-only construct; `requestSchema` below is its public JSON
 * Schema projection instead), and any cache/internal wiring detail.
 */
export interface PublicCapability {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: CapabilityCategory;
  readonly method: 'POST';
  readonly path: string;
  readonly provider: CapabilityProviderRef;
  readonly price: CapabilityPricing;
  readonly status: CapabilityStatus;
  /** JSON Schema for the request body - the same reflection x402's Bazaar extension uses, never a hand-duplicated copy. */
  readonly requestSchema: RequestJsonSchema;
  readonly example: {
    readonly request: Record<string, unknown>;
    readonly response: Record<string, unknown>;
  };
  readonly responseSchema: JsonObjectSchema;
}

export interface PublicNetworkInfo {
  readonly name: 'testnet' | 'mainnet';
  readonly caip2: string;
  readonly facilitatorUrl: string;
}

export interface PublicCapabilitiesData {
  readonly capabilities: readonly PublicCapability[];
  readonly network: PublicNetworkInfo;
}
