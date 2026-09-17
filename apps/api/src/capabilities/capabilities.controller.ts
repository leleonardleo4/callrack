import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { ApiSuccessResponse } from '../common/http/api-response.interface.js';
import { RequestContext } from '../common/request-context/request-context.js';
import { X402ConfigService } from '../config/x402-config.service.js';
import { CapabilityRegistryService } from './capability-registry.service.js';
import { CapabilityRequestSchemaService } from './capability-request-schema.service.js';
import type { PublicCapabilitiesData } from './public-capability.types.js';

/**
 * The one machine-readable source the Callrack web app (and any other
 * client) uses to render capability lists, prices, and request schemas —
 * never a hand-copied duplicate of the Capability Registry. Read-only,
 * unauthenticated, and free (never in x402's route config, so payment
 * middleware never touches it — see `install-x402-middleware.ts`).
 *
 * Returns only public-safe fields (see `PublicCapability`): no provider
 * credentials, no internal pricing-config keys, no facilitator secrets.
 * `payTo` is intentionally included in `network` — it's already public on
 * every 402 response and in `.well-known/x402`, so restating it here isn't a
 * new exposure, but it's omitted here anyway since nothing on this page
 * needs it; a client that needs `payTo` reads it from the live 402 response,
 * which is authoritative.
 */
@ApiTags('Capabilities')
@Controller('capabilities')
export class CapabilitiesController {
  constructor(
    private readonly registry: CapabilityRegistryService,
    private readonly schemas: CapabilityRequestSchemaService,
    private readonly x402Config: X402ConfigService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List every public Callrack capability',
    description:
      'Returns the same capability metadata (name, description, category, price, request/response schema) ' +
      'that powers x402 Bazaar discovery — the canonical, always-current source for the Callrack web app and ' +
      'any other client. Never requires payment.',
  })
  @ApiResponse({ status: 200, description: 'The current capability list and active network.' })
  list(): ApiSuccessResponse<PublicCapabilitiesData> {
    const requestId = RequestContext.requestId ?? 'unknown';
    const capabilities = this.registry.list().map((capability) => ({
      id: capability.id,
      name: capability.name,
      description: capability.description,
      category: capability.category,
      method: capability.method,
      path: capability.path,
      provider: capability.provider,
      price: capability.price,
      status: capability.status,
      requestSchema: this.schemas.getFor(capability.requestSchema) ?? { type: 'object' as const, properties: {} },
      example: {
        request: capability.discovery.inputExample,
        response: capability.discovery.outputExample,
      },
      responseSchema: capability.discovery.outputSchema,
    }));

    return {
      data: {
        capabilities,
        network: {
          name: this.x402Config.network,
          caip2: this.x402Config.caip2Network,
          facilitatorUrl: this.x402Config.facilitatorUrl,
        },
      },
      meta: { requestId },
    };
  }
}
