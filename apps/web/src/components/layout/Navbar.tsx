import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
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

export function Navbar(): React.JSX.Element {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-inkline bg-abyss/90 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-(--page-max-width) items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 font-heading text-base font-medium text-quartz">
          <span className="flex size-7 items-center justify-center rounded-md bg-cobalt-panel text-sm text-frosted-lilac">
            C
          </span>
          Callrack
        </Link>

        <NavLinks className="hidden items-center gap-8 md:flex" />

        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="outline" size="sm">
            <Link to="/docs">Read the docs</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/capabilities">Explore capabilities</Link>
          </Button>
        </div>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
              <Menu className="size-5" aria-hidden />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="p-0">
            <SheetHeader className="border-b border-inkline">
              <SheetTitle>Callrack</SheetTitle>
            </SheetHeader>
            <NavLinks onNavigate={() => setMobileOpen(false)} className="flex flex-col gap-5 p-4" />
            <div className="mt-auto flex flex-col gap-2 border-t border-inkline p-4">
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
    </header>
  );
}
