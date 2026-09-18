/**
 * Some wallet SDKs (browser-extension ones especially, e.g. Lute) never
 * reject `connect()` when the extension simply isn't installed — they just
 * wait indefinitely for a response nothing will ever send. Real QR/deep-link
 * approval (Pera, Defly, WalletConnect) can legitimately take a while, so
 * the default here is deliberately generous rather than a fast cutoff.
 */
export const DEFAULT_CONNECT_TIMEOUT_MS = 20_000;

export class ConnectTimeoutError extends Error {}

export function withConnectTimeout<T>(promise: Promise<T>, timeoutMs: number = DEFAULT_CONNECT_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new ConnectTimeoutError('Timed out waiting for a response.')), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
