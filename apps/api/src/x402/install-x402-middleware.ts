import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FacilitatorClient } from '@x402/core/server';
import { x402HTTPResourceServer } from '@x402/core/server';
import { paymentMiddlewareFromHTTPServer } from '@x402/fastify';
import type { FastifyRequest } from 'fastify';
import type { CapabilityRegistryService } from '../capabilities/capability-registry.service.js';
import type { X402ConfigService } from '../config/x402-config.service.js';
import { buildX402ResourceServer } from './x402-resource-server.factory.js';
import { buildX402RoutesConfig } from './x402-route-config.builder.js';
import { extractPaymentContext, setCurrentPaymentContext } from './payment-context.js';

/**
 * Installs x402 payment protection on the Fastify instance underlying this
 * Nest app: builds route configuration from the capability registry, wires
 * the Algorand `exact` scheme + facilitator, and registers the payment
 * middleware. Only routes present in the registry are protected — health,
 * readiness, and docs stay free simply because they're never in the registry.
 *
 * Awaits `httpServer.initialize()` itself (rather than relying on the SDK's
 * own fire-and-forget background init) so a broken facilitator or an invalid
 * route/scheme combination fails application *startup*, never a customer's
 * first request.
 */
export async function installX402Middleware(
  app: NestFastifyApplication,
  capabilityRegistry: CapabilityRegistryService,
  x402Config: X402ConfigService,
  facilitatorClient: FacilitatorClient,
): Promise<void> {
  const routes = buildX402RoutesConfig(capabilityRegistry.list(), x402Config.activeNetworkConfig);
  const resourceServer = buildX402ResourceServer(facilitatorClient, x402Config.caip2Network);
  const httpServer = new x402HTTPResourceServer(resourceServer, routes);

  const fastifyInstance = app.getHttpAdapter().getInstance();

  // syncFacilitatorOnStart=false: we call httpServer.initialize() ourselves,
  // once, below, and await it — the SDK's own background-init path would
  // otherwise race a lazily-awaited copy on the first protected request.
  paymentMiddlewareFromHTTPServer(fastifyInstance, httpServer, undefined, undefined, false);

  await httpServer.initialize();

  // Registered after the x402 hook above, so `request.x402Context` is
  // already populated (or absent, for unpaid/free requests) by the time this
  // runs — Fastify's onRequest hooks execute in registration order.
  fastifyInstance.addHook('onRequest', async (request: FastifyRequest) => {
    const paymentContext = extractPaymentContext(request.x402Context);
    if (paymentContext) {
      setCurrentPaymentContext(paymentContext);
    }
  });
}
