import { decodeTransaction, getSenderFromTransaction, isExactAvmPayload } from '@x402/avm';
// Importing @x402/fastify (even just for its types elsewhere in this
// program) applies its `declare module "fastify"` augmentation, which is
// what actually adds `x402Context` to FastifyRequest — X402PaymentContext
// itself isn't a public export, so it's referenced via that augmentation.
import type {} from '@x402/fastify';
import type { FastifyRequest } from 'fastify';
import { RequestContext } from '../common/request-context/request-context.js';

type X402PaymentContext = NonNullable<FastifyRequest['x402Context']>;

const PAYMENT_CONTEXT_KEY = 'payment';

/**
 * Sanitized, capability-agnostic view of a verified x402 payment — never
 * signatures or raw transaction bytes, only what's useful for correlating a
 * request with its payment (see Phase 7 spec §17-18).
 */
export interface PaymentContext {
  readonly scheme: string;
  readonly network: string;
  readonly asset: string;
  readonly amount: string;
  readonly payer?: string;
}

/**
 * Best-effort payer extraction for the AVM `exact` scheme: the ASA transfer
 * transaction's sender. Never throws — a decode failure just omits `payer`,
 * it never fails the (already-verified) request.
 */
function tryExtractPayer(paymentPayload: X402PaymentContext['paymentPayload']): string | undefined {
  const { payload } = paymentPayload;
  if (!isExactAvmPayload(payload)) {
    return undefined;
  }
  try {
    const paymentTxn = payload.paymentGroup[payload.paymentIndex];
    if (!paymentTxn) {
      return undefined;
    }
    // The payment-index transaction is the client's own signed ASA transfer
    // (other entries in the group, e.g. a fee payer txn, may be unsigned).
    return getSenderFromTransaction(decodeTransaction(paymentTxn), true);
  } catch {
    return undefined;
  }
}

export function extractPaymentContext(x402Context: X402PaymentContext | undefined): PaymentContext | undefined {
  if (!x402Context) {
    return undefined;
  }
  const { paymentRequirements, paymentPayload } = x402Context;
  return {
    scheme: paymentRequirements.scheme,
    network: paymentRequirements.network,
    asset: paymentRequirements.asset,
    amount: paymentRequirements.amount,
    payer: tryExtractPayer(paymentPayload),
  };
}

/** Reads the current request's payment context, if the route was paid. Never touches Fastify/x402 directly. */
export function getCurrentPaymentContext(): PaymentContext | undefined {
  return RequestContext.get<PaymentContext>(PAYMENT_CONTEXT_KEY);
}

/** Called only by the x402 Fastify wiring — see install-x402-middleware.ts. */
export function setCurrentPaymentContext(context: PaymentContext): void {
  RequestContext.set(PAYMENT_CONTEXT_KEY, context);
}
