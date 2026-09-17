import { describe, expect, it, vi } from 'vitest';
import { CallrackClient } from '../src/client.js';
import { CallrackValidationError } from '../src/errors.js';
import { CAPABILITIES_DATA } from './fixtures/capabilities.js';
import { jsonResponse } from './fixtures/http.js';

describe('CallrackClient', () => {
  it('defaults to http://localhost:3000 and testnet', () => {
    const client = new CallrackClient();
    expect(client.baseUrl).toBe('http://localhost:3000');
    expect(client.network.network).toBe('testnet');
  });

  it('accepts a custom baseUrl for local dev or another deployment, never hardcoding one', () => {
    const client = new CallrackClient({ baseUrl: 'https://api.callrack.xyz' });
    expect(client.baseUrl).toBe('https://api.callrack.xyz');
  });

  it('lists capabilities from the live discovery endpoint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(200, { data: CAPABILITIES_DATA, meta: { requestId: 'req_1' } })),
    );
    const client = new CallrackClient({ baseUrl: 'http://localhost:3000' });
    const capabilities = await client.listCapabilities();
    expect(capabilities.map((capability) => capability.id)).toEqual(['academic.search', 'news.search']);
    vi.unstubAllGlobals();
  });

  it('caches the capability list until forceRefresh is requested', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { data: CAPABILITIES_DATA, meta: { requestId: 'req_1' } }));
    vi.stubGlobal('fetch', fetchImpl);
    const client = new CallrackClient({ baseUrl: 'http://localhost:3000' });

    await client.listCapabilities();
    await client.listCapabilities();
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    await client.listCapabilities({ forceRefresh: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });

  it('throws CallrackValidationError for an unknown capability id', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(200, { data: CAPABILITIES_DATA, meta: { requestId: 'req_1' } })),
    );
    const client = new CallrackClient({ baseUrl: 'http://localhost:3000' });
    await expect(client.getCapability('not.a.real.capability')).rejects.toBeInstanceOf(CallrackValidationError);
    vi.unstubAllGlobals();
  });

  it('call() posts to the capability path and returns typed data/meta', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith('/v1/capabilities')) {
        return jsonResponse(200, { data: CAPABILITIES_DATA, meta: { requestId: 'req_1' } });
      }
      return jsonResponse(200, { data: { results: [] }, meta: { requestId: 'req_2' } });
    });
    vi.stubGlobal('fetch', fetchImpl);

    const client = new CallrackClient({ baseUrl: 'http://localhost:3000' });
    const result = await client.call('news.search', { query: 'renewable energy' });
    expect(result.data).toEqual({ results: [] });
    expect(result.meta.requestId).toBe('req_2');
    vi.unstubAllGlobals();
  });
});
