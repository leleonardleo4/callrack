import { convertToTokenAmount, getDefaultAsset } from '@x402/avm';
import type { CapabilityDefinition } from '../capabilities/capability.types.js';
import type { ActiveX402NetworkConfig } from '../config/x402-config.service.js';

export interface WellKnownX402Resource {
  readonly url: string;
  readonly method: 'POST';
  readonly description: string;
  readonly network: string;
  readonly asset: string;
  readonly amount: string;
  readonly payTo: string;
}

export interface WellKnownX402Document {
  readonly x402Version: 2;
  readonly name: string;
  readonly description: string;
  readonly resources: readonly WellKnownX402Resource[];
}

/**
 * Builds the `/.well-known/x402` static discovery index - a convenience for
 * agents that want to check prices before making any request, entirely
 * separate from Bazaar listing (which requires the `bazaar` extension plus
 * a real settled payment, not this file).
 *
 * Every field is derived from the Capability Registry and the active x402
 * network config - nothing here is a second, hand-maintained route list.
 * The USDC asset id and the atomic-unit amount conversion both come from
 * `@x402/avm`'s own exports (`getDefaultAsset`, `convertToTokenAmount`) -
 * the exact same resolution the payment layer itself uses - so this can
 * never silently diverge from the real 402 challenge amounts, and never
 * performs floating-point arithmetic.
 */
export function buildWellKnownX402(
  capabilities: readonly CapabilityDefinition[],
  active: ActiveX402NetworkConfig,
  origin: string,
): WellKnownX402Document {
  const usdc = getDefaultAsset(active.caip2Network, 'USDC');

  return {
    x402Version: 2,
    name: 'Callrack',
    description:
      'Callrack is a pay-per-use information infrastructure platform - every capability below is paid per ' +
      'request in USDC on Algorand via the x402 protocol. No accounts, no API keys, no subscriptions.',
    resources: capabilities.map((capability) => ({
      url: `${origin}${capability.path}`,
      method: capability.method,
      description: `${capability.description} - ${capability.price.amount} USDC per call.`,
      network: active.caip2Network,
      asset: usdc.asset,
      amount: convertToTokenAmount(capability.price.amount, usdc.decimals),
      payTo: active.payTo,
    })),
  };
}
