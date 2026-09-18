import { Injectable, Logger } from '@nestjs/common';
import { isValidAlgorandAddress } from '@x402/avm';
import { Prisma, type Refund } from '@callrack/db';
import { DatabaseService } from '../database/database.service.js';
import { AlgorandRefundClient } from './algorand-refund-client.js';
import type {
  RefundClientView,
  RefundEligibilityExpectation,
  RefundEligibilityResult,
  TrustedPaymentInfo,
} from './refund.types.js';
import type { SupportedX402Network } from '../config/x402.schema.js';

/** After this many failed attempts, a refund stays FAILED for manual operator intervention. */
export const MAX_REFUND_ATTEMPTS = 8;
const BASE_BACKOFF_MS = 30_000;
const MAX_BACKOFF_MS = 30 * 60_000;
/** A PROCESSING/SUBMITTED row this old is treated as an interrupted (crashed) attempt, safe to reclaim. */
export const STALE_IN_FLIGHT_MS = 2 * 60_000;

/**
 * The Algorand network's own rejection when a transaction's lease collides
 * with one already confirmed for the same sender within its validity
 * window (see AlgorandRefundClient's deterministic lease). Reaching this
 * almost certainly means an EARLIER attempt for this exact refund already
 * landed on-chain — but confirming that for certain would need an indexer
 * lookup this service doesn't perform, so it's surfaced as a distinct,
 * clearly-labeled non-retryable error for manual verification rather than
 * guessed at as either a success or a plain failure.
 */
const LEASE_CONFLICT_PATTERN = /already in ledger|TransactionPool\.Remember|overlapping lease/i;

/**
 * Error messages that indicate a permanent, non-retryable problem (a bad
 * input, not a transient RPC/network hiccup) — retrying these
 * automatically would just waste attempts and Algorand fees. Matched
 * case-insensitively against the thrown error's message; deliberately
 * conservative (only well-understood Algorand/algod rejection reasons),
 * since misclassifying a transient error as permanent would silently stop
 * retrying a refund that could have succeeded.
 */
const NON_RETRYABLE_ERROR_PATTERNS: readonly RegExp[] = [
  /must optin/i,
  /asset .* missing from/i,
  /overspend/i,
  /invalid.*address/i,
  /malformed/i,
  /frozen/i,
];

export function isRetryableRefundError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return !NON_RETRYABLE_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

/** Exponential backoff, capped — used by the reconciler to decide whether a FAILED refund is eligible to retry yet. */
export function nextEligibleRetryAt(attemptCount: number, lastAttemptAt: Date): Date {
  const delay = Math.min(BASE_BACKOFF_MS * 2 ** Math.max(0, attemptCount - 1), MAX_BACKOFF_MS);
  return new Date(lastAttemptAt.getTime() + delay);
}

function usdcAssetIdFor(network: SupportedX402Network): string {
  // Mirrors @x402/avm's own USDC_MAINNET_ASA_ID / USDC_TESTNET_ASA_ID constants
  // (kept as plain literals here to avoid this hot-path service depending on
  // @x402/avm merely for two string constants already re-exported elsewhere).
  return network === 'testnet' ? '10458941' : '31566704';
}

