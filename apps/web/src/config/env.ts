/**
 * The only place a Callrack API origin is read from configuration. Never
 * hardcode `https://api.callrack.xyz` (or any other origin) anywhere else in
 * this app: see `.env.example`. Defaults to the local API dev server so
 * `pnpm dev` works without a manual `.env` copy.
 */
export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') ?? 'http://localhost:3000';
