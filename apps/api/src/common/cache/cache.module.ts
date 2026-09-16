import { Global, Module } from '@nestjs/common';
import { CapabilityCacheService } from './capability-cache.service.js';

@Global()
@Module({
  providers: [CapabilityCacheService],
  exports: [CapabilityCacheService],
})
export class CacheModule {}
