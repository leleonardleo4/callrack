import { useState } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import { Check, ChevronDown, LogOut, Wallet as WalletIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { WalletConnectDialog } from '@/components/wallet/WalletConnectDialog';
import { shortenAddress } from '@/lib/wallet-format';

/**
 * The Playground's one wallet control, shown in the header/toolbar per the
 * feature's UI requirement: "Connect Wallet" when disconnected, "Wallet
 * <shortened address>" with switch-wallet/switch-account/disconnect once
 * connected. Reused wherever it's mounted - nothing here is Playground- or
 * capability-specific.
 */
export function WalletConnectButton(): React.JSX.Element {
  const { activeWallet, activeAccount, activeWalletAccounts } = useWallet();
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!activeWallet || !activeAccount) {
    return (
      <>
        <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
          <WalletIcon className="size-4" aria-hidden /> Connect Wallet
        </Button>
        <WalletConnectDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </>
    );
  }

  const accounts = activeWalletAccounts ?? [];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <WalletIcon className="size-4" aria-hidden />
            <span className="flex flex-col items-start leading-tight">
              <span className="text-[0.65rem] text-ash">Wallet</span>
              <span className="font-mono">{shortenAddress(activeAccount.address)}</span>
            </span>
            <ChevronDown className="size-3.5 text-ash" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{activeWallet.metadata.name}</DropdownMenuLabel>
          {accounts.length > 1 ? (
            <>
              <DropdownMenuSeparator />
              {accounts.map((account) => (
                <DropdownMenuItem
                  key={account.address}
                  onSelect={() => activeWallet.setActiveAccount(account.address)}
                >
                  <span className="flex-1 truncate font-mono text-xs">{shortenAddress(account.address, 6, 8)}</span>
                  {account.address === activeAccount.address ? <Check className="size-3.5" aria-hidden /> : null}
                </DropdownMenuItem>
              ))}
            </>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setDialogOpen(true)}>Switch wallet</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => activeWallet.disconnect()}>
            <LogOut className="size-4" aria-hidden /> Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <WalletConnectDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
