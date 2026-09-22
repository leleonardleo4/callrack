import type { CapabilityDefinition } from '../capabilities/capability.types.js';
import type { CapabilityRequestSchemaService } from '../capabilities/capability-request-schema.service.js';
import type { RequestJsonSchema } from '../x402/discovery-schema.util.js';

export interface McpToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: RequestJsonSchema;
  readonly endpoint: {
    readonly method: 'POST';
    readonly url: string;
  };
  readonly price: {
    readonly amount: string;
    readonly currency: 'USDC';
  };
}

export interface McpManifestDocument {
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly transport: {
    readonly type: 'http';
    readonly url: string;
  };
  readonly tools: readonly McpToolDefinition[];
}

/**
 * Builds `/.well-known/mcp.json` - a discovery/description manifest in
 * MCP's tool-definition shape, matching the GoPlausible facilitator's
 * "MCP Manifest" badge schema, but NOT a live MCP server: there is no
 * stdio or SSE transport here an MCP client could actually open a session
 * against. `transport` is declared truthfully as plain HTTP, and every
 * "tool" is really the same x402-paid REST endpoint the rest of this API
 * already serves - described this way purely so an MCP-aware agent can
 * discover and construct a valid request without one. This mirrors how
 * other real facilitator merchants publish this exact badge (a static
 * manifest describing REST endpoints in MCP shape, not a fabricated live
 * transport) - never claim a live MCP server that doesn't exist.
 *
 * `inputSchema` comes from `CapabilityRequestSchemaService` - the same
 * reflection already computed once at bootstrap for `GET /v1/capabilities`
 * and the Bazaar discovery extension - never a second, hand-written copy.
 */
export function buildMcpManifest(
  capabilities: readonly CapabilityDefinition[],
  requestSchemaService: CapabilityRequestSchemaService,
  origin: string,
  apiVersion: string,
): McpManifestDocument {
  return {
    name: 'Callrack',
    description:
      'Callrack capabilities, described in MCP tool-manifest shape for agent discovery. There is no live ' +
      'MCP stdio/SSE transport to connect to - each tool below maps to a real x402-paid HTTP endpoint. Call ' +
      "it directly: an unpaid request returns 402 with the exact live price, pay it, then retry with a " +
      'PAYMENT-SIGNATURE header.',
    version: apiVersion,
    transport: {
      type: 'http',
      url: origin,
    },
    tools: capabilities.map((capability) => ({
      name: capability.id,
      description: `${capability.description} Paid per call via x402 (${capability.price.amount} USDC).`,
      inputSchema: requestSchemaService.getFor(capability.requestSchema) ?? { type: 'object', properties: {} },
      endpoint: {
        method: capability.method,
        url: `${origin}${capability.path}`,
      },
      price: {
        amount: capability.price.amount,
        currency: capability.price.currency,
      },
    })),
  };
}
