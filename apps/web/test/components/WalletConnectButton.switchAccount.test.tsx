import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { WalletConnectButton } from '@/components/wallet/WalletConnectButton';
import { connectedMockState, openMenu, setActiveAccount } from './wallet-connect-button-fixtures';

let mockState: Record<string, unknown> = {};

vi.mock('@txnlab/use-wallet-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@txnlab/use-wallet-react')>();
  return { ...actual, useWallet: () => mockState };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('WalletConnectButton', () => {
  it('lists every connected account and lets the user switch the active one', () => {
    mockState = connectedMockState([
      { name: 'Account 1', address: 'TTCZHJ24VWV64DMFCXKHS2GMLFVUTBA673THZR7LNYY3GEB3XV7HNUEQXQ' },
      { name: 'Account 2', address: 'V4BOVWHAQJUNZAPU4D7B4N2ALHVMHBRJ2F75EJG5E5XS5JFJZGAU4SS2UA' },
    ]);
    render(<WalletConnectButton />);

    openMenu(/wallet/i);
    const secondAccountItem = screen.getByRole('menuitem', { name: /V4BOV/i });
    fireEvent.click(secondAccountItem);

    expect(setActiveAccount).toHaveBeenCalledWith('V4BOVWHAQJUNZAPU4D7B4N2ALHVMHBRJ2F75EJG5E5XS5JFJZGAU4SS2UA');
  });
});
