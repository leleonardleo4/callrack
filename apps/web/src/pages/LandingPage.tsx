import { Link } from 'react-router-dom';
import { ArrowRight, Bot, Coins, Repeat, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Section, Eyebrow } from '@/components/layout/Section';
import { CapabilityCard } from '@/components/capabilities/CapabilityCard';
import { CapabilityGridSkeleton } from '@/components/capabilities/CapabilityCardSkeleton';
import { ApiErrorState } from '@/components/ApiErrorState';
import { PriceTag } from '@/components/PriceTag';
import { Seo } from '@/components/Seo';
import { useCapabilities } from '@/hooks/useCapabilities';
import type { PublicCapability } from '@/types/capability';

const HOW_IT_WORKS_STEPS = [
  { title: 'Discover a capability', description: 'Read the request/response shape from /v1/capabilities, .well-known/x402, or the docs.' },
  { title: 'Call the API', description: 'POST the request body — no API key, no account, no signup.' },
  { title: 'Receive HTTP 402', description: 'The response carries the exact price, network, and payment destination for this call.' },
  { title: 'Pay with x402 on Algorand', description: 'Settle the advertised USDC amount through the x402 protocol.' },
  { title: 'Retry and receive the data', description: 'Retry the same request with payment proof — the real response comes back.' },
] as const;

const AGENT_FLOW_CAPABILITY_IDS = ['academic.search', 'news.search', 'knowledge.search'] as const;

export function LandingPage(): React.JSX.Element {
  const capabilitiesState = useCapabilities();

  return (
    <>
      <Seo
        title="Pay-per-use information infrastructure"
        description="Callrack lets software and AI agents call academic, news, market, weather, geocoding, and knowledge capabilities — paying only per request in USDC over x402 on Algorand."
        path="/"
      />
      <Hero />
      <HowItWorks />
      <LiveCapabilities state={capabilitiesState} />
      <WhyPayPerUse />
      <AgentUseCase state={capabilitiesState} />
      <X402Explainer />
      <DeveloperCta />
    </>
  );
}

function Hero(): React.JSX.Element {
  return (
    <div className="relative overflow-hidden border-b border-inkline">
      <div className="aurora-glow pointer-events-none absolute inset-0" aria-hidden />
      <Section className="relative py-20 md:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow className="justify-center">Pay-per-use information infrastructure</Eyebrow>
          <h1 className="mt-4 font-heading text-4xl font-medium tracking-tight text-quartz md:text-6xl">
            Call information. <br className="hidden md:block" />
            Pay only when you use it.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-ash md:text-lg">
            Callrack gives software and AI agents a single, callable surface over academic, news, market,
            weather, geocoding, and knowledge data — no accounts, no API keys, no subscriptions. Every call
            settles per request in USDC over x402 on Algorand.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link to="/capabilities">
                Explore capabilities <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/docs">Read the docs</Link>
            </Button>
          </div>
        </div>
      </Section>
    </div>
  );
}

function HowItWorks(): React.JSX.Element {
  return (
    <Section>
      <div className="mx-auto max-w-2xl text-center">
        <Eyebrow className="justify-center">How it works</Eyebrow>
        <h2 className="mt-3 font-heading text-3xl font-medium tracking-tight text-quartz md:text-4xl">
          Every capability speaks the same protocol
        </h2>
      </div>
      <ol className="mx-auto mt-12 flex max-w-3xl flex-col gap-0">
        {HOW_IT_WORKS_STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-obsidian-edge bg-deep-sea font-mono text-xs text-frosted-lilac">
                {index + 1}
              </span>
              {index < HOW_IT_WORKS_STEPS.length - 1 ? <span className="my-1 w-px flex-1 bg-obsidian-edge" aria-hidden /> : null}
            </div>
            <div className="pb-8">
              <p className="font-heading text-base font-medium text-quartz">{step.title}</p>
              <p className="mt-1 text-sm text-mist">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function LiveCapabilities({ state }: { state: ReturnType<typeof useCapabilities> }): React.JSX.Element {
  const featured = state.status === 'success' ? state.data.capabilities.slice(0, 6) : [];

  return (
    <Section className="border-t border-inkline">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Eyebrow>Live capabilities</Eyebrow>
          <h2 className="mt-3 font-heading text-3xl font-medium tracking-tight text-quartz md:text-4xl">
            Real, callable today
          </h2>
        </div>
        <Button asChild variant="outline" size="sm" className="self-start sm:self-auto">
          <Link to="/capabilities">
            View all capabilities <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </div>

      <div className="mt-10">
        {state.status === 'loading' ? <CapabilityGridSkeleton count={6} /> : null}
        {state.status === 'error' ? <ApiErrorState message={state.message} /> : null}
        {state.status === 'success' ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {featured.map((capability) => (
              <CapabilityCard key={capability.id} capability={capability} />
            ))}
          </div>
        ) : null}
      </div>
    </Section>
  );
}

function WhyPayPerUse(): React.JSX.Element {
  return (
    <Section className="border-t border-inkline">
      <div className="mx-auto max-w-2xl text-center">
        <Eyebrow className="justify-center">Why pay-per-use</Eyebrow>
        <h2 className="mt-3 font-heading text-3xl font-medium tracking-tight text-quartz md:text-4xl">
          Pay for information, not access
        </h2>
      </div>
      <div className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-obsidian-edge bg-deep-sea p-6">
          <p className="font-heading text-lg font-medium text-quartz">Subscriptions</p>
          <p className="mt-2 text-sm leading-relaxed text-mist">
            Fixed monthly cost regardless of usage. Pay whether you make one call or ten thousand. Unused
            capacity is sunk cost — a poor fit for an agent that calls a capability occasionally, or only for a
            single task.
          </p>
        </div>
        <div className="rounded-lg border border-sapphire-hairline bg-cobalt-panel p-6">
          <p className="font-heading text-lg font-medium text-quartz">Pay exactly when needed</p>
          <p className="mt-2 text-sm leading-relaxed text-mist">
            Each request settles its own price at the moment it's made. An agent that calls a capability once a
            month costs the same per call as one that calls it every minute — no idle subscription, no
            provisioning ahead of usage.
          </p>
        </div>
      </div>
    </Section>
  );
}

function AgentUseCase({ state }: { state: ReturnType<typeof useCapabilities> }): React.JSX.Element {
  const byId = new Map<string, PublicCapability>(
    state.status === 'success' ? state.data.capabilities.map((c) => [c.id, c]) : [],
  );

  return (
    <Section className="border-t border-inkline">
      <div className="mx-auto max-w-2xl text-center">
        <Eyebrow className="justify-center">Built for agents</Eyebrow>
        <h2 className="mt-3 font-heading text-3xl font-medium tracking-tight text-quartz md:text-4xl">
          The intended agent workflow
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-ash">
          This is the workflow Callrack's capabilities are designed around — an agent composing several
          capabilities to answer one question, paying only for what it actually calls. The agent client itself
          is a later phase; today, any HTTP-capable agent can already call these endpoints directly.
        </p>
      </div>

      <div className="mx-auto mt-12 flex max-w-3xl flex-col items-stretch gap-3">
        <FlowNode icon={<Bot className="size-4" aria-hidden />} label="Agent" description="Receives a task, e.g. a research question." />
        {AGENT_FLOW_CAPABILITY_IDS.map((id) => {
          const capability = byId.get(id);
          return (
            <FlowStep
              key={id}
              label={capability?.name ?? id}
              price={capability?.price.amount}
              loading={state.status === 'loading'}
            />
          );
        })}
        <FlowNode icon={<Zap className="size-4" aria-hidden />} label="Final answer" description="Composed from every capability's response." />
      </div>
    </Section>
  );
}

function FlowNode({ icon, label, description }: { icon: React.ReactNode; label: string; description: string }): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-obsidian-edge bg-deep-sea px-5 py-4">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-cobalt-panel text-frosted-lilac">
        {icon}
      </span>
      <div>
        <p className="font-heading text-sm font-medium text-quartz">{label}</p>
        <p className="text-xs text-ash">{description}</p>
      </div>
    </div>
  );
}

