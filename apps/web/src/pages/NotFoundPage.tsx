import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Section } from '@/components/layout/Section';
import { Seo } from '@/components/Seo';

export function NotFoundPage(): React.JSX.Element {
  return (
    <>
      <Seo title="Page not found" description="This page doesn't exist on Callrack." path="/404" />
      <Section className="text-center">
        <p className="font-mono text-sm text-ash">404</p>
        <h1 className="mt-2 font-heading text-3xl font-medium text-quartz">Page not found</h1>
        <p className="mt-3 text-sm text-ash">This page doesn&apos;t exist.</p>
        <Button asChild className="mt-6">
          <Link to="/">Back to home</Link>
        </Button>
      </Section>
    </>
  );
}
