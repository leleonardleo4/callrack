import { encodePaymentRequiredHeader } from '@x402/core/http';
import type { PaymentRequired, PaymentRequirements } from '@x402/core/types';
import { vi } from 'vitest';

export function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'x-request-id': 'req_test', ...headers },
  });
}

export function paymentRequiredResponse(paymentRequired: PaymentRequired): Response {
  return new Response(null, {
    status: 402,
    headers: {
      'x-request-id': 'req_test',
      'PAYMENT-REQUIRED': encodePaymentRequiredHeader(paymentRequired),
    },
  });
}

export function buildPaymentRequirements(overrides: Partial<PaymentRequirements> = {}): PaymentRequirements {
  return {
    scheme: 'exact',
    network: 'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=',
    asset: '10458941',
    amount: '10000',
    payTo: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ',
    maxTimeoutSeconds: 60,
    extra: {},
    ...overrides,
  };
}

export function buildPaymentRequired(overrides: {
  readonly resourceUrl: string;
  readonly accepts?: readonly PaymentRequirements[];
  readonly error?: string;
}): PaymentRequired {
  return {
    x402Version: 2,
    resource: { url: overrides.resourceUrl },
    accepts: overrides.accepts ?? [buildPaymentRequirements()],
    ...(overrides.error !== undefined ? { error: overrides.error } : {}),
  };
}

/** A queue-based fetch mock: each call returns the next queued Response and records the Request it received. */
export function createFetchQueue(): {
  readonly fetch: typeof fetch;
  readonly calls: Request[];
  push(response: Response): void;
} {
  const queue: Response[] = [];
  const calls: Request[] = [];

  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(new Request(input, init));
    const next = queue.shift();
    if (!next) {
      throw new Error('createFetchQueue: no queued response left');
    }
    return next;
  }) as unknown as typeof fetch;

  return {
    fetch: fetchImpl,
    calls,
    push: (response: Response) => queue.push(response),
  };
}
