import { Module } from '@nestjs/common';
import { ProvidersModule } from '../providers/providers.module.js';
import { AcademicController } from './academic.controller.js';
import { AcademicService } from './academic.service.js';

@Module({
  imports: [ProvidersModule],
  controllers: [AcademicController],
  providers: [AcademicService],
})
export class AcademicModule {}
