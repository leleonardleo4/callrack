import { convertToTokenAmount } from '../money.js';
import type { PublicCapability } from '../types.js';
import type { AgentTool } from './types.js';

/**
 * Projects discovered capabilities into agent tools, deliberately dropping
 * `PublicCapability.provider` - an agent's tool list names Callrack
 * capabilities only, never the upstream provider behind them.
 */
export function buildToolsFromCapabilities(
  capabilities: readonly PublicCapability[],
  usdcDecimals: number,
): readonly AgentTool[] {
  return capabilities.map((capability) => ({
    id: capability.id,
    name: capability.name,
    description: capability.description,
    category: capability.category,
    inputSchema: capability.requestSchema,
    outputSchema: capability.responseSchema,
    price: capability.price,
    priceAtomic: convertToTokenAmount(capability.price.amount, usdcDecimals),
  }));
}
