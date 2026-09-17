import type { RouteConfig, RoutesConfig } from '@x402/core/server';
import type { CapabilityDefinition } from '../capabilities/capability.types.js';
import type { ActiveX402NetworkConfig } from '../config/x402-config.service.js';

const X402_SCHEME = 'exact';

/**
 * Transforms the capability registry into x402's route configuration —
 * the ONLY place capability metadata becomes x402 metadata. Every field here
 * is read from the registry or the active network config; nothing is
 * hardcoded, so registry/config changes can never drift out of sync with
 * what x402 actually protects.
 *
 * Every paid capability shares the same `payTo` and network — the registry
 * itself never carries per-capability payment addresses (Composite challenge
 * requirement: one payTo across all Callrack endpoints).
 *
 * Every field consumed here (price, method, path, description) was already
 * validated by `CapabilityRegistryService.onModuleInit()`, and `payTo` /
 * network were already validated by `X402ConfigService` — this function
 * performs no redundant validation of its own.
 */
export function buildX402RoutesConfig(
  capabilities: readonly CapabilityDefinition[],
  active: ActiveX402NetworkConfig,
): RoutesConfig {
  const routes: Record<string, RouteConfig> = {};

  for (const capability of capabilities) {
    const routeKey = `${capability.method} ${capability.path}`;
    routes[routeKey] = {
      description: capability.description,
      accepts: {
        scheme: X402_SCHEME,
        payTo: active.payTo,
        // The exact decimal string from the registry, passed straight
        // through — @x402/avm's ExactAvmScheme converts it to USDC atomic
        // units via pure string arithmetic (see convertToTokenAmount), never
        // floating point.
        price: capability.price.amount,
        network: active.caip2Network,
      },
    };
  }

  return routes;
}
