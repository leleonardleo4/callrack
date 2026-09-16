import { mapHttpStatusToProviderErrorCode, ProviderError, ProviderErrorCode } from './provider.errors.js';
import { parseRetryAfterMs, withRetry, type RetryPolicy } from './provider-retry.js';

export interface ProviderHttpClientOptions {
  providerSlug: string;
  baseUrl: string;
  /** Request timeout in ms. Default: 10000. */
  timeoutMs?: number;
  headers?: Record<string, string>;
  retry?: RetryPolicy;
}

export interface ProviderAdapterOptions {
  timeoutMs?: number;
  retry?: RetryPolicy;
}

export type ProviderQueryValue = string | number | boolean | undefined;

export interface ProviderRequestOptions {
  path: string;
  method?: 'GET' | 'POST';
  query?: Record<string, ProviderQueryValue>;
  headers?: Record<string, string>;
  body?: unknown;
}

const DEFAULT_TIMEOUT_MS = 10_000;

function buildUrl(baseUrl: string, path: string, query?: Record<string, ProviderQueryValue>): string {
  const url = new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

/**
 * Shared HTTP foundation for provider adapters: explicit timeout/abort,
 * JSON parsing, status validation, and bounded retries. Adapters must not
 * reimplement this logic themselves.
 */
export class ProviderHttpClient {
  constructor(private readonly options: ProviderHttpClientOptions) {}

  async requestJson<T>(request: ProviderRequestOptions): Promise<T> {
    return withRetry(() => this.performRequest<T>(request), this.options.retry);
  }

  private async performRequest<T>(request: ProviderRequestOptions): Promise<T> {
    const { providerSlug } = this.options;
    const url = buildUrl(this.options.baseUrl, request.path, request.query);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, {
        method: request.method ?? 'GET',
        headers: {
          accept: 'application/json',
          ...this.options.headers,
          ...request.headers,
        },
        body: request.body !== undefined ? JSON.stringify(request.body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ProviderError({
          code: ProviderErrorCode.PROVIDER_TIMEOUT,
          message: `${providerSlug} request timed out after ${this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS}ms`,
          providerSlug,
          cause: error,
        });
      }
      throw new ProviderError({
        code: ProviderErrorCode.PROVIDER_UNAVAILABLE,
        message: `Network error contacting ${providerSlug}: ${(error as Error).message}`,
        providerSlug,
        cause: error,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
      throw new ProviderError({
        code: mapHttpStatusToProviderErrorCode(response.status),
        message: `${providerSlug} responded with HTTP ${response.status}`,
        providerSlug,
        retryAfterMs,
      });
    }

    try {
      return (await response.json()) as T;
    } catch (error) {
      throw new ProviderError({
        code: ProviderErrorCode.PROVIDER_BAD_RESPONSE,
        message: `${providerSlug} returned a response that could not be parsed as JSON`,
        providerSlug,
        cause: error,
      });
    }
  }
}
