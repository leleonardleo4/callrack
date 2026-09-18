/**
 * Everything the refund system needs about an original payment, sourced
 * ONLY from the trusted x402 settlement (`SettleResponse`, decoded from the
 * `PAYMENT-RESPONSE` header) and the server's own resolved payment
 * requirements — NEVER from request-body/query/frontend-supplied values.
 * See RefundService.checkEligibility for how every field here is validated
 * before a single atomic unit ever moves.
 */
export interface TrustedPaymentInfo {
  readonly originalPaymentTransaction: string;
  readonly network: string;
  readonly asset: string;
  /** Atomic (base-unit) amount as a decimal string. */
  readonly amount: string;
  readonly payer: string | undefined;
}

export interface RefundEligibilityExpectation {
  readonly network: string;
  readonly assetId: string;
  readonly merchantAddress: string;
}

export interface RefundEligibilityResult {
  readonly eligible: boolean;
  readonly reason?: string;
}

/** What a failed paid response's `payment` field reports to the client — never more than this. */
export type RefundClientStatus = 'refunded' | 'refund_pending';

export interface RefundClientView {
  readonly status: RefundClientStatus;
  readonly refundTransaction?: string;
}
