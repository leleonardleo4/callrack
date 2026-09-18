import {
  CallrackError,
  CallrackNetworkError,
  CallrackPaymentError,
  type CallrackPaymentSigner,
  type CallrackSpendPolicy,
  type PaymentEventListener,
  type ResolvedNetwork,
  X402PaymentClient,
} from '@callrack/sdk';
import { parseApiResponse, resolveApiUrl, type ApiResult } from '@/lib/api-client';
import { decodePaymentRequiredHeader, PAYMENT_REQUIRED_HEADER } from '@/lib/x402';

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

  // This call is only ever made with a signer already configured — so
  // unlike the plain, unpaid `callCapability` path, a 402 reaching here can
  // never mean "nothing has tried to pay yet". `X402PaymentClient.fetch`
  // resolves normally (it does not throw) even when its retry's final
  // response is still a 402 — e.g. the facilitator rejected the payment, or
  // settlement otherwise failed after a real attempt — so without this
  // check that rejection would be silently parsed as an ordinary
  // `payment-required` result, indistinguishable from the original,
  // never-paid probe. That previously showed the Playground's generic
  // "Payment required" card again after a real payment attempt, instead of
  // the server's actual rejection reason.
  if (response.status === 402) {
    const header = response.headers.get(PAYMENT_REQUIRED_HEADER);
    const reason = (() => {
      if (!header) return '';
      try {
        const decoded = decodePaymentRequiredHeader(header);
        return decoded.error ? `: ${decoded.error}` : '';
      } catch {
        return '';
      }
    })();
    throw new CallrackPaymentError(`Payment for ${options.path} was rejected by the server${reason}`);
  }

  return parseApiResponse<T>(response);
}
