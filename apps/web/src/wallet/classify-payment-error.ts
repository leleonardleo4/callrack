import {
  CallrackNetworkError,
  CallrackPaymentError,
  CallrackPaymentPolicyError,
  CallrackTimeoutError,
} from '@callrack/sdk';

export type PaymentFlowFailureReason =
  | 'cancelled'
  | 'wallet-unavailable'
  | 'wrong-network'
  | 'insufficient-balance'
  | 'payment-rejected'
  | 'policy'
  | 'network'
  | 'unknown';

export interface PaymentFlowFailure {
  readonly reason: PaymentFlowFailureReason;
  /** Always a real message — the server's or wallet's own, never fabricated. */
  readonly message: string;
}

// A real wallet rejection surfaces from @x402/avm's ExactAvmScheme as a
// generic thrown Error whose message is whatever the wallet SDK produced
// (Pera/Defly/Lute/WalletConnect all describe a decline in terms of the
// *user*, e.g. "...rejected by the user"). Deliberately narrower than a bare
// /reject/i or /cancel/i: the server's own rejection message (surfaced via
// CallrackPaymentError, e.g. "Payment for ... was rejected by the server:
// ...") also contains the word "rejected" — matching on that alone would
// misclassify a real server/facilitator rejection as a user cancellation.
const CANCEL_PATTERNS: readonly RegExp[] = [
  /\buser\b.{0,20}\b(reject|cancel|declin|den(y|ied))/i,
  /\b(reject|cancel|declin|den(y|ied))\w*\b.{0,20}\buser\b/i,
  /closed by user/i,
  /user closed/i,
];
const WALLET_UNAVAILABLE_PATTERNS: readonly RegExp[] = [/not available/i, /not installed/i, /no wallet/i, /disconnected/i];
const BALANCE_PATTERNS: readonly RegExp[] = [/insufficient/i, /underflow/i, /overspend/i, /\bbalance\b/i];

/**
 * Classifies whatever the wallet-backed payment attempt threw into the
 * Playground's own small, user-facing vocabulary. Never invents a cause the
 * error doesn't support — an unmatched `CallrackPaymentError` still shows
 * its own real message (see requirement: "surface the existing
 * CallrackPaymentError details instead of replacing them with a generic
 * wallet error"), and this function performs no retry, no parallel
 * transaction-expiry tracking, and no re-classification of an error that
 * isn't actually a payment failure.
 */
export function classifyPaymentFlowError(error: unknown, requiredNetworkLabel?: string): PaymentFlowFailure {
  const message = error instanceof Error ? error.message : String(error);

  if (CANCEL_PATTERNS.some((pattern) => pattern.test(message))) {
    return { reason: 'cancelled', message: 'Transaction cancelled.' };
  }

  if (WALLET_UNAVAILABLE_PATTERNS.some((pattern) => pattern.test(message))) {
    return { reason: 'wallet-unavailable', message };
  }

  if (error instanceof CallrackPaymentPolicyError) {
    if (error.reason === 'NO_ACCEPTABLE_PAYMENT_REQUIREMENT') {
      const networkNote = requiredNetworkLabel ? ` Callrack currently requires ${requiredNetworkLabel}.` : '';
      return {
        reason: 'wrong-network',
        message: `This request's payment requirements don't match what this wallet is configured to pay (network, asset, or amount).${networkNote}`,
      };
    }
    return { reason: 'policy', message: error.message };
  }

  if (error instanceof CallrackPaymentError) {
    if (BALANCE_PATTERNS.some((pattern) => pattern.test(message))) {
      return { reason: 'insufficient-balance', message: error.message };
    }
    return { reason: 'payment-rejected', message: error.message };
  }

  if (error instanceof CallrackTimeoutError || error instanceof CallrackNetworkError) {
    return { reason: 'network', message: error.message };
  }

  return { reason: 'unknown', message };
}
