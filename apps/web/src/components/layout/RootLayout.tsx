import { Outlet } from 'react-router-dom';
import { WalletProvider } from '@txnlab/use-wallet-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { walletManager } from '@/wallet/manager';

export function RootLayout(): React.JSX.Element {
  return (
    <WalletProvider manager={walletManager}>
      <ThemeProvider>
        <TooltipProvider>
          <div className="flex min-h-screen flex-col bg-background text-foreground">
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-cobalt-panel focus:px-3 focus:py-2 focus:text-sm focus:text-quartz"
            >
              Skip to content
            </a>
            <Navbar />
            <main id="main-content" className="flex-1">
              <Outlet />
            </main>
            <Footer />
          </div>
        </TooltipProvider>
      </ThemeProvider>
    </WalletProvider>
  );
}
