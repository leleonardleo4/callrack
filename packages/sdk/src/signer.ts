import type { ClientAvmSigner } from '@x402/avm';

/**
 * The Callrack SDK's payment signer abstraction. This is intentionally the
 * exact same shape as @x402/avm's `ClientAvmSigner` — an address plus a
 * `signTransactions` method — rather than a parallel interface the caller
 * would need to adapt to. Any object with that shape works: the reference
 * testnet signer (src/testnet-signer.ts), a hand-rolled server-side agent
 * wallet, a secure-enclave signer, or (later, out of this phase's scope) a
 * browser wallet adapter. The SDK never constructs or holds key material
 * itself — it only calls `signTransactions` on whatever signer it's given.
 */
export type CallrackPaymentSigner = ClientAvmSigner;
