import { Global, Module } from '@nestjs/common';
import { X402ConfigService } from './x402-config.service.js';

@Global()
@Module({
  providers: [X402ConfigService],
  exports: [X402ConfigService],
})
export class X402ConfigModule {}
