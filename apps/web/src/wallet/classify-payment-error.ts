import {
  CallrackNetworkError,
  CallrackPaymentError,
  CallrackPaymentPolicyError,
  CallrackTimeoutError,
} from '@callrack/sdk';
import type { ApiPaymentRefundInfo } from '@/lib/api-client';

export type PaymentFlowFailureReason =
  | 'cancelled'
  | 'wallet-unavailable'
  | 'wrong-network'
  | 'insufficient-balance'
  | 'receiver-not-opted-in'
  | 'payment-rejected'
  | 'policy'
  | 'network'
  | 'unknown';

export interface PaymentFlowFailure {
  readonly reason: PaymentFlowFailureReason;
  /** Always a real message - the server's or wallet's own, never fabricated. */
  readonly message: string;
  /**
   * A plain-language explanation of what this specific reason means and,
   * where there's a concrete next step, how to resolve it - additive only,
   * never a replacement for `message`. Omitted when there's nothing more
   * useful to say than the real error itself.
   */
  readonly hint?: string;
  /**
   * Present only when the server itself reports that this payment was
   * settled but the capability then failed (see `ApiPaymentRefundInfo`).
   * Never set by `classifyPaymentFlowError` - only ever attached by
   * `useWalletPaymentFlow` directly from a real `api-error` response body.
   */
  readonly payment?: ApiPaymentRefundInfo;
}

// A real wallet rejection surfaces from @x402/avm's ExactAvmScheme as a
// generic thrown Error whose message is whatever the wallet SDK produced
// (Pera/Defly/Lute/WalletConnect all describe a decline in terms of the
// *user*, e.g. "...rejected by the user"). Deliberately narrower than a bare
// /reject/i or /cancel/i: the server's own rejection message (surfaced via
// CallrackPaymentError, e.g. "Payment for ... was rejected by the server:
// ...") also contains the word "rejected" - matching on that alone would
// misclassify a real server/facilitator rejection as a user cancellation.
const CANCEL_PATTERNS: readonly RegExp[] = [
  /\buser\b.{0,20}\b(reject|cancel|declin|den(y|ied))/i,
  /\b(reject|cancel|declin|den(y|ied))\w*\b.{0,20}\buser\b/i,
  /closed by user/i,
  /user closed/i,
];
const WALLET_UNAVAILABLE_PATTERNS: readonly RegExp[] = [/not available/i, /not installed/i, /no wallet/i, /disconnected/i];
// Algod's exact simulation-error wording for an account that can't receive
// an asset it hasn't opted in to yet (see @callrack/api's earlier real
// Testnet debugging session) - checked before the generic BALANCE_PATTERNS
// below, since this message also happens to contain "asset"/"missing" but
// is a completely different, server-side-only problem.
const NOT_OPTED_IN_PATTERNS: readonly RegExp[] = [/must optin/i, /missing from/i];
const BALANCE_PATTERNS: readonly RegExp[] = [/insufficient/i, /underflow/i, /overspend/i, /\bbalance\b/i];

/**
 * Classifies whatever the wallet-backed payment attempt threw into the
 * Playground's own small, user-facing vocabulary. Never invents a cause the
 * error doesn't support - an unmatched `CallrackPaymentError` still shows
 * its own real message (see requirement: "surface the existing
 * CallrackPaymentError details instead of replacing them with a generic
 * wallet error"), and this function performs no retry, no parallel
 * transaction-expiry tracking, and no re-classification of an error that
 * isn't actually a payment failure.
 */
export function classifyPaymentFlowError(error: unknown, requiredNetworkLabel?: string): PaymentFlowFailure {
  const message = error instanceof Error ? error.message : String(error);

  if (CANCEL_PATTERNS.some((pattern) => pattern.test(message))) {
    return {
      reason: 'cancelled',
      message: 'Transaction cancelled.',
      hint: 'You closed or declined the request in your wallet. Click "Approve & pay" again whenever you\'re ready.',
    };
  }

  if (WALLET_UNAVAILABLE_PATTERNS.some((pattern) => pattern.test(message))) {
    return {
      reason: 'wallet-unavailable',
      message,
      hint: 'This wallet isn\'t reachable in this browser or device. If it\'s an extension wallet (Lute), confirm it\'s installed and unlocked; otherwise try a different wallet from the connect dialog.',
    };
  }

  if (error instanceof CallrackPaymentPolicyError) {
    if (error.reason === 'NO_ACCEPTABLE_PAYMENT_REQUIREMENT') {
      const networkNote = requiredNetworkLabel ? ` Callrack currently requires ${requiredNetworkLabel}.` : '';
      return {
        reason: 'wrong-network',
        message: `This request's payment requirements don't match what this wallet is configured to pay (network, asset, or amount).${networkNote}`,
        hint: 'Disconnect and reconnect your wallet, and confirm it holds USDC on the required network - this app never pays on a different network, asset, or amount than the live challenge specifies.',
      };
    }
    return {
      reason: 'policy',
      message: error.message,
      hint: 'This request was blocked by this app\'s own spend-policy safeguards before anything was signed - no payment was attempted.',
    };
  }

  if (error instanceof CallrackPaymentError) {
    // Algod's exact wording for "the receiving account hasn't opted in to
    // this asset" - a real payment was signed and sent, but the *server's*
    // own payTo address can't accept it. Never something the payer can fix;
    // always a Callrack deployment configuration issue.
    if (NOT_OPTED_IN_PATTERNS.some((pattern) => pattern.test(message))) {
      return {
        reason: 'receiver-not-opted-in',
        message: error.message,
        hint:
          'This is a Callrack server configuration issue, not something wrong with your wallet or payment: the payment destination account hasn\'t opted in to receive this asset on this network yet. ' +
          'If you operate this deployment, opt the configured payTo account into the USDC asset shown above (e.g. via any wallet\'s "add asset"/opt-in action, or `goal asset send` with a 0-amount self-transfer), then retry.',
      };
    }
    if (BALANCE_PATTERNS.some((pattern) => pattern.test(message))) {
      return {
        reason: 'insufficient-balance',
        message: error.message,
        hint: 'The connected account doesn\'t have enough of the required asset to complete this payment. Fund it and try again.',
      };
    }
    return {
      reason: 'payment-rejected',
      message: error.message,
      hint: 'The server or facilitator rejected this payment after it was submitted. The real reason is above - if it isn\'t clear, this is worth reporting rather than retrying blindly.',
    };
  }

  if (error instanceof CallrackTimeoutError || error instanceof CallrackNetworkError) {
    return {
      reason: 'network',
      message: error.message,
      hint: 'Check that the Callrack API is reachable from this browser and try again - this never reached the point of attempting payment.',
    };
  }

  return { reason: 'unknown', message };
}
