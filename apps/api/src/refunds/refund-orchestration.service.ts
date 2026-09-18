import { Injectable, Logger } from '@nestjs/common';
import type { PaymentRequirements, SettleResponse } from '@x402/core/types';
import { RefundConfigService } from '../config/refund-config.service.js';
import { RefundService, usdcAssetIdFor } from './refund.service.js';
import type { RefundClientView, TrustedPaymentInfo } from './refund.types.js';
import type { SupportedX402Network } from '../config/x402.schema.js';

/** How long the inline (same-response) refund attempt is allowed to run before falling back to `refund_pending`. */
const INLINE_ATTEMPT_TIMEOUT_MS = 6_000;

export interface FailedPaidCapabilityInput {
  readonly requestId: string | undefined;
  readonly capabilitySlug: string | undefined;
  readonly network: SupportedX402Network;
  readonly settlement: SettleResponse;
  readonly paymentRequirements: Pick<PaymentRequirements, 'asset' | 'amount' | 'network' | 'payTo'>;
  /** Best-effort payer decoded directly from the signed payment transaction — used only if the settlement itself omits `payer`. */
  readonly fallbackPayer: string | undefined;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(undefined);
      },
    );
  });
}

/**
 * The single centralized entry point for "a paid capability failed after
 * settlement succeeded" — called only from the Fastify boundary in
 * `install-x402-middleware.ts`, never from a capability controller/service
 * directly (see that file's own docs for why it's the right place to
 * observe both outcomes).
 */
@Injectable()
export class RefundOrchestrationService {
  private readonly logger = new Logger(RefundOrchestrationService.name);

  constructor(
    private readonly refundConfig: RefundConfigService,
    private readonly refunds: RefundService,
  ) {}

  async handleFailedPaidCapability(input: FailedPaidCapabilityInput): Promise<RefundClientView> {
    const merchantAddress = input.paymentRequirements.payTo;
    const expected = {
      network: input.paymentRequirements.network,
      assetId: usdcAssetIdFor(input.network),
      merchantAddress,
    };

    const payment: TrustedPaymentInfo = {
      originalPaymentTransaction: input.settlement.transaction,
      network: input.settlement.network,
      asset: input.paymentRequirements.asset,
      amount: input.settlement.amount ?? input.paymentRequirements.amount,
      payer: input.settlement.payer ?? input.fallbackPayer,
    };

    const eligibility = this.refunds.checkEligibility(payment, expected);
    if (!eligibility.eligible) {
      this.logger.warn(
        JSON.stringify({
          event: 'refund.eligibility_check_failed',
          requestId: input.requestId,
          capabilitySlug: input.capabilitySlug,
          originalPaymentTransaction: payment.originalPaymentTransaction,
          reason: eligibility.reason,
        }),
      );
      const refund = await this.refunds.recordIneligible(
        payment,
        merchantAddress,
        input.requestId,
        eligibility.reason ?? 'Refund ineligible for an unspecified reason.',
      );
      return this.refunds.toClientView(refund);
    }

    const { refund } = await this.refunds.getOrCreate(payment, merchantAddress, input.requestId);
    if (refund.status === 'CONFIRMED') {
      return this.refunds.toClientView(refund);
    }

    if (!this.refundConfig.isEnabled) {
      this.logger.warn(
        JSON.stringify({
          event: 'refund.signer_not_configured',
          requestId: input.requestId,
          refundId: refund.id,
          network: input.network,
        }),
      );
      return this.refunds.toClientView(refund);
    }

    const mnemonic = this.refundConfig.getSignerMnemonicOrThrow();
    // Best-effort: try to finish within the same response so the buyer can
    // see "refunded" immediately when Algorand confirms quickly. If it
    // doesn't finish in time, the attempt keeps running in the background
    // (never aborted) and the reconciler will pick up/verify the outcome on
    // its own next tick regardless — this is a UX nicety, not the
    // durability mechanism.
    const settled = await withTimeout(
      this.refunds.attemptProcessing(refund.id, input.network, mnemonic),
      INLINE_ATTEMPT_TIMEOUT_MS,
    );
    return this.refunds.toClientView(settled ?? refund);
  }
}
