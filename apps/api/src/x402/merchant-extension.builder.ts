/**
 * Callrack's x402-merchant identity, declared once and attached to every
 * paid route. Per the GoPlausible discovery guide, the facilitator reads
 * `x402-merchant.website` as the enrichment origin (root-page metadata +
 * well-known files) in preference to the domain of the most recently active
 * paid endpoint — Callrack's paid endpoints live on the API subdomain, but
 * the brand lives on the root domain, so this is declared explicitly rather
 * than left to fall back to the API domain.
 *
 * `logo` points at the real, official Callrack brand asset
 * (`apps/web/public/favicon.png`) — never a fabricated URL.
 */
export const CALLRACK_MERCHANT_INFO = {
  name: 'Callrack',
  website: 'https://callrack.xyz',
  logo: 'https://callrack.xyz/favicon.png',
  categories: ['api', 'information', 'algorand', 'x402'],
} as const;

/**
 * x402 v2 extensions carry both the declared `info` and a JSON Schema
 * describing it — this mirrors the exact shape from the GoPlausible guide's
 * `x402-merchant` example.
 */
export function buildX402MerchantExtension(): Record<string, unknown> {
  return {
    'x402-merchant': {
      info: CALLRACK_MERCHANT_INFO,
      schema: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          website: { type: 'string' },
          logo: { type: 'string' },
          categories: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  };
}
