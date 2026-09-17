import type { CapabilityDefinition } from '../capabilities/capability.types.js';

/**
 * Builds `/agents.md` — operating instructions for agents already using
 * Callrack, per the GoPlausible discovery guide's agents.md spec (not
 * indexed by the facilitator; read directly by agents). Endpoint list is
 * generated from the Capability Registry — never a hand-maintained,
 * driftable duplicate.
 */
export function buildAgentsMd(capabilities: readonly CapabilityDefinition[], origin: string): string {
  const endpointLines = capabilities
    .map((capability) => `- ${capability.method} ${capability.path} — ${capability.description} — ${capability.price.amount} USDC per call.`)
    .join('\n');

  return `# Callrack

Instructions for agents working with this service.

## Payment
Every endpoint listed below is x402-paid. On HTTP 402, read the PAYMENT-REQUIRED response header (base64 JSON)
for the exact current payment requirement, pay the advertised amount in USDC on Algorand, then retry the same
request with a PAYMENT-SIGNATURE header carrying your payment proof.

## Important rule
Treat the live HTTP 402 payment requirement as authoritative. Never hardcode or assume a price from this file,
from \`/llms.txt\`, or from any prior response — always read the current 402 challenge before paying.

## Endpoints
${endpointLines}

Full request/response schemas: [OpenAPI](${origin}/openapi.json) · [Interactive docs](${origin}/docs)

## Notes
- Settlement is handled by the GoPlausible facilitator — you never pay Algorand network fees directly.
- An unpaid or invalidly-paid request never runs the underlying capability; you always get a clean 402 back.
`;
}
