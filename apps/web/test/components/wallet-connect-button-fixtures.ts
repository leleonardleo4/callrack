import { vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';

export const disconnect = vi.fn();
export const setActiveAccount = vi.fn();
export const connect = vi.fn();

export function connectedMockState(
  accounts: { name: string; address: string }[] = [{ name: 'Account 1', address: 'TTCZHJ24VWV64DMFCXKHS2GMLFVUTBA673THZR7LNYY3GEB3XV7HNUEQXQ' }],
): Record<string, unknown> {
  return {
    wallets: [
      { id: 'pera', walletKey: 'pera', metadata: { name: 'Pera', icon: '' }, connect, disconnect, setActive: vi.fn(), setActiveAccount },
    ],
    activeWallet: { metadata: { name: 'Pera' }, disconnect, setActiveAccount },
    activeAccount: accounts[0],
    activeWalletAccounts: accounts,
    activeAddress: accounts[0]!.address,
  };
}

/**
 * Opens the connected-wallet dropdown menu. Deliberately keyboard-driven
 * (ArrowDown, per Radix's own `DropdownMenuTrigger` keydown handler) rather
 * than a pointer click: a pointer-driven open goes through jsdom's Popper
 * positioning path and, empirically, never resolves in this environment.
 * `fireEvent` (unlike `userEvent`) applies the event and flushes React
 * synchronously, so the resulting real, fully interactive `role="menu"` is
 * queryable immediately afterward.
 *
 * Each test that calls this lives in its own file (see
 * WalletConnectButton.disconnect/.switchAccount/.switchWallet.test.tsx):
 * empirically, jsdom's Popper positioning cost compounds sharply with each
 * additional open *within the same test file* (a single open take ~4s;
 * a second in the same file took over 20s) - never an issue in a real
 * browser, and avoided entirely by giving each interaction Vitest's default
 * per-file isolation (a fresh jsdom instance) instead of fighting it with
 * ever-larger timeouts.
 */
export function openMenu(triggerName: RegExp): void {
  const trigger = screen.getByRole('button', { name: triggerName });
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  screen.getByRole('menu');
}
