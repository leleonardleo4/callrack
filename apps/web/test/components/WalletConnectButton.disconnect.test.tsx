import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { WalletConnectButton } from '@/components/wallet/WalletConnectButton';
import { connectedMockState, disconnect, openMenu } from './wallet-connect-button-fixtures';

let mockState: Record<string, unknown> = {};

vi.mock('@txnlab/use-wallet-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@txnlab/use-wallet-react')>();
  return { ...actual, useWallet: () => mockState };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('WalletConnectButton', () => {
  it('disconnects the active wallet from the menu', () => {
    mockState = connectedMockState();
    render(<WalletConnectButton />);

    openMenu(/wallet/i);
    fireEvent.click(screen.getByRole('menuitem', { name: /disconnect/i }));

    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
