import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { RefundConfigService } from '../config/refund-config.service.js';
import { X402ConfigService } from '../config/x402-config.service.js';
import { MAX_REFUND_ATTEMPTS, RefundService, STALE_IN_FLIGHT_MS, nextEligibleRetryAt } from './refund.service.js';

const RECONCILE_INTERVAL_MS = 15_000;

/**
 * Durable retry, not a `setTimeout`-is-the-database substitute: everything
 * this needs to know — which refunds are pending, how many times each has
 * been attempted, and when it's next eligible to retry — lives in the
 * `Refund` table, not in process memory. A restart loses nothing; the next
 * boot's `reconcileOnce()` tick rediscovers every PENDING/eligible-FAILED/
 * stuck-in-flight row from the database and carries on. `setInterval` here
 * is only the cadence trigger, never the source of truth.
 *
 * Safe across multiple simultaneously-running API instances: every actual
 * attempt still goes through `RefundService.attemptProcessing`, whose
 * `updateMany({ where: { status: {in:['PENDING','FAILED']} } })` claim is an
 * atomic compare-and-swap at the database level — a second instance's
 * concurrent tick on the same row simply claims 0 rows and moves on.
 */
@Injectable()
export class RefundReconcilerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RefundReconcilerService.name);
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly database: DatabaseService,
    private readonly refunds: RefundService,
    private readonly refundConfig: RefundConfigService,
    private readonly x402Config: X402ConfigService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.reconcileOnce().catch((error: unknown) => {
        this.logger.error(`Refund reconciliation tick failed: ${(error as Error).message}`);
      });
    }, RECONCILE_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async reconcileOnce(): Promise<void> {
    if (!this.refundConfig.isEnabled) {
      // No signer configured for this network yet — rows stay PENDING/FAILED
      // untouched (never lost) until an operator configures one and restarts.
      return;
    }
    const mnemonic = this.refundConfig.getSignerMnemonicOrThrow();
    const network = this.x402Config.network;

    const staleCutoff = new Date(Date.now() - STALE_IN_FLIGHT_MS);
    const candidates = await this.database.client.refund.findMany({
      where: {
        OR: [
          { status: 'PENDING' },
          { status: 'FAILED', attemptCount: { lt: MAX_REFUND_ATTEMPTS } },
          { status: { in: ['PROCESSING', 'SUBMITTED'] }, updatedAt: { lte: staleCutoff } },
        ],
      },
      take: 25,
      orderBy: { updatedAt: 'asc' },
    });

    for (const refund of candidates) {
      if (refund.status === 'FAILED' && new Date() < nextEligibleRetryAt(refund.attemptCount, refund.updatedAt)) {
        continue; // not yet eligible under exponential backoff
      }
      await this.refunds.attemptProcessing(refund.id, network, mnemonic);
    }
  }
}
