import { Injectable, type OnModuleInit } from '@nestjs/common';
import { PricingConfigService } from '../config/pricing-config.service.js';
import { ProviderRegistry } from '../providers/provider-registry.service.js';
import { CAPABILITY_METADATA } from './capability-definitions.js';
import { indexCapabilities, resolveCapabilityDefinition, validateCapabilityDefinitions } from './capability-registry.util.js';
import type { CapabilityDefinition } from './capability.types.js';

/**
 * The application-level source of truth for what Callrack capabilities
 * exist, where they live, what they cost, and what serves them. This is
 * metadata only — it never executes a capability request, and existing
 * capability services do not need to consult it to keep working (see
 * `capabilities.module.ts`). Phase 7 (x402) resolves payment requirements
 * from this registry instead of re-deriving capability metadata itself.
 */
@Injectable()
export class CapabilityRegistryService implements OnModuleInit {
  private readonly definitions: CapabilityDefinition[];
  private readonly byId: ReadonlyMap<string, CapabilityDefinition>;
  private readonly byRoute: ReadonlyMap<string, CapabilityDefinition>;

  constructor(
    private readonly pricing: PricingConfigService,
    private readonly providers: ProviderRegistry,
  ) {
    this.definitions = CAPABILITY_METADATA.map((metadata) =>
      resolveCapabilityDefinition(metadata, (key) => this.pricing.getAmount(key)),
    );
    const index = indexCapabilities(this.definitions);
    this.byId = index.byId;
    this.byRoute = index.byRoute;
  }

  /** Runs after `ProvidersModule` has registered every provider adapter — see module import order. */
  onModuleInit(): void {
    validateCapabilityDefinitions(this.definitions, (slug) => this.providers.has(slug));
  }

  getById(id: string): CapabilityDefinition | undefined {
    return this.byId.get(id);
  }

  getByPath(method: string, path: string): CapabilityDefinition | undefined {
    return this.byRoute.get(`${method.toUpperCase()} ${path}`);
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  list(): CapabilityDefinition[] {
    return [...this.definitions];
  }

  getByProvider(slug: string): CapabilityDefinition[] {
    return this.definitions.filter((d) => d.provider.kind === 'provider' && d.provider.slugs.includes(slug));
  }
}
