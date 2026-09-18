/**
 * The only place a Callrack API origin is read from configuration. Never
 * hardcode `https://api.callrack.xyz` (or any other origin) anywhere else in
 * this app: see `.env.example`. Defaults to the local API dev server so
 * `pnpm dev` works without a manual `.env` copy.
 */
export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') ?? 'http://localhost:3000';

/**
 * WalletConnect Cloud project id. Optional — see `.env.example`. When unset,
 * the wallet manager simply does not offer WalletConnect as an option; Pera,
 * Defly, Lute, and Exodus all work without it via their own native adapters.
 */
export const WALLETCONNECT_PROJECT_ID: string = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? '';
