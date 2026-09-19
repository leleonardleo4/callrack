import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Section } from '@/components/layout/Section';
import { Seo } from '@/components/Seo';

/**
 * The router's top-level `errorElement` (see router.tsx) - catches any
 * uncaught render error or loader/action failure anywhere under
 * `RootLayout`, including RootLayout itself, so this must never depend on
 * WalletProvider/ThemeProvider/TooltipProvider context: whichever one may
 * have thrown never finished mounting. Design tokens (bg-background,
 * text-quartz, etc.) still resolve correctly without them - index.html's
 * blocking inline script sets the `dark` class on <html> before React ever
 * runs, so the CSS custom properties they read are already in place.
 */
export function ErrorPage(): React.JSX.Element {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : undefined;

  if (import.meta.env.DEV) {
    console.error(error);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Seo
        title="Something went wrong"
        description="An unexpected error interrupted this page on Callrack."
        path="/error"
      />
      <main className="flex flex-1 items-center">
        <Section className="text-center">
          <p className="font-mono text-sm text-ash">{status ?? 'ERROR'}</p>
          <h1 className="mt-2 font-heading text-3xl font-medium text-quartz">Something went wrong</h1>
          <p className="mt-3 text-sm text-ash">
            An unexpected error interrupted this page. Reloading usually fixes it.
          </p>
          <Button className="mt-6" onClick={() => window.location.assign('/')}>
            Back to home
          </Button>
        </Section>
      </main>
    </div>
  );
}
