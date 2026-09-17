import { vi } from 'vitest';

export function mockFetchOnce(response: Response): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response));
}

/**
 * Stubs `fetch` to always resolve to an equivalent response, cloning it per
 * call: a `Response` body can only be read once, and this app fetches
 * capabilities again on every page mount, so reusing one instance across
 * calls fails the second `.json()` read.
 */
export function mockFetchAlways(response: Response): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(() => Promise.resolve(response.clone())),
  );
}

export function jsonResponse(body: unknown, init: ResponseInit & { requestId?: string } = {}): Response {
  const { requestId, headers, ...rest } = init;
  const finalHeaders = new Headers(headers);
  finalHeaders.set('content-type', 'application/json');
  if (requestId) finalHeaders.set('x-request-id', requestId);
  return new Response(JSON.stringify(body), { status: 200, ...rest, headers: finalHeaders });
}
