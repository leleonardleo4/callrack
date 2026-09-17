import { getDefaultAsset } from '@x402/avm';
import type { CapabilityDefinition } from '../capabilities/capability.types.js';
import type { ActiveX402NetworkConfig } from '../config/x402-config.service.js';

/**
 * Builds `/llms.txt` — plain markdown for LLMs, per the GoPlausible
 * discovery guide's llms.txt spec. The facilitator takes the first `#`
 * heading as the name, so it must be exactly `# Callrack`. Every endpoint,
 * price, network, and asset here is read live from the Capability Registry
 * and the active x402 config — never a hand-maintained duplicate that could
 * drift from the real prices in the 402 responses.
 */
export function buildLlmsTxt(
  capabilities: readonly CapabilityDefinition[],
  active: ActiveX402NetworkConfig,
  origin: string,
  facilitatorUrl: string,
): string {
  const usdc = getDefaultAsset(active.caip2Network, 'USDC');
  const networkLabel = active.network === 'mainnet' ? 'Algorand MainNet' : 'Algorand TestNet';

  const endpointLines = capabilities
    .map((capability) => `- [${capability.name}](${origin}${capability.path}): ${capability.description} ${capability.price.amount} USDC per call.`)
    .join('\n');

  return `# Callrack

> Callrack is a pay-per-use information infrastructure platform. Every capability below answers HTTP 402
> with x402 payment requirements; pay the advertised amount in USDC on Algorand and the response is yours.
> No accounts, no API keys, no subscriptions.

## Paid endpoints
${endpointLines}

## Paying
- Protocol: x402 (v2), settled by ${facilitatorUrl}
- Network: ${networkLabel} · Asset: USDC (${usdc.asset})
- On HTTP 402, read the PAYMENT-REQUIRED response header (base64 JSON) for the exact, current price — never
  assume a price from this file; it can change.
- Clients: any x402 client — see ${facilitatorUrl}/guide

## Docs
- [OpenAPI](${origin}/openapi.json)
- [Interactive docs](${origin}/docs)
- [Operating instructions for agents](${origin}/agents.md)
`;
}
