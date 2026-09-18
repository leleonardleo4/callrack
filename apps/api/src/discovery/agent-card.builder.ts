import type { CapabilityDefinition } from '../capabilities/capability.types.js';

export interface AgentCardSkill {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly tags: readonly string[];
}

export interface AgentCardDocument {
  readonly name: string;
  readonly description: string;
  readonly url: string;
  readonly version: string;
  readonly capabilities: { readonly streaming: false };
  readonly defaultInputModes: readonly string[];
  readonly defaultOutputModes: readonly string[];
  readonly skills: readonly AgentCardSkill[];
}

/**
 * Builds `/.well-known/agent-card.json` (the A2A agent-card convention from
 * the GoPlausible discovery guide). One skill per real, currently-registered
 * paid capability - never a fabricated capability. `streaming` is always
 * `false`: Callrack has no streaming endpoints.
 */
export function buildAgentCard(
  capabilities: readonly CapabilityDefinition[],
  origin: string,
  apiVersion: string,
): AgentCardDocument {
  return {
    name: 'Callrack',
    description:
      'Callrack is a pay-per-use information infrastructure platform - academic, news, market, weather, ' +
      'geocoding, knowledge, government, and research-aggregation capabilities, each paid per request in USDC ' +
      'on Algorand via x402.',
    url: origin,
    version: apiVersion,
    capabilities: { streaming: false },
    defaultInputModes: ['application/json'],
    defaultOutputModes: ['application/json'],
    skills: capabilities.map((capability) => ({
      id: capability.id,
      name: capability.name,
      description: `${capability.description} Paid per call via x402 (${capability.price.amount} USDC).`,
      tags: ['x402', 'algorand', capability.category],
    })),
  };
}
