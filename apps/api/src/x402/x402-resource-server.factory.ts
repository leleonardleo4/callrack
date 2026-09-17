import { HTTPFacilitatorClient, x402ResourceServer } from '@x402/core/server';
import type { FacilitatorClient } from '@x402/core/server';
import type { Network } from '@x402/core/types';
import { ExactAvmScheme } from '@x402/avm/exact/server';
import { bazaarResourceServerExtension } from '@x402/extensions/bazaar';

/** The real, network-calling GoPlausible facilitator client — never used directly in automated tests. */
export function buildHttpFacilitatorClient(facilitatorUrl: string): FacilitatorClient {
  return new HTTPFacilitatorClient({ url: facilitatorUrl });
}

/**
 * Builds the core x402 resource server for the active Algorand network,
 * registering the AVM `exact` payment scheme and the Bazaar discovery
 * extension. This is transport-agnostic — Fastify wiring happens separately
 * in `install-x402-middleware.ts`.
 *
 * The Bazaar extension is registered exactly once, here, at the
 * resource-server level — never per capability/route. Individual routes
 * still each declare their own discovery metadata (see
 * `discovery-metadata.builder.ts`); this registration is what makes the
 * resource server understand and enrich (`enrichDeclaration`) those
 * per-route declarations at all.
 */
export function buildX402ResourceServer(
  facilitatorClient: FacilitatorClient,
  network: Network,
): x402ResourceServer {
  return new x402ResourceServer(facilitatorClient)
    .register(network, new ExactAvmScheme())
    .registerExtension(bazaarResourceServerExtension);
}
