import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { WalletConnectButton } from '@/components/wallet/WalletConnectButton';
import { cn } from 'cn';

const NAV_LINKS = [
  { to: '/capabilities', label: 'Capabilities' },
  { to: '/docs', label: 'Docs' },
  { to: '/playground', label: 'Playground' },
] as const;

function NavLinks({ onNavigate, className }: { onNavigate?: () => void; className?: string }): React.JSX.Element {
  return (
    <nav className={className}>
      {NAV_LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'text-sm font-normal transition-colors hover:text-quartz',
              isActive ? 'text-quartz' : 'text-ash',
            )
          }
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}

/** Past this scroll offset (px), the header gains a background - matches the scannable "has the user left the hero" threshold, not a precise design token. */
const SCROLL_THRESHOLD = 8;

function useScrolled(threshold: number): boolean {
  const [scrolled, setScrolled] = useState(() => (typeof window === 'undefined' ? false : window.scrollY > threshold));

  useEffect(() => {
    function handleScroll(): void {
      setScrolled(window.scrollY > threshold);
    }
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [threshold]);

  return scrolled;
}

export function Navbar(): React.JSX.Element {
  const [mobileOpen, setMobileOpen] = useState(false);
  const scrolled = useScrolled(SCROLL_THRESHOLD);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 h-(--navbar-height) border-b transition-colors duration-300',
        scrolled ? 'border-inkline bg-abyss/90 backdrop-blur-sm' : 'border-transparent bg-transparent',
      )}
    >
      <div className="mx-auto flex h-full max-w-(--page-max-width) items-center justify-between px-4 sm:px-6">
        <Link to="/" aria-label="Callrack home" className="flex items-center">
          <Logo className="h-6 w-auto text-foreground" />
        </Link>

        <NavLinks className="hidden items-center gap-8 md:flex" />

        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          <WalletConnectButton />
          <Button asChild variant="outline" size="sm">
            <Link to="/docs">Read the docs</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/capabilities">Explore capabilities</Link>
          </Button>
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="size-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="p-0">
              <SheetHeader className="border-b border-inkline">
                <SheetTitle>
                  <Logo className="h-5 w-auto text-foreground" />
                </SheetTitle>
              </SheetHeader>
              <NavLinks onNavigate={() => setMobileOpen(false)} className="flex flex-col gap-5 p-4" />
              <div className="mt-auto flex flex-col gap-2 border-t border-inkline p-4">
                <WalletConnectButton />
                <Button asChild variant="outline" onClick={() => setMobileOpen(false)}>
                  <Link to="/docs">Read the docs</Link>
                </Button>
                <Button asChild onClick={() => setMobileOpen(false)}>
                  <Link to="/capabilities">Explore capabilities</Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
