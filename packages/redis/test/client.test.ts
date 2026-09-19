import { describe, expect, it } from 'vitest';
import { createRedisClient } from '../src/client.js';

describe('createRedisClient', () => {
  it('applies no key prefix by default (unchanged behavior for existing callers)', () => {
    const client = createRedisClient('redis://localhost:6379');
    expect(client.options.keyPrefix).toBe(''); // ioredis's own default when none is set
    client.disconnect();
  });

  it('applies the given keyPrefix to the underlying ioredis client', () => {
    const client = createRedisClient('redis://localhost:6379', { keyPrefix: 'callrack:' });
    expect(client.options.keyPrefix).toBe('callrack:');
    client.disconnect();
  });

  it('treats an empty-string keyPrefix the same as omitting it entirely', () => {
    const client = createRedisClient('redis://localhost:6379', { keyPrefix: '' });
    expect(client.options.keyPrefix).toBe('');
    client.disconnect();
  });

  it('still forwards TLS SNI servername for a rediss:// URL alongside a keyPrefix', () => {
    const client = createRedisClient('rediss://user:pass@shared-cache.internal:6380', {
      keyPrefix: 'callrack:',
    });
    expect(client.options.keyPrefix).toBe('callrack:');
    expect((client.options.tls as { servername?: string } | undefined)?.servername).toBe(
      'shared-cache.internal',
    );
    client.disconnect();
  });
});
