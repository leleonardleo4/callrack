import { API_BASE_URL } from '@/config/env';
import {
  decodePaymentRequiredHeader,
  decodePaymentResponseHeader,
  PAYMENT_REQUIRED_HEADER,
  PAYMENT_RESPONSE_HEADER,
  PAYMENT_SIGNATURE_HEADER,
  type PaymentRequired,
} from '@/lib/x402';
import type { PublicCapabilitiesData } from '@/types/capability';

export interface ApiErrorPayload {
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
}

export interface ApiSuccessResult<T> {
  readonly kind: 'success';
  readonly status: number;
  readonly data: T;
  readonly requestId: string;
  /**
   * The decoded `PAYMENT-RESPONSE` settlement header, present only when the
   * server actually sent one, i.e. only when a real payment was verified and
   * settled. Never populated speculatively.
   */
  readonly paymentResponse?: Record<string, unknown>;
}

export interface PaymentRequiredResult {
  readonly kind: 'payment-required';
  readonly status: 402;
  readonly paymentRequired: PaymentRequired;
  readonly requestId: string | undefined;
}

export interface ApiErrorResult {
  readonly kind: 'api-error';
  readonly status: number;
  readonly error: ApiErrorPayload;
  readonly requestId: string | undefined;
}

export interface NetworkErrorResult {
  readonly kind: 'network-error';
  readonly message: string;
}

export type ApiResult<T> = ApiSuccessResult<T> | PaymentRequiredResult | ApiErrorResult | NetworkErrorResult;

const REQUEST_ID_HEADER = 'x-request-id';

export function resolveApiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

/**
 * Parses an already-fetched `Response` from a Callrack API call into an
 * `ApiResult`. Extracted so both the plain (unpaid) request path below and
 * the wallet-backed paid path (`lib/wallet-api-client.ts`, which drives
 * `fetch` through the SDK's `X402PaymentClient` instead of a bare `fetch`)
 * share exactly one implementation of 402/error/success envelope parsing —
 * never two divergent copies.
 */
export async function parseApiResponse<T>(response: Response): Promise<ApiResult<T>> {
  const requestId = response.headers.get(REQUEST_ID_HEADER) ?? undefined;

  if (response.status === 402) {
    const header = response.headers.get(PAYMENT_REQUIRED_HEADER);
    if (!header) {
      return {
        kind: 'api-error',
        status: 402,
        error: {
          code: 'PAYMENT_REQUIRED_HEADER_MISSING',
          message: 'The server returned 402 without a PAYMENT-REQUIRED header.',
        },
        requestId,
      };
    }
    try {
      return {
        kind: 'payment-required',
        status: 402,
        paymentRequired: decodePaymentRequiredHeader(header),
        requestId,
      };
    } catch {
      return {
        kind: 'api-error',
        status: 402,
        error: {
          code: 'PAYMENT_REQUIRED_HEADER_INVALID',
          message: 'The server returned 402, but the PAYMENT-REQUIRED header could not be decoded.',
        },
        requestId,
      };
    }
  }

  let body: unknown;
  try {
    body = response.status === 204 ? undefined : await response.json();
  } catch {
    body = undefined;
  }

  if (response.ok) {
    const envelope = body as { data: T; meta?: { requestId?: string } } | undefined;
    const paymentResponseHeader = response.headers.get(PAYMENT_RESPONSE_HEADER);
    let paymentResponse: Record<string, unknown> | undefined;
    if (paymentResponseHeader) {
      try {
        paymentResponse = decodePaymentResponseHeader(paymentResponseHeader);
      } catch {
        // Malformed header on an otherwise-successful response: surface the
        // response normally rather than failing the whole request over it.
      }
    }
    return {
      kind: 'success',
      status: response.status,
      data: envelope?.data as T,
      requestId: envelope?.meta?.requestId ?? requestId ?? 'unknown',
      ...(paymentResponse ? { paymentResponse } : {}),
    };
  }

  const envelope = body as { error?: ApiErrorPayload } | undefined;
  return {
    kind: 'api-error',
    status: response.status,
    error: envelope?.error ?? {
      code: 'UNKNOWN_ERROR',
      message: response.statusText || `Request failed with status ${response.status}.`,
    },
    requestId,
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(resolveApiUrl(path), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });
  } catch (cause) {
    return {
      kind: 'network-error',
      message: cause instanceof Error ? cause.message : 'The network request failed.',
    };
  }
  return parseApiResponse<T>(response);
}

export function getCapabilities(): Promise<ApiResult<PublicCapabilitiesData>> {
  return request<PublicCapabilitiesData>('/v1/capabilities', { method: 'GET' });
}

/**
 * Calls a real Callrack capability endpoint. `path` must come from a
 * capability the caller already fetched via `getCapabilities()`, never
 * from free-form user input, so this can only ever reach known Callrack
 * routes, never an arbitrary URL (see the Playground's safety requirement:
 * no open proxy/SSRF surface).
 *
 * `paymentSignature`, if given, is forwarded verbatim as the
 * `PAYMENT-SIGNATURE` header. Callrack never generates, signs, or holds a
 * payment itself; a caller who already has a valid signed payment (produced
 * entirely outside this app) can attach it to see the real, paid response.
 */
export function callCapability<T = unknown>(
  path: string,
  body: Record<string, unknown>,
  paymentSignature?: string,
): Promise<ApiResult<T>> {
  return request<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
    ...(paymentSignature ? { headers: { [PAYMENT_SIGNATURE_HEADER]: paymentSignature } } : {}),
  });
}
