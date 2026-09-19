import { Controller, Get, Header, Req, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { CapabilityRegistryService } from '../capabilities/capability-registry.service.js';
import { ApiConfigService } from '../config/api-config.service.js';
import { X402ConfigService } from '../config/x402-config.service.js';
import { resolveRequestOrigin } from './request-origin.util.js';
import { buildWellKnownX402, type WellKnownX402Document } from './well-known-x402.builder.js';
import { buildAgentCard, type AgentCardDocument } from './agent-card.builder.js';
import { buildAgentManifest, type AgentManifestDocument } from './agent-manifest.builder.js';
import { buildLlmsTxt } from './llms-txt.builder.js';
import { buildAgentsMd } from './agents-md.builder.js';
import { buildRootPage } from './root-page.builder.js';

/**
 * Free, unpaid discovery/agent-file endpoints - never in the Capability
 * Registry, never protected by x402 (see `installX402Middleware`, which
 * only ever protects routes the registry lists). Excluded from both
 * versioning (`VERSION_NEUTRAL`, matching `HealthController`) and the
 * generated OpenAPI document (`@ApiExcludeController` - these describe
 * *other* discovery mechanisms, not part of Callrack's own paid API
 * surface). Every response is generated live from the Capability Registry
 * and the active x402 config - there is no second, hand-maintained copy of
 * routes/prices/descriptions.
 */
@ApiExcludeController()
@Controller({ version: VERSION_NEUTRAL })
export class DiscoveryController {
  constructor(
    private readonly registry: CapabilityRegistryService,
    private readonly x402Config: X402ConfigService,
    private readonly apiConfig: ApiConfigService,
  ) {}

  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  root(@Req() req: FastifyRequest): string {
    return buildRootPage(resolveRequestOrigin(req));
  }

  @Get('.well-known/x402')
  wellKnownX402(@Req() req: FastifyRequest): WellKnownX402Document {
    return buildWellKnownX402(this.registry.list(), this.x402Config.activeNetworkConfig, resolveRequestOrigin(req));
  }

  @Get('.well-known/agent-card.json')
  agentCard(@Req() req: FastifyRequest): AgentCardDocument {
    return buildAgentCard(this.registry.list(), resolveRequestOrigin(req), this.apiConfig.version);
  }

  @Get('.well-known/agent.json')
  agentManifest(@Req() req: FastifyRequest): AgentManifestDocument {
    return buildAgentManifest(resolveRequestOrigin(req));
  }

  @Get('llms.txt')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  llmsTxt(@Req() req: FastifyRequest): string {
    const origin = resolveRequestOrigin(req);
    return buildLlmsTxt(this.registry.list(), this.x402Config.activeNetworkConfig, origin, this.x402Config.facilitatorUrl);
  }

  @Get('agents.md')
  @Header('Content-Type', 'text/markdown; charset=utf-8')
  agentsMd(@Req() req: FastifyRequest): string {
    return buildAgentsMd(this.registry.list(), resolveRequestOrigin(req));
  }
}
