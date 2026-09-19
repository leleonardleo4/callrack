import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WalletConnectDialog } from '@/components/wallet/WalletConnectDialog';

let mockWallets: { walletKey: string; metadata: { name: string; icon: string }; connect: () => Promise<unknown> }[] = [];

vi.mock('@txnlab/use-wallet-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@txnlab/use-wallet-react')>();
  return { ...actual, useWallet: () => ({ wallets: mockWallets }) };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('WalletConnectDialog', () => {
  it('lists Pera, Defly, Lute, and WalletConnect with their real adapter-provided names', () => {
    mockWallets = [
      { walletKey: 'pera', metadata: { name: 'Pera', icon: 'data:image/svg+xml;base64,AA==' }, connect: vi.fn() },
      { walletKey: 'defly', metadata: { name: 'Defly', icon: 'data:image/svg+xml;base64,AA==' }, connect: vi.fn() },
      { walletKey: 'lute', metadata: { name: 'Lute', icon: 'data:image/svg+xml;base64,AA==' }, connect: vi.fn() },
      { walletKey: 'walletconnect', metadata: { name: 'WalletConnect', icon: 'data:image/svg+xml;base64,AA==' }, connect: vi.fn() },
    ];
    render(<WalletConnectDialog open onOpenChange={vi.fn()} />);

    const dialog = screen.getByRole('dialog');
    for (const name of ['Pera', 'Defly', 'Lute', 'WalletConnect']) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    // Never a hand-drawn/fake logo - every row renders the adapter's own
    // icon as a real <img>. Decorative (alt="", aria-hidden) images are
    // intentionally excluded from the accessibility tree, so this queries
    // by tag rather than role.
    const icons = dialog.querySelectorAll('img');
    expect(icons).toHaveLength(4);
    for (const icon of icons) {
      expect(icon.getAttribute('src')).toContain('data:image/svg+xml;base64,');
    }
  });

  it('never renders a mnemonic or private-key input anywhere in the dialog', () => {
    mockWallets = [{ walletKey: 'pera', metadata: { name: 'Pera', icon: '' }, connect: vi.fn() }];
    render(<WalletConnectDialog open onOpenChange={vi.fn()} />);

    expect(screen.queryByLabelText(/mnemonic/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/private key/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/mnemonic|private key|seed phrase/i)).not.toBeInTheDocument();
  });

  it('connects the chosen wallet and closes the dialog on success', async () => {
    const connect = vi.fn().mockResolvedValue([{ name: 'Account 1', address: 'TTCZHJ24VWV64DMFCXKHS2GMLFVUTBA673THZR7LNYY3GEB3XV7HNUEQXQ' }]);
    mockWallets = [{ walletKey: 'pera', metadata: { name: 'Pera', icon: '' }, connect }];
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<WalletConnectDialog open onOpenChange={onOpenChange} />);

    await user.click(screen.getByText('Pera'));

    expect(connect).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('shows a real error message inline, without closing, when the wallet is unavailable', async () => {
    const connect = vi.fn().mockRejectedValue(new Error('Lute is not available in this browser.'));
    mockWallets = [{ walletKey: 'lute', metadata: { name: 'Lute', icon: '' }, connect }];
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<WalletConnectDialog open onOpenChange={onOpenChange} />);

    await user.click(screen.getByText('Lute'));

    expect(await screen.findByText('Lute is not available in this browser.')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it(
    'never shows an error for a connect() that is simply slow and later succeeds - only a real rejection is an error',
    async () => {
      // Regression coverage for a reported bug: a QR/deep-link wallet
      // (Pera/Defly/WalletConnect) taking longer than an arbitrary elapsed
      // time is not evidence it failed - a prior version of this dialog
      // showed a "wallet not available" error purely because a timer
      // fired, even while the same `connect()` call went on to succeed
      // moments later. An error here must only ever come from `connect()`
      // itself actually rejecting.
      vi.useFakeTimers({ shouldAdvanceTime: true });
      let resolveConnect!: (accounts: unknown) => void;
      const connect = vi.fn(
        () =>
          new Promise((resolve) => {
            resolveConnect = resolve;
          }),
      );
      mockWallets = [{ walletKey: 'pera', metadata: { name: 'Pera', icon: '' }, connect }];
      const onOpenChange = vi.fn();
      render(<WalletConnectDialog open onOpenChange={onOpenChange} />);

      await act(async () => {
        screen.getByText('Pera').closest('button')!.click();
      });

      // Advance well past the "still waiting" hint threshold - still no error.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_000);
      });
      expect(screen.queryByText(/not available|could not be connected/i)).not.toBeInTheDocument();
      expect(screen.getByText(/still waiting for pera/i)).toBeInTheDocument();

      // The wallet finally responds - this must still succeed cleanly.
      await act(async () => {
        resolveConnect([{ name: 'Account 1', address: 'TTCZHJ24VWV64DMFCXKHS2GMLFVUTBA673THZR7LNYY3GEB3XV7HNUEQXQ' }]);
      });
      await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
      expect(screen.queryByText(/not available|could not be connected/i)).not.toBeInTheDocument();
      vi.useRealTimers();
    },
  );

  it('shows an error only when connect() actually rejects, never from elapsed time alone', async () => {
    const connect = vi.fn().mockRejectedValue(new Error('User rejected the request.'));
    mockWallets = [{ walletKey: 'lute', metadata: { name: 'Lute', icon: '' }, connect }];
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<WalletConnectDialog open onOpenChange={onOpenChange} />);

    await user.click(screen.getByText('Lute'));

    expect(await screen.findByText('User rejected the request.')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
