import type { RouteConfig, RoutesConfig } from '@x402/core/server';
import type { CapabilityDefinition } from '../capabilities/capability.types.js';
import type { ActiveX402NetworkConfig } from '../config/x402-config.service.js';

const X402_SCHEME = 'exact';

/**
 * Required by the 2026 Algorand Global x402 Challenge: every paid route's
 * payment option must carry this tag in its `extra` field so challenge
 * infrastructure can attribute usage to this entry.
 */
export const X402_GLOBAL_CHALLENGE_TAG = 'x402-global-challenge';

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
 *
 * `discoveryExtensions` is optional so pure payment-only route config can
 * still be built without a live Nest app (e.g. in unit tests) — see
 * `discovery-metadata.builder.ts` for how the Bazaar extension itself is
 * produced from a capability plus its live request JSON Schema.
 */
export function buildX402RoutesConfig(
  capabilities: readonly CapabilityDefinition[],
  active: ActiveX402NetworkConfig,
  discoveryExtensions?: ReadonlyMap<string, Record<string, unknown>>,
): RoutesConfig {
  const routes: Record<string, RouteConfig> = {};

  for (const capability of capabilities) {
    const routeKey = `${capability.method} ${capability.path}`;
    const bazaarExtension = discoveryExtensions?.get(capability.id);

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
        // Merged with (never overwriting) whatever the AVM scheme itself
        // later adds to `extra` (e.g. `feePayer`) — ExactAvmScheme.
        // enhancePaymentRequirements spreads the existing `extra` first.
        extra: { tag: X402_GLOBAL_CHALLENGE_TAG },
      },
      ...(bazaarExtension ? { extensions: bazaarExtension } : {}),
    };
  }

  return routes;
}
