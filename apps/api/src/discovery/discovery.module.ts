import { Module } from '@nestjs/common';
import { CapabilitiesModule } from '../capabilities/capabilities.module.js';
import { DiscoveryController } from './discovery.controller.js';

@Module({
  imports: [CapabilitiesModule],
  controllers: [DiscoveryController],
})
export class DiscoveryModule {}
