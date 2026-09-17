import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Info } from 'lucide-react';
import { Seo } from '@/components/Seo';
import { Section } from '@/components/layout/Section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PriceTag } from '@/components/PriceTag';
import { CodeBlock } from '@/components/CodeBlock';
import { SchemaFieldsTable } from '@/components/SchemaFieldsTable';
import { ApiErrorState } from '@/components/ApiErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { useCapabilities } from '@/hooks/useCapabilities';
import { formatCategory, formatProvider } from '@/lib/format';

export function CapabilityDetailPage(): React.JSX.Element {
  const { capability: capabilityId } = useParams<{ capability: string }>();
  const state = useCapabilities();

  if (state.status === 'loading') {
    return (
      <Section>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-4 h-10 w-96 max-w-full" />
        <Skeleton className="mt-6 h-24 w-full" />
      </Section>
    );
  }

  if (state.status === 'error') {
    return (
      <Section>
        <ApiErrorState message={state.message} />
      </Section>
    );
  }

  const capability = state.data.capabilities.find((c) => c.id === capabilityId);

  if (!capability) {
    return (
      <Section className="text-center">
        <h1 className="font-heading text-2xl font-medium text-quartz">Capability not found</h1>
        <p className="mt-3 text-sm text-ash">
          &ldquo;{capabilityId}&rdquo; isn&apos;t a registered Callrack capability.
        </p>
        <Button asChild className="mt-6">
          <Link to="/capabilities">
            <ArrowLeft className="size-4" aria-hidden /> Back to capabilities
          </Link>
        </Button>
      </Section>
    );
  }

  return (
    <>
      <Seo
        title={capability.name}
        description={capability.description}
        path={`/capabilities/${capability.id}`}
      />
      <Section>
        <Link to="/capabilities" className="inline-flex items-center gap-1 text-sm text-ash hover:text-quartz">
          <ArrowLeft className="size-3.5" aria-hidden /> All capabilities
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-3xl font-medium tracking-tight text-quartz">{capability.name}</h1>
              <Badge variant="outline">{formatCategory(capability.category)}</Badge>
              <Badge>{capability.provider.kind === 'composite' ? 'Composition' : 'Atomic'}</Badge>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mist">{capability.description}</p>
          </div>
          <PriceTag amount={capability.price.amount} className="text-lg" />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-ash">
          <span className="font-mono text-quartz">
            {capability.method} {capability.path}
          </span>
          <span>Source: {formatProvider(capability.provider)}</span>
        </div>

        <Alert className="mt-8">
          <Info className="size-4" aria-hidden />
          <AlertTitle>This endpoint requires x402 payment.</AlertTitle>
          <AlertDescription>
            An unpaid request returns <code className="font-mono">402 Payment Required</code> with the exact
            price, network, and payment destination in the <code className="font-mono">PAYMENT-REQUIRED</code>{' '}
            header. Pay the advertised amount and retry with payment proof to receive the real response — see{' '}
            <Link to="/docs" className="underline underline-offset-2 hover:text-quartz">
              the docs
            </Link>
            , or try it in the{' '}
            <Link to="/playground" className="underline underline-offset-2 hover:text-quartz">
              playground
            </Link>
            .
          </AlertDescription>
        </Alert>

        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div>
            <h2 className="font-heading text-lg font-medium text-quartz">Request schema</h2>
            <div className="mt-3">
              <SchemaFieldsTable
                properties={capability.requestSchema.properties}
                required={capability.requestSchema.required}
              />
            </div>
          </div>
          <div>
            <h2 className="font-heading text-lg font-medium text-quartz">Example request</h2>
            <div className="mt-3">
              <CodeBlock label="request.json" code={JSON.stringify(capability.example.request, null, 2)} />
            </div>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="font-heading text-lg font-medium text-quartz">Example response</h2>
          <p className="mt-1 text-xs text-ash">The shape returned once payment is verified.</p>
          <div className="mt-3">
            <CodeBlock label="response.json" code={JSON.stringify(capability.example.response, null, 2)} />
          </div>
        </div>

        <div className="mt-10 flex justify-end">
          <Button asChild variant="accent">
            <Link to={`/playground?capability=${capability.id}`}>
              Try it in the playground <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </Section>
    </>
  );
}
