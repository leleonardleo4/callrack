import { Module } from '@nestjs/common';
import { ProvidersModule } from '../providers/providers.module.js';
import { CryptoController } from './crypto.controller.js';
import { CryptoService } from './crypto.service.js';

@Module({
  imports: [ProvidersModule],
  controllers: [CryptoController],
  providers: [CryptoService],
})
export class CryptoModule {}
