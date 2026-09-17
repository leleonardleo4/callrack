import type { FastifyRequest } from 'fastify';

/**
 * Resolves the actual public origin (protocol + host, no trailing slash)
 * the current request arrived on — never a hardcoded `localhost`. In local
 * development this naturally resolves to `http://localhost:<port>`; once
 * deployed behind `api.callrack.xyz`, it resolves to that real origin. This
 * is the same "derive from the live request, don't hardcode a guess"
 * approach the x402 SDK itself uses for `PaymentRequired.resource.url`.
 *
 * Correct behavior behind a reverse proxy requires Fastify's `trustProxy`
 * to be configured at the real deployment (so `X-Forwarded-*` headers are
 * honored) — that's a deployment concern, not something this function can
 * or should fix.
 */
export function resolveRequestOrigin(req: FastifyRequest): string {
  return `${req.protocol}://${req.hostname}`;
}
