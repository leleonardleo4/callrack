import { x402Client } from '@x402/core/client';
import type { PaymentRequirements } from '@x402/core/types';
import { ExactAvmScheme } from '@x402/avm';
import { wrapFetchWithPayment } from '@x402/fetch';
import {
  CallrackError,
  CallrackPaymentError,
  CallrackPaymentPolicyError,
  type PaymentPolicyReason,
} from './errors.js';
import { convertToTokenAmount } from './money.js';
import type { ResolvedNetwork } from './network.js';
import { selectAcceptablePaymentRequirement, type CallrackSpendPolicy } from './spend-policy.js';
import type { CallrackPaymentSigner } from './signer.js';
import type { PaymentEventListener } from './payment-events.js';

export interface X402PaymentClientOptions {
  readonly resolvedNetwork: ResolvedNetwork;
  readonly signer: CallrackPaymentSigner;
  readonly spendPolicy: CallrackSpendPolicy;
  readonly onPaymentEvent?: PaymentEventListener;
}

function requirementsMatch(a: PaymentRequirements, b: PaymentRequirements): boolean {
  return (
    a.scheme === b.scheme && a.network === b.network && a.asset === b.asset && a.amount === b.amount && a.payTo === b.payTo
  );
}

const KNOWN_POLICY_REASONS: readonly PaymentPolicyReason[] = [
  'RESOURCE_MISMATCH',
  'NO_ACCEPTABLE_PAYMENT_REQUIREMENT',
  'BUDGET_EXCEEDED',
];

/** Patterns from @x402/core's own internal selection/spend-control filtering (pre-signing rejections we never authored ourselves, but must still surface as policy errors rather than opaque payment failures). */
const LIBRARY_POLICY_REJECTION_PATTERNS: readonly RegExp[] = [
  /No network\/scheme registered/i,
  /rejected by spendControls/i,
  /filtered out by policies/i,
  /No payment requirements with a recognized paymentFlow/i,
];

/**
 * Classifies an error thrown from the payment-enabled fetch into the SDK's
 * error taxonomy. Never re-wraps an already-classified CallrackError.
 */
function classifyPaymentError(
  error: unknown,
  context: { readonly requestId?: string; readonly capabilityId?: string },
): CallrackError {
  if (error instanceof CallrackError) return error;

  const message = error instanceof Error ? error.message : String(error);

  const abortMatch = /Payment creation aborted: (\w+)/.exec(message);
  if (abortMatch && KNOWN_POLICY_REASONS.includes(abortMatch[1] as PaymentPolicyReason)) {
    const reason = abortMatch[1] as PaymentPolicyReason;
    return new CallrackPaymentPolicyError(`Payment rejected by policy (${reason})`, {
      ...context,
      reason,
      cause: error,
    });
  }

  if (LIBRARY_POLICY_REJECTION_PATTERNS.some((pattern) => pattern.test(message))) {
    return new CallrackPaymentPolicyError('No payment requirement satisfies this client’s spend policy', {
      ...context,
      reason: 'NO_ACCEPTABLE_PAYMENT_REQUIREMENT',
      cause: error,
    });
  }

  return new CallrackPaymentError(`Payment failed: ${message}`, { ...context, cause: error });
}

function resolveRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

/**
 * Builds a payment-transparent `fetch` for one Callrack client configuration.
 * Orchestration itself (402 detection, header parsing, signing, retry,
 * double-payment guarding) is delegated entirely to `@x402/fetch`'s
 * `wrapFetchWithPayment` - the official, tested driver - rather than
 * reimplemented. This module only adds Callrack's own policy layer on top,
 * via `onBeforePaymentCreation`: every payment requirement the underlying
 * client selects is independently re-validated against the request the SDK
 * itself made (resource URL, network, asset, amount) before any signing
 * happens - never against the server's own claimed destination alone.
 *
 * A fresh `x402Client` is built per call (cheap, no I/O) rather than shared,
 * so the expected resource URL closed over by `onBeforePaymentCreation` can
 * never leak between concurrent requests.
 */
export class X402PaymentClient {
  readonly #resolvedNetwork: ResolvedNetwork;
  readonly #signer: CallrackPaymentSigner;
  readonly #spendPolicy: CallrackSpendPolicy;
  readonly #onPaymentEvent: PaymentEventListener | undefined;

  constructor(options: X402PaymentClientOptions) {
    this.#resolvedNetwork = options.resolvedNetwork;
    this.#signer = options.signer;
    this.#spendPolicy = options.spendPolicy;
    this.#onPaymentEvent = options.onPaymentEvent;
  }

  readonly fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const expectedResourceUrl = resolveRequestUrl(input);
    const client = this.#buildClient(expectedResourceUrl);
    const payingFetch = wrapFetchWithPayment(globalThis.fetch.bind(globalThis), client);
    try {
      return await payingFetch(input, init);
    } catch (error) {
      throw classifyPaymentError(error, {});
    }
  };

  #buildClient(expectedResourceUrl: string): x402Client {
    const resolvedNetwork = this.#resolvedNetwork;
    const spendPolicy = this.#spendPolicy;
    const maxAtomic = convertToTokenAmount(spendPolicy.maxPayment, resolvedNetwork.usdcDecimals);

    const client = new x402Client();
    client.register(resolvedNetwork.caip2, new ExactAvmScheme(this.#signer));

    // Defense-in-depth: the library's own asset/amount cap, scoped to this
    // client's configured network and policy - in addition to (not instead
    // of) the independent re-check in onBeforePaymentCreation below.
    client.setSpendControls({
      maxAmountPerPayment: maxAtomic,
      allowedAssets: spendPolicy.allowedAssets.map((asset) => ({
        network: resolvedNetwork.caip2,
        asset,
        maxAmountPerPayment: maxAtomic,
      })),
    });

    const onPaymentEvent = this.#onPaymentEvent;

    client.onBeforePaymentCreation(async (context) => {
      onPaymentEvent?.({
        type: 'payment_required',
        resource: context.paymentRequired.resource.url,
        network: context.selectedRequirements.network,
        asset: context.selectedRequirements.asset,
        amount: context.selectedRequirements.amount,
        payTo: context.selectedRequirements.payTo,
      });

      const result = selectAcceptablePaymentRequirement({
        paymentRequired: context.paymentRequired,
        expectedResourceUrl,
        policy: spendPolicy,
        usdcDecimals: resolvedNetwork.usdcDecimals,
      });

      if (!result.ok) {
        return { abort: true, reason: result.reason };
      }
      if (!requirementsMatch(result.requirement, context.selectedRequirements)) {
        return { abort: true, reason: 'NO_ACCEPTABLE_PAYMENT_REQUIREMENT' satisfies PaymentPolicyReason };
      }

      onPaymentEvent?.({
        type: 'payment_approved',
        resource: context.paymentRequired.resource.url,
        network: context.selectedRequirements.network,
        asset: context.selectedRequirements.asset,
        amount: context.selectedRequirements.amount,
        payTo: context.selectedRequirements.payTo,
      });
      return undefined;
    });

    client.onAfterPaymentCreation(async (context) => {
      onPaymentEvent?.({
        type: 'payment_submitted',
        resource: context.paymentRequired.resource.url,
        network: context.selectedRequirements.network,
        asset: context.selectedRequirements.asset,
        amount: context.selectedRequirements.amount,
        payTo: context.selectedRequirements.payTo,
      });
    });

    return client;
  }
}
