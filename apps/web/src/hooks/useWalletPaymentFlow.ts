import { useCallback, useRef, useState } from 'react';
import { callCapability, type ApiResult } from '@/lib/api-client';
import { callCapabilityWithWallet } from '@/lib/wallet-api-client';
import { classifyPaymentFlowError, type PaymentFlowFailure } from '@/wallet/classify-payment-error';
import type { WalletPaymentContext } from '@/wallet/useWalletSigner';
import type { PaymentRequired } from '@/lib/x402';
import type { PublicCapability } from '@/types/capability';

export type PaymentFlowStatus =
  | 'idle'
  | 'preparing'
  | 'payment-required'
  | 'awaiting-approval'
  | 'submitting-payment'
  | 'retrying'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface PaymentFlowState {
  readonly status: PaymentFlowStatus;
  readonly result?: ApiResult<unknown>;
  readonly paymentRequired?: PaymentRequired;
  readonly failure?: PaymentFlowFailure;
}

interface PendingRequest {
  readonly capability: PublicCapability;
  readonly body: Record<string, unknown>;
}

const IDLE_STATE: PaymentFlowState = { status: 'idle' };

/**
 * Drives one Playground request through the full diagram this feature
 * implements: an unpaid probe first (so a real 402 — never a simulated one
 * — decides whether payment is needed at all), then, only on the user's
 * explicit approval, a wallet-backed retry through the SDK's own
 * `X402PaymentClient`. Every status transition here reflects something that
 * actually happened — there is no synthetic "payment successful" state
 * reachable without the underlying `X402PaymentClient.fetch` call actually
 * resolving with a paid (2xx) response.
 */
export function useWalletPaymentFlow() {
  const [state, setState] = useState<PaymentFlowState>(IDLE_STATE);
  const pendingRef = useRef<PendingRequest | undefined>(undefined);

  const start = useCallback(async (capability: PublicCapability, body: Record<string, unknown>): Promise<void> => {
    pendingRef.current = { capability, body };
    setState({ status: 'preparing' });

    const result = await callCapability(capability.path, body);

    if (result.kind === 'payment-required') {
      setState({ status: 'payment-required', result, paymentRequired: result.paymentRequired });
      return;
    }
    pendingRef.current = undefined;
    setState({ status: result.kind === 'success' ? 'completed' : 'failed', result });
  }, []);

  const approveAndPay = useCallback(
    async (wallet: WalletPaymentContext, requiredNetworkLabel?: string): Promise<void> => {
      const pending = pendingRef.current;
      if (!pending) return;

      setState((previous) => ({ ...previous, status: 'awaiting-approval' }));

      try {
        const result = await callCapabilityWithWallet({
          path: pending.capability.path,
          body: pending.body,
          signer: wallet.signer,
          resolvedNetwork: wallet.resolvedNetwork,
          spendPolicy: wallet.spendPolicy,
          onPaymentEvent: (event) => {
            if (event.type === 'payment_approved') {
              setState((previous) => (previous.status === 'failed' ? previous : { ...previous, status: 'awaiting-approval' }));
            } else if (event.type === 'payment_submitted') {
              setState((previous) => (previous.status === 'failed' ? previous : { ...previous, status: 'submitting-payment' }));
              queueMicrotask(() => {
                setState((previous) => (previous.status === 'submitting-payment' ? { ...previous, status: 'retrying' } : previous));
              });
            }
          },
        });

        pendingRef.current = undefined;
        if (result.kind === 'success') {
          setState((previous) => ({ ...previous, status: 'completed', result }));
          return;
        }
        // A resolved (non-thrown) non-success result here means the wallet
        // attempt completed but the underlying request still failed for
        // some other reason (e.g. the capability itself errored after a
        // real, already-settled payment) — always attach a `failure` so
        // the response panel's 'failed' branch renders the real message
        // instead of silently falling through to redisplay a stale
        // "payment required" card as if the attempt never happened.
        const failure: PaymentFlowFailure =
          result.kind === 'network-error'
            ? {
                reason: 'network',
                message: result.message,
                hint: 'Check that the Callrack API is reachable from this browser and try again — this never reached the point of attempting payment.',
              }
            : result.kind === 'api-error'
              ? {
                  reason: 'unknown',
                  message: `${result.error.code}: ${result.error.message}`,
                  hint: result.payment
                    ? undefined
                    : 'The payment itself may have gone through, but the capability request that followed it failed. Check the request ID above if you need to report this.',
                  ...(result.payment ? { payment: result.payment } : {}),
                }
              : {
                  reason: 'payment-rejected',
                  message:
                    result.paymentRequired.error ??
                    'The server returned a payment-required response after the payment attempt.',
                  hint: 'The server or facilitator rejected this payment after it was submitted. The real reason is above — if it isn\'t clear, this is worth reporting rather than retrying blindly.',
                };
        setState((previous) => ({ ...previous, status: 'failed', result, failure }));
      } catch (error) {
        const failure = classifyPaymentFlowError(error, requiredNetworkLabel);
        pendingRef.current = failure.reason === 'cancelled' ? pending : undefined;
        setState((previous) => ({
          ...previous,
          status: failure.reason === 'cancelled' ? 'cancelled' : 'failed',
          failure,
        }));
      }
    },
    [],
  );

  const reset = useCallback((): void => {
    pendingRef.current = undefined;
    setState(IDLE_STATE);
  }, []);

  return { state, start, approveAndPay, reset };
}
