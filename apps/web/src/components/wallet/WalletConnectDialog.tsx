import { useRef, useState } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import { Loader2, Wallet as WalletIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from 'cn';

export interface WalletConnectDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/** Purely informational — never treated as a failure. A real QR/deep-link approval (Pera, Defly, WalletConnect) can legitimately take longer than this. */
const SLOW_CONNECT_HINT_MS = 8000;

/**
 * Lists every wallet configured in `wallet/manager.ts` with its own real
 * name and icon from the use-wallet adapter's `metadata` (never a
 * hand-drawn logo). Connecting is a single call to that wallet's own
 * `connect()` — no separate connection stack per wallet, and no mnemonic or
 * private-key entry anywhere in this dialog.
 *
 * An error is only ever shown for a `connect()` call that actually rejects
 * — never inferred from elapsed time. A wallet taking a while to respond
 * (the user hasn't scanned a QR code yet, is unlocking an extension, etc.)
 * is not evidence it's unavailable; showing an error in that case would be
 * a false positive the moment the same `connect()` call goes on to succeed.
 */
export function WalletConnectDialog({ open, onOpenChange }: WalletConnectDialogProps): React.JSX.Element {
  const { wallets } = useWallet();
  const [connectingId, setConnectingId] = useState<string | undefined>(undefined);
  const [slowId, setSlowId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<{ walletId: string; message: string } | undefined>(undefined);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  async function handleConnect(walletId: string, connect: () => Promise<unknown>): Promise<void> {
    setError(undefined);
    setSlowId(undefined);
    setConnectingId(walletId);
    slowTimerRef.current = setTimeout(() => setSlowId(walletId), SLOW_CONNECT_HINT_MS);
    try {
      // No artificial timeout here — only a real rejection from the wallet
      // itself (or a real resolution) ends this wait.
      await connect();
      onOpenChange(false);
    } catch (cause) {
      setError({
        walletId,
        message: cause instanceof Error ? cause.message : 'This wallet could not be connected.',
      });
    } finally {
      clearTimeout(slowTimerRef.current);
      setConnectingId(undefined);
      setSlowId(undefined);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect a wallet</DialogTitle>
          <DialogDescription>
            Callrack never asks for a mnemonic or private key. Choose a wallet to approve real x402 payments from.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          {wallets.length === 0 ? (
            <p className="text-sm text-ash">No wallet providers are configured.</p>
          ) : (
            wallets.map((wallet) => {
              const isConnecting = connectingId === wallet.walletKey;
              return (
                <div key={wallet.walletKey} className="flex flex-col gap-1">
                  <button
                    type="button"
                    disabled={connectingId !== undefined}
                    onClick={() => handleConnect(wallet.walletKey, wallet.connect)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border border-inkline px-3 py-2.5 text-left transition-colors',
                      'hover:border-mist hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-60',
                    )}
                  >
                    {wallet.metadata.icon ? (
                      <img src={wallet.metadata.icon} alt="" aria-hidden className="size-7 shrink-0 rounded-md" />
                    ) : (
                      <WalletIcon className="size-7 shrink-0 text-ash" aria-hidden />
                    )}
                    <span className="flex-1 text-sm font-medium text-quartz">{wallet.metadata.name}</span>
                    {isConnecting ? <Loader2 className="size-4 shrink-0 animate-spin text-ash" aria-hidden /> : null}
                  </button>
                  {error?.walletId === wallet.walletKey ? (
                    <p className="px-1 text-xs text-destructive">{error.message}</p>
                  ) : slowId === wallet.walletKey ? (
                    <p className="px-1 text-xs text-ash">
                      Still waiting for {wallet.metadata.name} — approve the request there (check your phone for a
                      QR/approval prompt if applicable), or confirm the extension is installed and unlocked.
                    </p>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
