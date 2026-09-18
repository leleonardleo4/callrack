import { RequestContext } from './request-context.js';

const KEY = 'capabilityExecutionFailureReason';

/**
 * Lets a capability whose HTTP contract intentionally always returns 2xx
 * (currently only `/v1/research` — see its `status: 'complete'|'partial'|
 * 'failed'` body field) report that this specific request should still be
 * treated as a FAILED execution for refund purposes, without changing its
 * documented HTTP status contract.
 *
 * Every other capability needs no such call: throwing (or returning a
 * non-2xx status) already prevents x402 from ever settling payment in the
 * first place (see `install-x402-middleware.ts`'s settlement-failure
 * detection), so there's nothing to refund. This exists ONLY for the
 * narrower case of a 2xx response whose own body represents total failure.
 *
 * Uses the same AsyncLocalStorage-backed `RequestContext` already
 * established at the very start of the request (see `bootstrap.ts`), so a
 * value set deep inside a capability service is still readable later from
 * the Fastify `onSend` hook that decides whether to trigger a refund.
 */
export function markCapabilityExecutionFailed(reason: string): void {
  RequestContext.set(KEY, reason);
}

export function getCapabilityExecutionFailure(): string | undefined {
  return RequestContext.get<string>(KEY);
}
