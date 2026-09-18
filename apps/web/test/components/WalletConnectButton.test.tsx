import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WalletConnectButton } from '@/components/wallet/WalletConnectButton';
import { connect, connectedMockState, disconnect, setActiveAccount } from './wallet-connect-button-fixtures';

let mockState: Record<string, unknown> = {};

vi.mock('@txnlab/use-wallet-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@txnlab/use-wallet-react')>();
  return { ...actual, useWallet: () => mockState };
});

function setDisconnected(): void {
  mockState = {
    wallets: [
      { id: 'pera', walletKey: 'pera', metadata: { name: 'Pera', icon: '' }, connect, disconnect, setActive: vi.fn(), setActiveAccount },
    ],
    activeWallet: null,
    activeAccount: null,
    activeWalletAccounts: null,
    activeAddress: null,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('WalletConnectButton', () => {
  it('shows "Connect Wallet" when disconnected', () => {
    setDisconnected();
    render(<WalletConnectButton />);
    expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument();
  });

  it('opens the wallet picker dialog listing configured wallets when disconnected', async () => {
    setDisconnected();
    const user = userEvent.setup();
    render(<WalletConnectButton />);

    await user.click(screen.getByRole('button', { name: /connect wallet/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Pera')).toBeInTheDocument();
  });

  it('shows "Wallet" and the shortened active address once connected', () => {
    mockState = connectedMockState();
    render(<WalletConnectButton />);
    const trigger = screen.getByRole('button', { name: /wallet/i });
    expect(trigger).toHaveTextContent('TTCZ');
    expect(screen.queryByRole('button', { name: /connect wallet/i })).not.toBeInTheDocument();
  });
});
