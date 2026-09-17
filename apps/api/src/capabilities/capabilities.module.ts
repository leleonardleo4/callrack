import { Module } from '@nestjs/common';
import { ProvidersModule } from '../providers/providers.module.js';
import { PricingConfigModule } from '../config/pricing-config.module.js';
import { CapabilityRegistryService } from './capability-registry.service.js';

/**
 * Wires the capability registry: metadata + pricing only. It deliberately
 * declares no controllers and is not consulted by existing capability
 * services on the request path — a future x402 middleware is expected to
 * read from it at the API boundary instead.
 */
@Module({
  imports: [ProvidersModule, PricingConfigModule],
  providers: [CapabilityRegistryService],
  exports: [CapabilityRegistryService],
})
export class CapabilitiesModule {}
