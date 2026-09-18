import { Global, Module } from '@nestjs/common';
import { X402ConfigModule } from './x402-config.module.js';
import { RefundConfigService } from './refund-config.service.js';

@Global()
@Module({
  imports: [X402ConfigModule],
  providers: [RefundConfigService],
  exports: [RefundConfigService],
})
export class RefundConfigModule {}
