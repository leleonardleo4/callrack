/**
 * The x402 HTTP header names, verified directly against the installed
 * `@x402/core@2.26.0` package (see `server/index.js`'s
 * `processHTTPRequest`/`processSettlement`, which set/read these exact
 * strings). `@x402/core` doesn't export them as constants, so - matching
 * `apps/web/src/lib/x402.ts`'s own local copy of the same names - they're
 * defined once here rather than hardcoded at each call site.
 */
export const PAYMENT_REQUIRED_HEADER = 'PAYMENT-REQUIRED';
export const PAYMENT_SIGNATURE_HEADER = 'PAYMENT-SIGNATURE';
export const PAYMENT_RESPONSE_HEADER = 'PAYMENT-RESPONSE';
