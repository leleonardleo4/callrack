import { Seo } from '@/components/Seo';
import { Section, Eyebrow } from '@/components/layout/Section';
import { CapabilityExplorer } from '@/components/capabilities/CapabilityExplorer';
import { CapabilityGridSkeleton } from '@/components/capabilities/CapabilityCardSkeleton';
import { ApiErrorState } from '@/components/ApiErrorState';
import { useCapabilities } from '@/hooks/useCapabilities';

export function CapabilitiesPage(): React.JSX.Element {
  const state = useCapabilities();

  return (
    <>
      <Seo
        title="Capabilities"
        description="Browse every Callrack capability: academic, news, market, weather, geocoding, knowledge, government, and research, with live pricing and request schemas."
        path="/capabilities"
      />
      <Section>
        <Eyebrow>Capability explorer</Eyebrow>
        <h1 className="mt-3 font-heading text-3xl font-medium text-quartz md:text-4xl">
          Every capability, live from the registry
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ash">
          Names, descriptions, prices, and request schemas below come directly from{' '}
          <code className="font-mono text-frosted-lilac">GET /v1/capabilities</code>, the same source x402's
          Bazaar discovery metadata uses, never a hand-maintained copy.
        </p>

        <div className="mt-10">
          {state.status === 'loading' ? <CapabilityGridSkeleton count={9} /> : null}
          {state.status === 'error' ? <ApiErrorState message={state.message} /> : null}
          {state.status === 'success' ? <CapabilityExplorer capabilities={state.data.capabilities} /> : null}
        </div>
      </Section>
    </>
  );
}
