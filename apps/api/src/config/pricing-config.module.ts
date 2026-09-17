import { Global, Module } from '@nestjs/common';
import { PricingConfigService } from './pricing-config.service.js';

@Global()
@Module({
  providers: [PricingConfigService],
  exports: [PricingConfigService],
})
export class PricingConfigModule {}
