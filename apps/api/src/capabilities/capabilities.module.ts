import { Module } from '@nestjs/common';
import { ProvidersModule } from '../providers/providers.module.js';
import { PricingConfigModule } from '../config/pricing-config.module.js';
import { X402ConfigModule } from '../config/x402-config.module.js';
import { CapabilityRegistryService } from './capability-registry.service.js';
import { CapabilityRequestSchemaService } from './capability-request-schema.service.js';
import { CapabilitiesController } from './capabilities.controller.js';

/**
 * Wires the capability registry: metadata + pricing, plus the read-only
 * public `GET /v1/capabilities` endpoint. The registry itself is not
 * consulted by existing capability services on the request path — x402
 * middleware and `CapabilitiesController` both read from it at the API
 * boundary instead.
 */
@Module({
  imports: [ProvidersModule, PricingConfigModule, X402ConfigModule],
  controllers: [CapabilitiesController],
  providers: [CapabilityRegistryService, CapabilityRequestSchemaService],
  exports: [CapabilityRegistryService, CapabilityRequestSchemaService],
})
export class CapabilitiesModule {}
