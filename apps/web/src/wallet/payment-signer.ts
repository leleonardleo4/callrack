import type { CallrackPaymentSigner } from '@callrack/sdk';

/**
 * The exact shape `useWallet()` (from `@txnlab/use-wallet-react`) exposes
 * for the currently active wallet - deliberately narrow (just the two
 * fields this adapter needs), so this file never depends on the full
 * `useWallet()` return type or React itself.
 */
export interface ActiveWalletHandle {
  readonly address: string;
  readonly signTransactions: (
    txnGroup: Uint8Array[],
    indexesToSign?: number[],
  ) => Promise<(Uint8Array | null)[]>;
}

/**
 * Adapts a connected use-wallet account into the Callrack SDK's
 * `CallrackPaymentSigner` (= `@x402/avm`'s `ClientAvmSigner`) - an address
 * plus a `signTransactions` method. use-wallet's own `useWallet().signTransactions`
 * already matches this exact signature (`@txnlab/use-wallet`'s docs call it
 * out as "Compatible with @txnlab/use-wallet"), so this adapter does no
 * transaction construction or decoding of its own: it only forwards
 * whatever unsigned transaction bytes the Callrack x402 client passes in to
 * the connected wallet, and returns exactly what the wallet returns.
 *
 * A wallet rejection or unavailability is never caught or reinterpreted
 * here - it propagates as-is, so the payment flow layer (which knows the
 * user-facing vocabulary: "cancelled" vs "failed") is the single place that
 * classifies it.
 */
export function createWalletPaymentSigner(wallet: ActiveWalletHandle): CallrackPaymentSigner {
  return {
    address: wallet.address,
    signTransactions: (txns, indexesToSign) => wallet.signTransactions(txns, indexesToSign),
  };
}
