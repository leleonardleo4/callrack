import { WalletManager, type WalletAdapterConfig } from '@txnlab/use-wallet-react';
import { defly } from '@txnlab/use-wallet-defly';
import { exodus } from '@txnlab/use-wallet-exodus';
import { lute } from '@txnlab/use-wallet-lute';
import { pera } from '@txnlab/use-wallet-pera';
import { walletConnect } from '@txnlab/use-wallet-walletconnect';
import { NETWORK, WALLETCONNECT_PROJECT_ID } from '@/config/env';
import { toUseWalletNetworkId } from '@/wallet/network';

/**
 * The one place the Playground's supported wallets are configured. Each
 * factory here is a separate, official `@txnlab/use-wallet-*` adapter
 * package (v5's per-wallet architecture - there is no bundled "Defly Web"
 * shim from older use-wallet versions). Pera, Defly, and Lute work with no
 * further setup; Exodus is included as one additional, stable, mainstream
 * Algorand-capable wallet (straightforward ARC-API browser provider, no
 * extra config). WalletConnect is only added when a project id is
 * configured, since connecting without one would fail at connect time.
 */
function buildWallets(): WalletAdapterConfig[] {
  const wallets: WalletAdapterConfig[] = [pera(), defly(), lute(), exodus()];
  if (WALLETCONNECT_PROJECT_ID) {
    wallets.push(
      walletConnect({
        projectId: WALLETCONNECT_PROJECT_ID,
        metadata: {
          name: 'Callrack',
          description: 'Pay-per-use information infrastructure for software and AI agents.',
          url: typeof window !== 'undefined' ? window.location.origin : 'https://callrack.dev',
          icons: [],
        },
      }),
    );
  }
  return wallets;
}

/**
 * A single, module-level `WalletManager` instance - constructed once,
 * reused for the lifetime of the app (not per-render, not per-route). Its
 * constructor and `resumeSessions()` (called by `WalletProvider` on mount)
 * only touch `localStorage`; no adapter's underlying wallet SDK is
 * constructed until a wallet is actually connected (each adapter builds its
 * client lazily), so mounting this everywhere - including in tests - never
 * makes a real network/QR/deep-link connection by itself.
 *
 * `defaultNetwork` comes from `config/env.ts`'s `NETWORK` (the
 * `VITE_NETWORK` build-time env var) - the operator sets this to whichever
 * network the deployed API (`API_BASE_URL`) actually runs, the same way
 * `API_BASE_URL` itself is configured; never a runtime toggle and never
 * inferred from the live `GET /v1/capabilities` response. This manager's
 * `activeNetwork` is never the source of truth for what a payment actually
 * settles on; that's always the live x402 challenge (see
 * `wallet/payment-signer.ts`).
 */
export const walletManager = new WalletManager({
  wallets: buildWallets(),
  defaultNetwork: toUseWalletNetworkId(NETWORK),
});
