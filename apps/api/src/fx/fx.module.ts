import { Module } from '@nestjs/common';
import { ProvidersModule } from '../providers/providers.module.js';
import { FxController } from './fx.controller.js';
import { FxService } from './fx.service.js';

@Module({
  imports: [ProvidersModule],
  controllers: [FxController],
  providers: [FxService],
})
export class FxModule {}
