/**
 * Structured, secret-free payment lifecycle events emitted by
 * `X402PaymentClient` as it pays for a request — never a signature, key,
 * or raw payload, only the same non-sensitive fields already visible on a
 * live 402 response. Core SDK concept (not agent-specific): the agent
 * runtime is one consumer, forwarding these into its own `AgentEvent` log,
 * but any caller of `CallrackClient` can observe them.
 */
export type PaymentEventType = 'payment_required' | 'payment_approved' | 'payment_submitted';

export interface PaymentEvent {
  readonly type: PaymentEventType;
  readonly resource: string;
  readonly network: string;
  readonly asset: string;
  /** Atomic (base-unit) amount. */
  readonly amount: string;
  readonly payTo: string;
}

export type PaymentEventListener = (event: PaymentEvent) => void;
