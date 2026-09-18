import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AlgorandClient } from '@algorandfoundation/algokit-utils';
import type { SupportedX402Network } from '../config/x402.schema.js';

/**
 * Algorand's `lease` field rejects any other transaction from the same
 * sender carrying the same lease within the first one's validity window
 * (see https://dev.algorand.co/concepts/transactions/leases). Deriving it
 * deterministically from the original payment's settlement transaction id
 * means a crash-and-retry that accidentally re-submits a refund for the
 * SAME original payment can only ever get one of the two confirmed
 * on-chain — the network itself enforces "at most one refund transaction
 * per original payment", as a second, independent layer under the
 * database-level uniqueness constraint (see RefundService).
 */
function leaseForOriginalPayment(originalPaymentTransaction: string): Uint8Array {
  return new Uint8Array(createHash('sha256').update(originalPaymentTransaction).digest());
}

export interface SendRefundInput {
  readonly network: SupportedX402Network;
  readonly mnemonic: string;
  readonly assetId: string;
  /** Atomic (base-unit) USDC amount, as a decimal string — converted to bigint here, never floating point. */
  readonly atomicAmount: string;
  readonly receiver: string;
  readonly note: string;
  /** The original settlement's transaction id — used to derive a deterministic on-chain lease. */
  readonly originalPaymentTransaction: string;
}

export interface SendRefundResult {
  readonly transactionId: string;
  readonly confirmedRound?: number;
}

/**
 * The only place this codebase actually constructs and broadcasts an
 * Algorand transaction server-side. Uses `@algorandfoundation/algokit-utils`
 * — already a transitive dependency of `@x402/avm`, so this introduces no
 * second blockchain stack — with its network-default public AlgoNode
 * endpoints (`AlgorandClient.testNet()` / `.mainNet()`), matching how the
 * rest of this codebase never hand-rolls Algorand network config.
 *
 * `algorand.send.assetTransfer` waits for confirmation itself (default up
 * to 5 rounds, ~15s) before resolving, so a resolved promise here always
 * means the refund is actually confirmed on-chain — never merely broadcast.
 */
@Injectable()
export class AlgorandRefundClient {
  async sendRefund(input: SendRefundInput): Promise<SendRefundResult> {
    const algorand =
      input.network === 'testnet' ? AlgorandClient.testNet() : AlgorandClient.mainNet();
    const refundAccount = algorand.account.fromMnemonic(input.mnemonic);

    const result = await algorand.send.assetTransfer({
      sender: refundAccount.addr,
      assetId: BigInt(input.assetId),
      amount: BigInt(input.atomicAmount),
      receiver: input.receiver,
      note: input.note,
      lease: leaseForOriginalPayment(input.originalPaymentTransaction),
    });

    const transactionId = result.txIds[0];
    if (!transactionId) {
      throw new Error('Algorand refund transfer resolved without a transaction id.');
    }

    return {
      transactionId,
      confirmedRound: result.confirmation?.confirmedRound !== undefined
        ? Number(result.confirmation.confirmedRound)
        : undefined,
    };
  }
}
