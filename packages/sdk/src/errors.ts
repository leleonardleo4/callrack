/**
 * Callrack SDK error hierarchy. Every error carries a `requestId` and
 * `capabilityId` where known, for correlating with server-side logs — and
 * never a private key, mnemonic, or payment signature, even in `cause`.
 */

export interface CallrackErrorOptions {
  readonly requestId?: string;
  readonly capabilityId?: string;
  readonly cause?: unknown;
}

export class CallrackError extends Error {
  readonly requestId: string | undefined;
  readonly capabilityId: string | undefined;

  constructor(message: string, options: CallrackErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'CallrackError';
    this.requestId = options.requestId;
    this.capabilityId = options.capabilityId;
  }
}

/** A connection-level failure — DNS, refused connection, aborted request. Never reached the server. */
export class CallrackNetworkError extends CallrackError {
  constructor(message: string, options?: CallrackErrorOptions) {
    super(message, options);
    this.name = 'CallrackNetworkError';
  }
}

export class CallrackTimeoutError extends CallrackNetworkError {
  readonly timeoutMs: number;

  constructor(message: string, timeoutMs: number, options?: CallrackErrorOptions) {
    super(message, options);
    this.name = 'CallrackTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/** The server responded, but with a non-2xx, non-402 status — a real API error envelope. */
export interface CallrackApiErrorOptions extends CallrackErrorOptions {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;
}

export class CallrackApiError extends CallrackError {
  readonly status: number;
  readonly code: string | undefined;
  readonly details: unknown;

  constructor(message: string, options: CallrackApiErrorOptions) {
    super(message, options);
    this.name = 'CallrackApiError';
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
  }
}

/** A malformed response, invalid capability id, or other client-side input/shape problem. */
export class CallrackValidationError extends CallrackError {
  constructor(message: string, options?: CallrackErrorOptions) {
    super(message, options);
    this.name = 'CallrackValidationError';
  }
}

/** A safe, non-secret snapshot of one x402 payment requirement, for error context. */
export interface PaymentRequirementSummary {
  readonly scheme: string;
  readonly network: string;
  readonly asset: string;
  /** Atomic (base-unit) amount, as advertised by the server. */
  readonly amount: string;
  readonly payTo: string;
}

export interface CallrackPaymentRequiredErrorOptions extends CallrackErrorOptions {
  readonly resource: string;
  readonly accepts: readonly PaymentRequirementSummary[];
}

/**
 * Thrown when a capability returns 402 and the SDK is not configured to pay
 * automatically (no signer given) — the caller gets the real, live
 * requirement to act on themselves, never a stale or assumed price.
 */
export class CallrackPaymentRequiredError extends CallrackError {
  readonly resource: string;
  readonly accepts: readonly PaymentRequirementSummary[];

  constructor(message: string, options: CallrackPaymentRequiredErrorOptions) {
    super(message, options);
    this.name = 'CallrackPaymentRequiredError';
    this.resource = options.resource;
    this.accepts = options.accepts;
  }
}

export type PaymentPolicyReason =
  | 'RESOURCE_MISMATCH'
  | 'NO_ACCEPTABLE_PAYMENT_REQUIREMENT'
  | 'BUDGET_EXCEEDED';

export interface CallrackPaymentPolicyErrorOptions extends CallrackErrorOptions {
  readonly reason: PaymentPolicyReason;
  readonly requirement?: PaymentRequirementSummary;
}

/**
 * Thrown when a payment requirement fails policy validation — wrong
 * network, wrong asset, amount over budget, resource mismatch, or nothing
 * acceptable in `accepts` at all. The SDK never signs when this is thrown.
 */
export class CallrackPaymentPolicyError extends CallrackError {
  readonly reason: PaymentPolicyReason;
  readonly requirement: PaymentRequirementSummary | undefined;

  constructor(message: string, options: CallrackPaymentPolicyErrorOptions) {
    super(message, options);
    this.name = 'CallrackPaymentPolicyError';
    this.reason = options.reason;
    this.requirement = options.requirement;
  }
}

/**
 * Thrown when payment creation or settlement itself fails (signing error,
 * facilitator rejection, malformed settlement response) after policy
 * validation already passed — a real attempt was made and failed.
 */
export class CallrackPaymentError extends CallrackError {
  constructor(message: string, options?: CallrackErrorOptions) {
    super(message, options);
    this.name = 'CallrackPaymentError';
  }
}

export function isCallrackError(value: unknown): value is CallrackError {
  return value instanceof CallrackError;
}
