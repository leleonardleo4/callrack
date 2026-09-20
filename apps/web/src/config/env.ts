import type { CallrackNetwork } from '@callrack/sdk';

/**
 * The only place a Callrack API origin is read from configuration. Never
 * hardcode `https://api.callrack.xyz` (or any other origin) anywhere else in
 * this app: see `.env.example`. Defaults to the local API dev server so
 * `pnpm dev` works without a manual `.env` copy.
 */
export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') ?? 'http://localhost:3000';

/**
 * Which network the wallet connect flow (`wallet/manager.ts`) defaults to -
 * a plain build-time env var, the same pattern as `API_BASE_URL` above, not
 * a runtime toggle and never derived from the live API response. Must be
 * kept in sync with whatever network `API_BASE_URL` actually points at
 * (the API's own `NETWORK` env var) - see `.env.example`.
 */
export const NETWORK: CallrackNetwork = import.meta.env.VITE_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';

/**
 * WalletConnect Cloud project id. Optional - see `.env.example`. When unset,
 * the wallet manager simply does not offer WalletConnect as an option; Pera,
 * Defly, Lute, and Exodus all work without it via their own native adapters.
 */
export const WALLETCONNECT_PROJECT_ID: string = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? '';
