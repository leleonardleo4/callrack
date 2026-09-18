import { Logger } from '@nestjs/common';
import { decodePaymentResponseHeader } from '@x402/core/http';
import type { SettleResponse } from '@x402/core/types';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type {} from '@x402/fastify';
import { getCapabilityExecutionFailure } from '../common/request-context/capability-outcome.js';
import { extractPaymentContext } from './payment-context.js';
import { PAYMENT_RESPONSE_HEADER } from './x402-headers.constants.js';
import type { RefundOrchestrationService } from '../refunds/refund-orchestration.service.js';
import type { X402ConfigService } from '../config/x402-config.service.js';
import { ApiErrorCode } from '../common/errors/api-error-codes.js';

const logger = new Logger('RefundResponseHook');

/** Safe decode — a missing/malformed header just means "no confirmed settlement", never a crash. */
export function tryDecodeSettlement(headerValue: string | number | string[] | undefined): SettleResponse | undefined {
  if (typeof headerValue !== 'string') return undefined;
  try {
    return decodePaymentResponseHeader(headerValue);
  } catch {
    return undefined;
  }
}

/** The two possible envelope shapes a capability response can already be in, by the time onSend sees it. */
interface SuccessEnvelope {
  data?: unknown;
  meta?: { requestId?: string; [key: string]: unknown };
}
interface ErrorEnvelope {
  error: { code: string; message: string; details?: unknown };
  meta: { requestId?: string; [key: string]: unknown };
}

function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  return typeof value === 'object' && value !== null && 'error' in value;
}

export interface RefundHookDeps {
  readonly refundOrchestrator: RefundOrchestrationService;
  readonly x402Config: X402ConfigService;
}

/**
 * Registered as a Fastify `onSend` hook, AFTER `@x402/fastify`'s own onSend
 * hook (see install-x402-middleware.ts) — so by the time this runs, x402 has
 * already decided whether to settle and, if it did, already attached the
 * `PAYMENT-RESPONSE` header. This is "the boundary that can observe both
 * successful settlement and subsequent capability failure" the refund
 * system's design calls for — x402's own verify/settle logic is completely
 * unmodified; this only ever reads its output and, on the specific
 * "settled but failed" combination, augments the outgoing response.
 *
 * Deliberately does nothing (returns `payload` unchanged) for every other
 * combination: unpaid routes, failed/rejected/pending payments, and
 * ordinary successful paid responses are all untouched.
 */
export function createRefundOnSendHook(deps: RefundHookDeps) {
  return async function refundOnSendHook(
    request: FastifyRequest,
    reply: FastifyReply,
    payload: unknown,
  ): Promise<unknown> {
    const x402Context = request.x402Context;
    if (!x402Context) return payload; // not a paid route at all

    const settlement = tryDecodeSettlement(reply.getHeader(PAYMENT_RESPONSE_HEADER));
    if (!settlement || settlement.success !== true) return payload; // never actually charged — nothing to refund

    const capabilityFailed = reply.statusCode >= 400 || getCapabilityExecutionFailure() !== undefined;
    if (!capabilityFailed) return payload; // normal paid success — untouched

    let parsed: unknown;
    try {
      parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
    } catch {
      // Not JSON (e.g. an HTML error page from an unrelated failure mode) —
      // never crash the response over this; the refund still gets recorded
      // below, just without a body annotation the client can read.
      parsed = undefined;
    }

    const requestId =
      (isErrorEnvelope(parsed) ? parsed.meta?.requestId : (parsed as SuccessEnvelope | undefined)?.meta?.requestId) ??
      request.id;

    // Best-effort payer decoded directly from the client's own signed
    // transaction bytes — used only if the trusted settlement response
    // itself omits `payer` (see PaymentContext's own docs on why this is
    // never taken from request JSON).
    const fallbackPayer = extractPaymentContext(x402Context)?.payer;

    let refundView;
    try {
      refundView = await deps.refundOrchestrator.handleFailedPaidCapability({
        requestId,
        capabilitySlug: undefined,
        network: deps.x402Config.network,
        settlement,
        paymentRequirements: x402Context.paymentRequirements,
        fallbackPayer,
      });
    } catch (error) {
      // The refund pipeline itself must never take down an already-failing
      // response — log loudly and fall back to "pending" so the client at
      // least knows a refund is owed, never that everything is fine.
      logger.error(`Refund orchestration threw: ${(error as Error).message}`, (error as Error).stack);
      refundView = { status: 'refund_pending' as const };
    }

    const paymentField =
      refundView.status === 'refunded'
        ? { status: 'refunded', refundTransaction: refundView.refundTransaction }
        : { status: 'refund_pending' };

    if (isErrorEnvelope(parsed)) {
      reply.status(reply.statusCode >= 400 ? reply.statusCode : 500);
      return JSON.stringify({ ...parsed, payment: paymentField });
    }

    // A 2xx response whose body was still success-shaped (currently only
    // /v1/research's total-failure case) — synthesize the standard error
    // envelope so the client actually sees a failing status, per the
    // "never swallow the original capability failure" requirement.
    reply.status(500);
    return JSON.stringify({
      error: { code: ApiErrorCode.CAPABILITY_EXECUTION_FAILED, message: 'Capability execution failed.' },
      meta: { requestId },
      payment: paymentField,
    });
  };
}
