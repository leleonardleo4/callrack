import { vi } from 'vitest';

export function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  const lowerHeaders = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) => lowerHeaders[name.toLowerCase()] ?? null,
    },
    json: async () => body,
  } as unknown as Response;
}

export function malformedJsonResponse(status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => {
      throw new SyntaxError('Unexpected token in JSON');
    },
  } as unknown as Response;
}

export function stubFetchOnce(response: Response): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValueOnce(response);
  vi.stubGlobal('fetch', fn);
  return fn;
}

export function stubFetchSequence(responses: Response[]): ReturnType<typeof vi.fn> {
  const fn = vi.fn();
  for (const response of responses) {
    fn.mockResolvedValueOnce(response);
  }
  vi.stubGlobal('fetch', fn);
  return fn;
}

export function stubFetchNetworkError(message = 'network error'): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockRejectedValueOnce(new Error(message));
  vi.stubGlobal('fetch', fn);
  return fn;
}

/** Simulates a request that never resolves until its AbortSignal fires. */
export function stubFetchAbort(): ReturnType<typeof vi.fn> {
  const fn = vi.fn((_url: string, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        reject(error);
      });
    });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

/**
 * Simulates an immediate client-side timeout without waiting for a real
 * AbortController timer to fire — useful for capability-level e2e tests
 * where the provider's configured timeout (10s) would otherwise make the
 * test unacceptably slow.
 */
export function stubFetchImmediateAbort(): ReturnType<typeof vi.fn> {
  const fn = vi.fn(() => {
    const error = new Error('The operation was aborted');
    error.name = 'AbortError';
    return Promise.reject(error);
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

/** Resolves every call (regardless of count) with the same response — for retry/fallback-heavy scenarios. */
export function stubFetchAlways(response: Response): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fn);
  return fn;
}
