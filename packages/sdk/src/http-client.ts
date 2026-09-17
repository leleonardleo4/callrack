import { x402Client, x402HTTPClient } from '@x402/core/client';
import type { PaymentRequirements } from '@x402/core/types';
import {
  CallrackApiError,
  CallrackNetworkError,
  CallrackPaymentRequiredError,
  CallrackTimeoutError,
  CallrackValidationError,
  type PaymentRequirementSummary,
} from './errors.js';
import type { ApiErrorResponse, ApiSuccessResponse } from './types.js';

const DEFAULT_TIMEOUT_MS = 30_000;

export interface CallrackHttpClientOptions {
  readonly baseUrl: string;
  /** The fetch implementation to use — a plain fetch for discovery, or an X402PaymentClient's payment-aware fetch for paid capability calls. */
  readonly fetchImpl: typeof fetch;
  readonly timeoutMs?: number;
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
 * envelope — classifying everything into the SDK's own error taxonomy
 * rather than leaking raw fetch/Response objects.
 *
 * A bare (unsigned) `x402HTTPClient` is used only to reuse the official 402
 * body/header parsing when a request comes back unpaid and there is no
 * payment-aware fetch in front of it (see `CallrackClient.call` without a
 * configured signer) — never to create or sign a payment itself.
 */
export class CallrackHttpClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly parser = new x402HTTPClient(new x402Client());

  constructor(options: CallrackHttpClientOptions) {
    this.baseUrl = options.baseUrl;
    this.fetchImpl = options.fetchImpl;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
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
      throw new CallrackPaymentRequiredError(
        `${path} requires payment and this client has no signer configured — see CallrackClient's \`signer\` option`,
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
