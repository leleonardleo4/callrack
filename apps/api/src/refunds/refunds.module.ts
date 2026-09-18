import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { RefundConfigModule } from '../config/refund-config.module.js';
import { X402ConfigModule } from '../config/x402-config.module.js';
import { AlgorandRefundClient } from './algorand-refund-client.js';
import { RefundService } from './refund.service.js';
import { RefundOrchestrationService } from './refund-orchestration.service.js';
import { RefundReconcilerService } from './refund-reconciler.service.js';

@Module({
  imports: [DatabaseModule, RefundConfigModule, X402ConfigModule],
  providers: [AlgorandRefundClient, RefundService, RefundOrchestrationService, RefundReconcilerService],
  exports: [RefundOrchestrationService],
})
export class RefundsModule {}
