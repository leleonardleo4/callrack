import { describe, expect, it } from 'vitest';
import { ConnectTimeoutError, withConnectTimeout } from '@/wallet/connect-timeout';

describe('withConnectTimeout', () => {
  it('resolves with the underlying value when it settles before the timeout', async () => {
    const result = await withConnectTimeout(Promise.resolve('connected'), 50);
    expect(result).toBe('connected');
  });

  it('rejects with the underlying error when it rejects before the timeout', async () => {
    await expect(withConnectTimeout(Promise.reject(new Error('user rejected')), 50)).rejects.toThrow('user rejected');
  });

  it('rejects with ConnectTimeoutError when the promise never settles within the timeout', async () => {
    const neverSettles = new Promise(() => {});
    await expect(withConnectTimeout(neverSettles, 20)).rejects.toBeInstanceOf(ConnectTimeoutError);
  });
});