@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly algorand: AlgorandRefundClient,
  ) {}

  /**
   * Every field here must match the SERVER's own trusted expectation before
   * a single atomic unit moves — nothing here is ever taken from a request
   * body, query string, or frontend-supplied value (see TrustedPaymentInfo's
   * own docs on where its fields actually come from).
   */
  checkEligibility(
    payment: TrustedPaymentInfo,
    expected: RefundEligibilityExpectation,
  ): RefundEligibilityResult {
    if (!payment.payer || payment.payer.trim().length === 0) {
      return { eligible: false, reason: 'No verified payer address is available for this payment.' };
    }
    if (!isValidAlgorandAddress(payment.payer)) {
      return { eligible: false, reason: `Payer "${payment.payer}" is not a structurally valid Algorand address.` };
    }
    if (payment.payer === expected.merchantAddress) {
      return { eligible: false, reason: 'Refund payer must not be the merchant account itself.' };
    }
    if (payment.network !== expected.network) {
      return {
        eligible: false,
        reason: `Settled network "${payment.network}" does not match the expected network "${expected.network}".`,
      };
    }
    if (payment.asset !== expected.assetId) {
      return {
        eligible: false,
        reason: `Settled asset "${payment.asset}" does not match the expected USDC asset "${expected.assetId}".`,
      };
    }
    if (!/^[1-9][0-9]*$/.test(payment.amount)) {
      return { eligible: false, reason: `Settled amount "${payment.amount}" is not a positive atomic-unit integer.` };
    }
    return { eligible: true };
  }

  /**
   * Atomically creates the refund record for this original payment if one
   * doesn't already exist. The database's own unique constraint on
   * `originalPaymentTransaction` is what actually guarantees "at most one
   * refund per payment" under concurrent callers (two requests racing to
   * create the same row, or a retried HTTP request landing twice) — this
   * only translates that guarantee into a friendly "return the existing row
   * instead of throwing" API.
   */
  async getOrCreate(
    payment: TrustedPaymentInfo,
    merchantAddress: string,
    requestId: string | undefined,
  ): Promise<{ refund: Refund; created: boolean }> {
    try {
      const refund = await this.database.client.refund.create({
        data: {
          requestId,
          originalPaymentTransaction: payment.originalPaymentTransaction,
          network: payment.network,
          asset: payment.asset,
          amount: payment.amount,
          payer: payment.payer ?? '',
          merchantAddress,
        },
      });
      this.logStructured('refund.created', refund, { requestId });
      return { refund, created: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.database.client.refund.findUnique({
          where: { originalPaymentTransaction: payment.originalPaymentTransaction },
        });
        if (existing) {
          return { refund: existing, created: false };
        }
      }
      throw error;
    }
  }

  /** Persists an eligibility failure as a non-retryable FAILED row, so the intent is never silently dropped. */
  async recordIneligible(
    payment: TrustedPaymentInfo,
    merchantAddress: string,
    requestId: string | undefined,
    reason: string,
  ): Promise<Refund> {
    const { refund } = await this.getOrCreate(payment, merchantAddress, requestId);
    if (refund.status !== 'FAILED' || refund.lastError !== reason) {
      return this.database.client.refund.update({
        where: { id: refund.id },
        data: { status: 'FAILED', attemptCount: MAX_REFUND_ATTEMPTS, lastError: reason },
      });
    }
    return refund;
  }

  /**
   * Compare-and-swap claim: only succeeds if the row is still in a state
   * eligible to be (re)attempted. This is the actual cross-instance lock —
   * two API replicas (or a reconciler tick racing an inline attempt) both
   * calling this for the same row will only ever have ONE `count === 1`.
   *
   * Also reclaims a PROCESSING/SUBMITTED row whose `updatedAt` is older than
   * `STALE_IN_FLIGHT_MS` — almost certainly a process that crashed
   * mid-attempt, never a still-in-progress one (a single attempt normally
   * resolves in a few seconds). Re-attempting is always safe: the
   * deterministic on-chain lease (see AlgorandRefundClient) guarantees a
   * transaction that already landed can never be confirmed twice, even if
   * this reclaim races a first attempt that's actually still finishing.
   */
  private async claim(refundId: string): Promise<Refund | undefined> {
    const staleCutoff = new Date(Date.now() - STALE_IN_FLIGHT_MS);
    const result = await this.database.client.refund.updateMany({
      where: {
        id: refundId,
        OR: [
          { status: { in: ['PENDING', 'FAILED'] } },
          { status: { in: ['PROCESSING', 'SUBMITTED'] }, updatedAt: { lte: staleCutoff } },
        ],
      },
      data: { status: 'PROCESSING', attemptCount: { increment: 1 }, lastError: null },
    });
    if (result.count !== 1) {
      return undefined;
    }
    return this.database.client.refund.findUniqueOrThrow({ where: { id: refundId } });
  }

  /**
   * Attempts to actually submit (or resubmit) the on-chain refund for one
   * row. Safe to call concurrently for the same row (see `claim`) and safe
   * to call again after a crash (see the deterministic on-chain lease in
   * AlgorandRefundClient, and the DB status transition to SUBMITTED before
   * confirmation is awaited).
   */
  async attemptProcessing(refundId: string, network: SupportedX402Network, mnemonic: string): Promise<Refund> {
    const claimed = await this.claim(refundId);
    if (!claimed) {
      return this.database.client.refund.findUniqueOrThrow({ where: { id: refundId } });
    }
    this.logStructured('refund.processing', claimed, {});

    const submitting = await this.database.client.refund.update({
      where: { id: claimed.id },
      data: { status: 'SUBMITTED' },
    });
    this.logStructured('refund.submitted', submitting, {});

    try {
      const result = await this.algorand.sendRefund({
        network,
        mnemonic,
        assetId: claimed.asset,
        atomicAmount: claimed.amount,
        receiver: claimed.payer,
        note: `Callrack refund for payment ${claimed.originalPaymentTransaction}`,
        originalPaymentTransaction: claimed.originalPaymentTransaction,
      });

      const confirmed = await this.database.client.refund.update({
        where: { id: claimed.id },
        data: { status: 'CONFIRMED', refundTransaction: result.transactionId, confirmedAt: new Date() },
      });
      this.logStructured('refund.confirmed', confirmed, {});
      return confirmed;
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : String(error);
      const message = LEASE_CONFLICT_PATTERN.test(rawMessage)
        ? 'A prior attempt for this refund may have already reached Algorand (lease conflict). ' +
          `Needs manual verification before retrying. Original error: ${rawMessage}`
        : rawMessage;
      const failed = await this.database.client.refund.update({
        where: { id: claimed.id },
        data: {
          status: 'FAILED',
          lastError: message,
          // A lease conflict is deliberately pinned at the retry ceiling —
          // this codebase has no indexer lookup to confirm whether the
          // earlier attempt actually landed, so auto-retrying blindly risks
          // colliding again forever; it needs a human to check Algorand
          // directly before this is touched again.
          ...(LEASE_CONFLICT_PATTERN.test(rawMessage) ? { attemptCount: MAX_REFUND_ATTEMPTS } : {}),
        },
      });
      this.logStructured('refund.failed', failed, { error: message });
      return failed;
    }
  }

  toClientView(refund: Refund): RefundClientView {
    return refund.status === 'CONFIRMED' && refund.refundTransaction
      ? { status: 'refunded', refundTransaction: refund.refundTransaction }
      : { status: 'refund_pending' };
  }

  isEligibleForRetry(refund: Refund): boolean {
    if (refund.status !== 'FAILED') return false;
    if (refund.attemptCount >= MAX_REFUND_ATTEMPTS) return false;
    return new Date() >= nextEligibleRetryAt(refund.attemptCount, refund.updatedAt);
  }

  private logStructured(event: string, refund: Refund, extra: Record<string, unknown>): void {
    this.logger.log(
      JSON.stringify({
        event,
        refundId: refund.id,
        requestId: refund.requestId,
        originalPaymentTransaction: refund.originalPaymentTransaction,
        refundTransaction: refund.refundTransaction ?? undefined,
        network: refund.network,
        amount: refund.amount,
        payer: refund.payer,
        ...extra,
      }),
    );
  }
}

export { usdcAssetIdFor };
