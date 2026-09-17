import { Module } from '@nestjs/common';
import { ProvidersModule } from '../providers/providers.module.js';
import { GovernmentController } from './government.controller.js';
import { CensusService } from './census.service.js';

@Module({
  imports: [ProvidersModule],
  controllers: [GovernmentController],
  providers: [CensusService],
  exports: [CensusService],
})
export class GovernmentModule {}
