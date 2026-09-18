import {
  CallrackError,
  CallrackNetworkError,
  type CallrackPaymentSigner,
  type CallrackSpendPolicy,
  type PaymentEventListener,
  type ResolvedNetwork,
  X402PaymentClient,
} from '@callrack/sdk';
import { parseApiResponse, resolveApiUrl, type ApiResult } from '@/lib/api-client';

export interface CallCapabilityWithWalletOptions {
  readonly path: string;
  readonly body: Record<string, unknown>;
  readonly signer: CallrackPaymentSigner;
  readonly resolvedNetwork: ResolvedNetwork;
  readonly spendPolicy: CallrackSpendPolicy;
  readonly onPaymentEvent?: PaymentEventListener;
}

/**
 * Calls a Callrack capability with a connected wallet paying automatically
 * on 402 — the browser counterpart to `callCapability` in `api-client.ts`,
 * reusing the exact same response parsing (`parseApiResponse`) so a paid
 * and an unpaid call are interpreted identically.
 *
 * All 402 detection, payment-requirement selection, policy validation,
 * transaction construction/signing, submission, and retry is delegated
 * entirely to the SDK's own `X402PaymentClient` (the same class the Node
 * SDK client and the reference agent already use) — this function only
 * supplies the wallet-derived signer and turns the result back into the
 * app's `ApiResult` union. It never constructs or interprets an x402
 * payload itself.
 */
export async function callCapabilityWithWallet<T = unknown>(
  options: CallCapabilityWithWalletOptions,
): Promise<ApiResult<T>> {
  const paymentClient = new X402PaymentClient({
    resolvedNetwork: options.resolvedNetwork,
    signer: options.signer,
    spendPolicy: options.spendPolicy,
    onPaymentEvent: options.onPaymentEvent,
  });

  let response: Response;
  try {
    response = await paymentClient.fetch(resolveApiUrl(options.path), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(options.body ?? {}),
    });
  } catch (error) {
    if (error instanceof CallrackError) {
      // Re-thrown for the payment-flow hook to classify precisely (cancelled,
      // wrong network, insufficient balance, server rejection, ...) — see
      // wallet/classify-payment-error.ts. Never flattened into a generic
      // network-error here, unlike the plain `request()` path, because the
      // SDK has already done the real classification work.
      throw error;
    }
    throw new CallrackNetworkError(error instanceof Error ? error.message : 'The wallet payment request failed.', {
      cause: error,
    });
  }

  return parseApiResponse<T>(response);
}
