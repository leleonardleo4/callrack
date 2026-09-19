import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useWalletPaymentFlow } from '@/hooks/useWalletPaymentFlow';
import { callCapability } from '@/lib/api-client';
import { callCapabilityWithWallet } from '@/lib/wallet-api-client';
import { WEATHER_CAPABILITY } from '../fixtures/capabilities';
import type { WalletPaymentContext } from '@/wallet/useWalletSigner';

vi.mock('@/lib/api-client', () => ({ callCapability: vi.fn() }));
vi.mock('@/lib/wallet-api-client', () => ({ callCapabilityWithWallet: vi.fn() }));

const FAKE_WALLET = {} as WalletPaymentContext;

const PAYMENT_REQUIRED_RESULT = {
  kind: 'payment-required',
  status: 402,
  paymentRequired: { x402Version: 2, resource: { url: 'http://localhost/v1/weather' }, accepts: [] },
  requestId: 'req_1',
} as const;

describe('useWalletPaymentFlow', () => {
  it('lets "Try again" actually retry after a resolved (non-thrown) failure', async () => {
    vi.mocked(callCapability).mockResolvedValue(PAYMENT_REQUIRED_RESULT as never);
    vi.mocked(callCapabilityWithWallet)
      .mockResolvedValueOnce({
        kind: 'api-error',
        status: 500,
        error: { code: 'BOOM', message: 'first attempt' },
        requestId: 'req_2',
      } as never)
      .mockResolvedValueOnce({ kind: 'success', status: 200, data: {}, requestId: 'req_3' } as never);

    const { result } = renderHook(() => useWalletPaymentFlow());

    await act(async () => {
      await result.current.start(WEATHER_CAPABILITY, { latitude: 1, longitude: 1 });
    });
    expect(result.current.state.status).toBe('payment-required');

    await act(async () => {
      await result.current.approveAndPay(FAKE_WALLET);
    });
    expect(result.current.state.status).toBe('failed');
    expect(callCapabilityWithWallet).toHaveBeenCalledTimes(1);

    // This is the actual reported bug: clicking "Try again" in the UI calls
    // approveAndPay a second time. Before the fix, the first failure had
    // already cleared pendingRef, so this second call bailed out at
    // `if (!pending) return;` with no visible effect at all.
    await act(async () => {
      await result.current.approveAndPay(FAKE_WALLET);
    });
    expect(callCapabilityWithWallet).toHaveBeenCalledTimes(2);
    expect(result.current.state.status).toBe('completed');
  });
});
