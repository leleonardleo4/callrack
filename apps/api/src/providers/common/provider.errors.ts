export const ProviderErrorCode = {
  PROVIDER_TIMEOUT: 'PROVIDER_TIMEOUT',
  PROVIDER_RATE_LIMITED: 'PROVIDER_RATE_LIMITED',
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
  PROVIDER_AUTHENTICATION_FAILED: 'PROVIDER_AUTHENTICATION_FAILED',
  PROVIDER_BAD_RESPONSE: 'PROVIDER_BAD_RESPONSE',
  PROVIDER_INVALID_REQUEST: 'PROVIDER_INVALID_REQUEST',
  PROVIDER_UNKNOWN_ERROR: 'PROVIDER_UNKNOWN_ERROR',
} as const;

export type ProviderErrorCode = (typeof ProviderErrorCode)[keyof typeof ProviderErrorCode];

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly providerSlug: string;
  readonly retryAfterMs?: number;
  override readonly cause?: unknown;

  constructor(params: {
    code: ProviderErrorCode;
    message: string;
    providerSlug: string;
    cause?: unknown;
    retryAfterMs?: number;
  }) {
    super(params.message);
    this.name = 'ProviderError';
    this.code = params.code;
    this.providerSlug = params.providerSlug;
    this.retryAfterMs = params.retryAfterMs;
    this.cause = params.cause;
  }
}

/**
 * Maps an upstream HTTP status code to a normalized Callrack provider error code.
 * Callers still decide the message/providerSlug/retryAfterMs.
 */
export function mapHttpStatusToProviderErrorCode(status: number): ProviderErrorCode {
  if (status === 401 || status === 403) {
    return ProviderErrorCode.PROVIDER_AUTHENTICATION_FAILED;
  }
  if (status === 408) {
    return ProviderErrorCode.PROVIDER_TIMEOUT;
  }
  if (status === 429) {
    return ProviderErrorCode.PROVIDER_RATE_LIMITED;
  }
  if (status === 502 || status === 503 || status === 504) {
    return ProviderErrorCode.PROVIDER_UNAVAILABLE;
  }
  if (status >= 500) {
    return ProviderErrorCode.PROVIDER_UNAVAILABLE;
  }
  if (status >= 400) {
    return ProviderErrorCode.PROVIDER_INVALID_REQUEST;
  }
  return ProviderErrorCode.PROVIDER_UNKNOWN_ERROR;
}

/** Only a bounded, well-understood set of provider errors are safe to retry. */
export function isRetryableProviderError(error: ProviderError): boolean {
  if (error.code === ProviderErrorCode.PROVIDER_TIMEOUT) {
    return true;
  }
  if (error.code === ProviderErrorCode.PROVIDER_UNAVAILABLE) {
    return true;
  }
  if (error.code === ProviderErrorCode.PROVIDER_RATE_LIMITED) {
    return error.retryAfterMs !== undefined;
  }
  return false;
}
