import { HTTPFacilitatorClient, x402ResourceServer } from '@x402/core/server';
import type { FacilitatorClient } from '@x402/core/server';
import type { Network } from '@x402/core/types';
import { ExactAvmScheme } from '@x402/avm/exact/server';

/** The real, network-calling GoPlausible facilitator client — never used directly in automated tests. */
export function buildHttpFacilitatorClient(facilitatorUrl: string): FacilitatorClient {
  return new HTTPFacilitatorClient({ url: facilitatorUrl });
}

/**
 * Builds the core x402 resource server for the active Algorand network,
 * registering the AVM `exact` payment scheme. This is transport-agnostic —
 * Fastify wiring happens separately in `install-x402-middleware.ts`.
 */
export function buildX402ResourceServer(
  facilitatorClient: FacilitatorClient,
  network: Network,
): x402ResourceServer {
  return new x402ResourceServer(facilitatorClient).register(network, new ExactAvmScheme());
}
