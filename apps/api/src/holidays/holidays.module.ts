import { Module } from '@nestjs/common';
import { ProvidersModule } from '../providers/providers.module.js';
import { HolidaysController } from './holidays.controller.js';
import { HolidaysService } from './holidays.service.js';

@Module({
  imports: [ProvidersModule],
  controllers: [HolidaysController],
  providers: [HolidaysService],
})
export class HolidaysModule {}
