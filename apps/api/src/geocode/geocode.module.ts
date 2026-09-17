import { Module } from '@nestjs/common';
import { ProvidersModule } from '../providers/providers.module.js';
import { GeocodeController } from './geocode.controller.js';
import { GeocodeService } from './geocode.service.js';

@Module({
  imports: [ProvidersModule],
  controllers: [GeocodeController],
  providers: [GeocodeService],
})
export class GeocodeModule {}
