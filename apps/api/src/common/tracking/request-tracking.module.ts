import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { RequestTrackingService } from './request-tracking.service.js';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [RequestTrackingService],
  exports: [RequestTrackingService],
})
export class RequestTrackingModule {}
