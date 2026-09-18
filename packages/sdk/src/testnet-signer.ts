import { seedFromMnemonic } from '@algorandfoundation/algokit-utils/algo25';
import { ed25519Generator } from '@algorandfoundation/algokit-utils/crypto';
import { toClientAvmSigner } from '@x402/avm';
import type { CallrackPaymentSigner } from './signer.js';

/**
 * Derives a CallrackPaymentSigner from a 25-word Algorand mnemonic.
 *
 * THIS IS A REFERENCE / DEVELOPMENT UTILITY, ISOLATED IN ITS OWN MODULE ON
 * PURPOSE - for local Testnet end-to-end testing only (see `AVM_MNEMONIC`
 * in .env.example). Nothing in the core SDK (CallrackClient,
 * X402PaymentClient, CallrackAgent) imports this file; a consumer must
 * explicitly opt in by calling it and handing the result to
 * `CallrackClient` as `signer`. This is Node-only (uses `Buffer`) and must
 * never run in a browser bundle.
 *
 * `@x402/avm`'s `toClientAvmSigner` takes a Base64-encoded 64-byte key
 * (32-byte seed + 32-byte public key), not a mnemonic directly - Algorand's
 * mnemonic-to-key derivation lives in algokit-utils (`seedFromMnemonic`),
 * which validates the checksum and word list, throwing on anything
 * malformed rather than silently deriving a wrong address.
 *
 * Security:
 * - Never commit a real mnemonic (`AVM_MNEMONIC` must stay out of version
 *   control - see the repo's `.gitignore` / `.env.example` convention).
 * - Never log the mnemonic, the derived seed, or the signer's key material.
 * - Never send it to a frontend/browser context.
 * - Never use a Mainnet-funded mnemonic in automated CI (see
 *   test/testnet-smoke.ts, which only runs when explicitly invoked).
 */
export function testnetSignerFromMnemonic(mnemonic: string): CallrackPaymentSigner {
  const seed = seedFromMnemonic(mnemonic);
  const { ed25519Pubkey } = ed25519Generator(seed);
  const secretKey = new Uint8Array(64);
  secretKey.set(seed, 0);
  secretKey.set(ed25519Pubkey, 32);
  const privateKeyBase64 = Buffer.from(secretKey).toString('base64');
  return toClientAvmSigner(privateKeyBase64);
}

function defaultEnv(): Record<string, string | undefined> {
  return typeof process !== 'undefined' && process.env ? process.env : {};
}

/**
 * Reads `AVM_MNEMONIC` from the given environment (defaults to
 * `process.env`, when available) and derives a signer from it. Returns
 * `undefined` - never throws - when unset, since this is always an
 * optional local/dev convenience, never a required SDK input.
 */
export function testnetSignerFromEnv(
  env: Record<string, string | undefined> = defaultEnv(),
): CallrackPaymentSigner | undefined {
  const mnemonic = env.AVM_MNEMONIC;
  if (!mnemonic || mnemonic.trim().length === 0) return undefined;
  return testnetSignerFromMnemonic(mnemonic.trim());
}
