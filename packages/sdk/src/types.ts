/**
 * Mirrors the wire shape returned by `GET /v1/capabilities`
 * (apps/api/src/capabilities/public-capability.types.ts) and the API's
 * standard response envelopes. A type declaration only — every value comes
 * from the live endpoint at runtime, so this is not a second capability
 * registry, just the shape a framework-independent client needs to consume
 * one honestly.
 */

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
  | 'research'
  | 'information';

export type CapabilityProviderRef =
  | { readonly kind: 'provider'; readonly slugs: readonly string[] }
  | { readonly kind: 'composite' };

export interface CapabilityPricing {
  /** Exact decimal USDC string (e.g. "0.01") — never a float. */
  readonly amount: string;
  readonly currency: 'USDC';
}

export interface JsonSchemaProperty {
  readonly type?: string | readonly string[];
  readonly description?: string;
  readonly example?: unknown;
  readonly default?: unknown;
  readonly enum?: readonly unknown[];
  readonly minimum?: number;
  readonly maximum?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly items?: JsonSchemaProperty;
  readonly properties?: Record<string, JsonSchemaProperty>;
  readonly required?: readonly string[];
  readonly [key: string]: unknown;
}

export interface RequestJsonSchema {
  readonly type: 'object';
  readonly properties: Record<string, JsonSchemaProperty>;
  readonly required?: readonly string[];
}

export interface JsonObjectSchema {
  readonly properties: Record<string, unknown>;
  readonly required?: readonly string[];
}

export interface PublicCapability {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: CapabilityCategory;
  readonly method: 'POST';
  readonly path: string;
  readonly provider: CapabilityProviderRef;
  readonly price: CapabilityPricing;
  readonly status: 'active';
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

export interface ApiSuccessMeta {
  readonly requestId: string;
  readonly attribution?: string;
  readonly source?: string;
  readonly sourcesUsed?: readonly string[];
}

export interface ApiSuccessResponse<T> {
  readonly data: T;
  readonly meta: ApiSuccessMeta;
}

export interface ApiErrorPayload {
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
}

export interface ApiErrorResponse {
  readonly error: ApiErrorPayload;
  readonly meta: { readonly requestId: string };
}
