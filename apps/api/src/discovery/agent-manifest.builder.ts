export interface AgentManifestDocument {
  readonly name: string;
  readonly description: string;
  readonly url: string;
  readonly documentation: string;
  readonly payments: {
    readonly protocol: 'x402';
    readonly network: 'algorand';
    readonly asset: 'USDC';
  };
}

/**
 * Builds `/.well-known/agent.json` - the generic agent manifest convention
 * from the GoPlausible discovery guide (distinct from the A2A agent-card).
 * `documentation` points at this same origin's `/llms.txt`, which is real
 * and always current (see `llms-txt.builder.ts`) - never a placeholder URL.
 */
export function buildAgentManifest(origin: string): AgentManifestDocument {
  return {
    name: 'Callrack',
    description:
      'Callrack is a pay-per-use information infrastructure platform, paid per request in USDC on Algorand via x402.',
    url: origin,
    documentation: `${origin}/llms.txt`,
    payments: { protocol: 'x402', network: 'algorand', asset: 'USDC' },
  };
}
