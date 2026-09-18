import { describe, expect, it, vi } from 'vitest';
import { createWalletPaymentSigner } from '@/wallet/payment-signer';

describe('createWalletPaymentSigner', () => {
  it('forwards the connected address unchanged', () => {
    const signer = createWalletPaymentSigner({ address: 'FAKEADDR', signTransactions: vi.fn() });
    expect(signer.address).toBe('FAKEADDR');
  });

  it('delegates signTransactions to the wallet, forwarding args and returning its result unchanged', async () => {
    const txns = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])];
    const signed = [new Uint8Array([9, 9, 9]), null];
    const signTransactions = vi.fn().mockResolvedValue(signed);
    const signer = createWalletPaymentSigner({ address: 'FAKEADDR', signTransactions });

    const result = await signer.signTransactions(txns, [0]);

    expect(signTransactions).toHaveBeenCalledWith(txns, [0]);
    expect(result).toBe(signed);
  });

  it('calls signTransactions with indexesToSign omitted when not given', async () => {
    const signTransactions = vi.fn().mockResolvedValue([new Uint8Array([1])]);
    const signer = createWalletPaymentSigner({ address: 'FAKEADDR', signTransactions });

    await signer.signTransactions([new Uint8Array([1])]);

    expect(signTransactions).toHaveBeenCalledWith([new Uint8Array([1])], undefined);
  });

  it('propagates a wallet rejection without catching or reinterpreting it', async () => {
    const rejection = new Error('Transaction request was rejected by the user.');
    const signTransactions = vi.fn().mockRejectedValue(rejection);
    const signer = createWalletPaymentSigner({ address: 'FAKEADDR', signTransactions });

    await expect(signer.signTransactions([new Uint8Array([1])])).rejects.toBe(rejection);
  });
});
