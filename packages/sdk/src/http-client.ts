import { x402Client, x402HTTPClient } from '@x402/core/client';
import type { PaymentRequirements } from '@x402/core/types';
import {
  CallrackApiError,
  CallrackNetworkError,
  CallrackPaymentError,
  CallrackPaymentRequiredError,
  CallrackTimeoutError,
  CallrackValidationError,
  type PaymentRequirementSummary,
} from './errors.js';
import type { ApiErrorResponse, ApiSuccessResponse } from './types.js';

// Covers the ENTIRE 402 -> sign -> paid-retry cycle as one client-observed
// call (see `request()` below - a single AbortController spans both the
// unpaid probe and the paid retry that @x402/fetch's wrapFetchWithPayment
// drives internally), not just one HTTP round trip. Composite capabilities
// (/v1/compare, /v1/evidence, /v1/verify, /v1/research) fan out to multiple
// external providers in parallel and wait for the slowest - academic
// search alone can take up to ~20s cold (OpenAlex's own 10s timeout,
// falling back to Crossref's own 10s timeout - see
// apps/api/src/providers/common/provider-http-client.ts). 30s left too
// little headroom on a slow-but-successful call. This alone does NOT fix
// the separate, more serious "txn dead" settlement failure these same
// capabilities can hit when the handler runs long enough to outlive the
// signed payment transaction's own validity window - that's a real gap
// between "handler took too long" and "payment settled too late," not a
// client-side timeout, and needs its own fix.
const DEFAULT_TIMEOUT_MS = 60_000;

export interface CallrackHttpClientOptions {
  readonly baseUrl: string;
  /** The fetch implementation to use - a plain fetch for discovery, or an X402PaymentClient's payment-aware fetch for paid capability calls. */
  readonly fetchImpl: typeof fetch;
  readonly timeoutMs?: number;
  /**
   * True when `fetchImpl` is payment-aware (an `X402PaymentClient.fetch`).
   * Changes how a final `402` is classified: without a signer it genuinely
   * means "this endpoint is paid and nothing tried to pay for it yet"; with
   * one, `X402PaymentClient` already attempted a real payment and the
   * server still rejected the retried request - a payment failure, not a
   * missing-signer situation.
   */
  readonly hasSigner?: boolean;
}

function toRequirementSummary(requirement: PaymentRequirements): PaymentRequirementSummary {
  return {
    scheme: requirement.scheme,
    network: requirement.network,
    asset: requirement.asset,
    amount: requirement.amount,
    payTo: requirement.payTo,
  };
}

/**
 * Framework-independent JSON HTTP client for the Callrack API. Handles
 * timeouts, network failures, malformed responses, and the API's error
 * envelope - classifying everything into the SDK's own error taxonomy
 * rather than leaking raw fetch/Response objects.
 *
 * A bare (unsigned) `x402HTTPClient` is used only to reuse the official 402
 * body/header parsing when a request comes back unpaid and there is no
 * payment-aware fetch in front of it (see `CallrackClient.call` without a
 * configured signer) - never to create or sign a payment itself.
 */
export class CallrackHttpClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly hasSigner: boolean;
  private readonly parser = new x402HTTPClient(new x402Client());

  constructor(options: CallrackHttpClientOptions) {
    this.baseUrl = options.baseUrl;
    this.fetchImpl = options.fetchImpl;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.hasSigner = options.hasSigner ?? false;
  }

  resolveUrl(path: string): string {
    return new URL(path, this.baseUrl).toString();
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<ApiSuccessResponse<T>> {
    const url = this.resolveUrl(path);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(url, { ...init, signal: controller.signal });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new CallrackTimeoutError(`Request to ${path} timed out after ${this.timeoutMs}ms`, this.timeoutMs);
      }
      throw new CallrackNetworkError(`Network error calling ${path}: ${error instanceof Error ? error.message : String(error)}`, {
        cause: error,
      });
    } finally {
      clearTimeout(timer);
    }

    const requestId = response.headers.get('x-request-id') ?? undefined;

    let body: unknown;
    try {
      const text = await response.text();
      body = text ? JSON.parse(text) : undefined;
    } catch (error) {
      throw new CallrackValidationError(`Malformed JSON response from ${path}`, { requestId, cause: error });
    }

    if (response.status === 402) {
      const paymentRequired = this.parser.getPaymentRequiredResponse((name) => response.headers.get(name), body);

      if (this.hasSigner) {
        // A signer was configured, so X402PaymentClient already attempted a
        // real payment before this request ever reached here - a 402 at
        // this point means the server rejected it (e.g. the payTo address
        // isn't opted in to the asset, insufficient funds, facilitator
        // settlement failure), not that nothing tried to pay.
        const reason = paymentRequired.error ? `: ${paymentRequired.error}` : '';
        throw new CallrackPaymentError(`Payment for ${path} was rejected by the server${reason}`, { requestId });
      }

      throw new CallrackPaymentRequiredError(
        `${path} requires payment and this client has no signer configured - see CallrackClient's \`signer\` option`,
        {
          requestId,
          resource: paymentRequired.resource.url,
          accepts: paymentRequired.accepts.map(toRequirementSummary),
        },
      );
    }

    if (!response.ok) {
      const errorBody = body as Partial<ApiErrorResponse> | undefined;
      throw new CallrackApiError(errorBody?.error?.message ?? `Request to ${path} failed with status ${response.status}`, {
        status: response.status,
        code: errorBody?.error?.code,
        details: errorBody?.error?.details,
        requestId: errorBody?.meta?.requestId ?? requestId,
      });
    }

    const success = body as Partial<ApiSuccessResponse<T>> | undefined;
    if (!success || typeof success !== 'object' || !('data' in success) || !('meta' in success)) {
      throw new CallrackValidationError(`Unexpected response shape from ${path}`, { requestId });
    }

    return success as ApiSuccessResponse<T>;
  }
}
