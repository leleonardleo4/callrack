import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { WalletConnectButton } from '@/components/wallet/WalletConnectButton';
import { connectedMockState, openMenu } from './wallet-connect-button-fixtures';

let mockState: Record<string, unknown> = {};

vi.mock('@txnlab/use-wallet-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@txnlab/use-wallet-react')>();
  return { ...actual, useWallet: () => mockState };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('WalletConnectButton', () => {
  // Confirms the "Switch wallet" item wires to the same dialog-open state
  // the disconnected "Connect Wallet" button uses (see WalletConnectDialog's
  // own dedicated tests for the picker's full rendering/connect behavior -
  // re-asserting that here would mount a second Radix Popper-positioned
  // primitive in the same jsdom instance as the already-open dropdown,
  // which compounds jsdom's layout cost far beyond either alone).
  it('closes the connected-wallet menu when "Switch wallet" is selected', () => {
    mockState = connectedMockState();
    render(<WalletConnectButton />);

    openMenu(/wallet/i);
    fireEvent.click(screen.getByRole('menuitem', { name: /switch wallet/i }));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
