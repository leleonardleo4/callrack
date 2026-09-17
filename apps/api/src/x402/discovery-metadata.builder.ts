import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { declareDiscoveryExtension } from '@x402/extensions/bazaar';
import type { CapabilityDefinition } from '../capabilities/capability.types.js';
import { buildRequestSchemaMap, getRequestSchemaFor, type RequestJsonSchema } from './discovery-schema.util.js';
import { buildX402MerchantExtension } from './merchant-extension.builder.js';

/**
 * Transforms one capability's registry metadata into an x402 Bazaar
 * discovery extension — the ONLY place capability metadata becomes Bazaar
 * metadata. `method` is intentionally omitted from the config: the Bazaar
 * server extension (`bazaarResourceServerExtension`) fills it in per-request
 * from the actual route, so it can never drift from the real HTTP method.
 *
 * Keeps the dependency direction clean: this file is the only one in
 * `capabilities/` or `x402/` that imports `@x402/extensions` for discovery —
 * the registry itself (capabilities/) has never heard of Bazaar.
 */
export function buildBazaarDiscoveryExtension(
  capability: CapabilityDefinition,
  requestSchema: RequestJsonSchema | undefined,
): Record<string, unknown> {
  return declareDiscoveryExtension({
    bodyType: 'json',
    input: capability.discovery.inputExample,
    inputSchema: { ...(requestSchema ?? { type: 'object', properties: {} }) },
    output: {
      example: capability.discovery.outputExample,
      schema: { ...capability.discovery.outputSchema },
    },
  });
}

/**
 * Builds every capability's full extensions set (Bazaar discovery +
 * x402-merchant) in one pass, keyed by capability id — ready to hand to
 * `buildX402RoutesConfig`. Reflects the live Nest app's request DTOs exactly
 * once (see `buildRequestSchemaMap`), not once per capability. The
 * x402-merchant identity is the same for every route, so it's built once
 * and merged in, not recomputed per capability.
 */
export function buildDiscoveryExtensionsMap(
  app: NestFastifyApplication,
  capabilities: readonly CapabilityDefinition[],
): ReadonlyMap<string, Record<string, unknown>> {
  const requestSchemas = buildRequestSchemaMap(app);
  const merchantExtension = buildX402MerchantExtension();
  const extensions = new Map<string, Record<string, unknown>>();

  for (const capability of capabilities) {
    const requestSchema = getRequestSchemaFor(requestSchemas, capability.requestSchema);
    extensions.set(capability.id, {
      ...buildBazaarDiscoveryExtension(capability, requestSchema),
      ...merchantExtension,
    });
  }

  return extensions;
}
