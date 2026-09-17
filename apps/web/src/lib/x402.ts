/**
 * The x402 PAYMENT-REQUIRED challenge shape (see @x402/core/types
 * `PaymentRequired`/`PaymentRequirements` — verified directly against the
 * installed `@x402/core@2.26.0` package). A 402 response body is empty; the
 * whole challenge is base64-encoded JSON in the `PAYMENT-REQUIRED` response
 * header. This is a small local decoder rather than importing `@x402/core`
 * (a server-oriented package) into the browser bundle.
 */

export interface PaymentRequirements {
  readonly scheme: string;
  readonly network: string;
  readonly asset: string;
  /** Atomic (base-unit) amount as a decimal string — never convert with floating point. */
  readonly amount: string;
  readonly payTo: string;
  readonly maxTimeoutSeconds: number;
  readonly extra: Record<string, unknown>;
}

export interface ResourceInfo {
  readonly url: string;
  readonly description?: string;
  readonly mimeType?: string;
  readonly serviceName?: string;
  readonly tags?: readonly string[];
  readonly iconUrl?: string;
}

export interface PaymentRequired {
  readonly x402Version: number;
  readonly error?: string;
  readonly resource: ResourceInfo;
  readonly accepts: readonly PaymentRequirements[];
  readonly extensions?: Record<string, unknown>;
}

export const PAYMENT_REQUIRED_HEADER = 'payment-required';
export const PAYMENT_SIGNATURE_HEADER = 'PAYMENT-SIGNATURE';
export const PAYMENT_RESPONSE_HEADER = 'payment-response';

/** Base64 → UTF-8 JSON, without assuming a Node `Buffer` is available. */
function base64DecodeUtf8(value: string): string {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

export function decodePaymentRequiredHeader(header: string): PaymentRequired {
  return JSON.parse(base64DecodeUtf8(header)) as PaymentRequired;
}

/**
 * Decodes the `PAYMENT-RESPONSE` settlement header that comes back on a
 * successfully paid request. Its exact field set isn't pinned down as a
 * dedicated local type (unlike `PaymentRequired`) — it's shown as raw,
 * decoded JSON rather than risk asserting a shape that hasn't been verified
 * against the installed `@x402/core` package.
 */
export function decodePaymentResponseHeader(header: string): Record<string, unknown> {
  return JSON.parse(base64DecodeUtf8(header)) as Record<string, unknown>;
}