function FlowStep({ label, price, loading }: { label: string; price: string | undefined; loading: boolean }): React.JSX.Element {
  return (
    <div className="ml-4 flex items-center gap-3 border-l-2 border-obsidian-edge py-1 pl-5">
      <Repeat className="size-3.5 shrink-0 text-ash" aria-hidden />
      <div className="flex flex-1 items-center justify-between gap-3">
        <p className="text-sm text-mist">{label}</p>
        {loading ? (
          <span className="h-4 w-14 animate-pulse rounded bg-inkline" aria-hidden />
        ) : price ? (
          <PriceTag amount={price} />
        ) : null}
      </div>
    </div>
  );
}

function X402Explainer(): React.JSX.Element {
  return (
    <Section className="border-t border-inkline">
      <div className="mx-auto max-w-2xl text-center">
        <Eyebrow className="justify-center">The payment layer</Eyebrow>
        <h2 className="mt-3 font-heading text-3xl font-medium tracking-tight text-quartz md:text-4xl">
          x402 and Algorand, briefly
        </h2>
      </div>
      <div className="mx-auto mt-10 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2">
        <ExplainerCard
          icon={<Coins className="size-5" aria-hidden />}
          title="HTTP 402"
          body="A standard HTTP status code, 'Payment Required', reserved since the web's early days and never widely used — until now."
        />
        <ExplainerCard
          icon={<Zap className="size-5" aria-hidden />}
          title="x402"
          body="An open protocol that turns a 402 response into a concrete, machine-readable payment requirement a client can act on automatically."
        />
        <ExplainerCard
          icon={<Bot className="size-5" aria-hidden />}
          title="Algorand"
          body="The blockchain Callrack settles payments on — fast, low-fee finality, well suited to many small, per-request payments."
        />
        <ExplainerCard
          icon={<Coins className="size-5" aria-hidden />}
          title="USDC"
          body="Every price on Callrack is denominated in USDC, a dollar-pegged stablecoin — prices are predictable, not exposed to crypto volatility."
        />
      </div>
    </Section>
  );
}

function ExplainerCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }): React.JSX.Element {
  return (
    <div className="rounded-lg border border-obsidian-edge bg-deep-sea p-6">
      <span className="flex size-9 items-center justify-center rounded-md bg-cobalt-panel text-frosted-lilac">{icon}</span>
      <p className="mt-4 font-heading text-base font-medium text-quartz">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-mist">{body}</p>
    </div>
  );
}

function DeveloperCta(): React.JSX.Element {
  return (
    <Section className="border-t border-inkline text-center">
      <h2 className="font-heading text-3xl font-medium tracking-tight text-quartz md:text-4xl">
        Start calling capabilities
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-ash">
        Browse what's available, read how payment works, or try a real request in the playground.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link to="/capabilities">Capabilities</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/docs">Docs</Link>
        </Button>
        <Button asChild variant="accent">
          <Link to="/playground">Try the playground</Link>
        </Button>
      </div>
    </Section>
  );
}
