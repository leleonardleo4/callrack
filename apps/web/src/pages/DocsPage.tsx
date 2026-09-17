import { Link } from 'react-router-dom';
import { Seo } from '@/components/Seo';
import { CodeBlock } from '@/components/CodeBlock';
import { PriceTag } from '@/components/PriceTag';
import { ApiErrorState } from '@/components/ApiErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { useCapabilities } from '@/hooks/useCapabilities';
import { formatNetworkLabel } from '@/lib/format';
import { API_BASE_URL } from '@/config/env';

const SECTIONS = [
  { id: 'getting-started', label: 'Getting started' },
  { id: 'api-reference', label: 'API reference' },
  { id: 'payment', label: 'Authentication & payment' },
  { id: 'errors', label: 'Errors' },
  { id: 'networks', label: 'Networks' },
  { id: 'usdc', label: 'USDC pricing' },
  { id: 'agents', label: 'Agent developer experience' },
  { id: 'sdk', label: 'Client libraries' },
] as const;

const ERROR_ROWS = [
  { status: '400', code: 'VALIDATION_ERROR / BAD_REQUEST', description: 'The request body failed validation — see error.details.errors for the specific fields.' },
  { status: '402', code: '(no error code — see the PAYMENT-REQUIRED header)', description: 'Payment is required. The body is empty; price, network, and payTo are in the PAYMENT-REQUIRED header.' },
  { status: '404', code: 'NOT_FOUND', description: 'The route does not exist.' },
  { status: '429', code: 'TOO_MANY_REQUESTS / PROVIDER_RATE_LIMITED', description: 'Callrack or an upstream provider is rate-limiting requests. Back off and retry.' },
  { status: '502', code: 'PROVIDER_UNAVAILABLE', description: 'The upstream data provider is unavailable.' },
  { status: '504', code: 'PROVIDER_TIMEOUT', description: 'The upstream data provider timed out.' },
  { status: '500', code: 'INTERNAL_SERVER_ERROR', description: 'An unexpected server error. The response never includes a stack trace in production.' },
] as const;

export function DocsPage(): React.JSX.Element {
  const state = useCapabilities();

  return (
    <>
      <Seo
        title="Documentation"
        description="How to call Callrack capabilities: discovery, the x402 payment flow, error handling, networks, USDC pricing, and the intended agent workflow."
        path="/docs"
      />
      <div className="mx-auto flex max-w-(--page-max-width) flex-col gap-10 px-4 py-16 sm:px-6 lg:flex-row lg:gap-16">
        <nav aria-label="Docs sections" className="lg:sticky lg:top-20 lg:h-fit lg:w-52 lg:shrink-0">
          <p className="text-xs font-medium tracking-wide text-ash uppercase">On this page</p>
          <ul className="mt-3 flex flex-col gap-2 border-l border-inkline pl-4">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="text-sm text-mist hover:text-quartz">
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
          <a
            href="/openapi.json"
            target="_blank"
            rel="noreferrer"
            className="mt-6 block text-sm text-frosted-lilac hover:underline"
          >
            OpenAPI spec ↗
          </a>
        </nav>

        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-4xl font-medium tracking-tight text-quartz">Documentation</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ash">
            Callrack has no accounts and no API keys. Every request either succeeds, fails validation, or comes
            back with <code className="font-mono">402 Payment Required</code> — the price for that exact call.
          </p>

          <GettingStarted />
          <ApiReference state={state} />
          <PaymentSection state={state} />
          <ErrorsSection />
          <NetworksSection state={state} />
          <UsdcSection />
          <AgentsSection />
          <SdkSection />
        </div>
      </div>
    </>
  );
}

function DocSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section id={id} className="mt-14 scroll-mt-20 border-t border-inkline pt-10 first:mt-10 first:border-t-0 first:pt-0">
      <h2 className="font-heading text-2xl font-medium tracking-tight text-quartz">{title}</h2>
      <div className="mt-4 flex flex-col gap-4 text-sm leading-relaxed text-mist">{children}</div>
    </section>
  );
}

function GettingStarted(): React.JSX.Element {
  return (
    <DocSection id="getting-started" title="Getting started">
      <ol className="list-decimal space-y-2 pl-5">
        <li>Discover a capability — browse /capabilities, or fetch it directly from GET /v1/capabilities.</li>
        <li>Make a request — POST the request body Callrack documents for that capability.</li>
        <li>Receive 402 if unpaid — the response carries the exact price, network, and payTo address.</li>
        <li>Pay using x402 — settle that amount in USDC on the advertised Algorand network.</li>
        <li>Retry the request with payment proof — the same request, now with a payment signature.</li>
        <li>Receive the data — the normal, paid response for that capability.</li>
      </ol>
      <CodeBlock
        label="example — unpaid request"
        code={`curl -X POST ${API_BASE_URL}/v1/weather \\\n  -H "Content-Type: application/json" \\\n  -d '{"latitude": 6.5244, "longitude": 3.3792}'\n\n# → 402 Payment Required\n# → PAYMENT-REQUIRED header carries price, network, and payTo`}
      />
    </DocSection>
  );
}

function ApiReference({ state }: { state: ReturnType<typeof useCapabilities> }): React.JSX.Element {
  return (
    <DocSection id="api-reference" title="API reference">
      <p>
        Every capability below has a full request/response schema and example on its own detail page. The
        interactive Swagger UI is served directly by the API at{' '}
        <a href={`${API_BASE_URL}/docs`} target="_blank" rel="noreferrer" className="text-frosted-lilac hover:underline">
          {API_BASE_URL}/docs
        </a>
        , generated from the same NestJS decorators as the OpenAPI JSON below — never a hand-maintained copy.
      </p>

      {state.status === 'loading' ? <Skeleton className="h-64 w-full" /> : null}
      {state.status === 'error' ? <ApiErrorState message={state.message} /> : null}
      {state.status === 'success' ? (
        <div className="overflow-x-auto rounded-lg border border-inkline">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-inkline bg-deep-sea text-left text-xs text-ash uppercase">
                <th scope="col" className="px-4 py-2 font-medium">Capability</th>
                <th scope="col" className="px-4 py-2 font-medium">Endpoint</th>
                <th scope="col" className="px-4 py-2 font-medium">Price</th>
              </tr>
            </thead>
            <tbody>
              {state.data.capabilities.map((capability) => (
                <tr key={capability.id} className="border-b border-inkline last:border-b-0">
                  <td className="px-4 py-3 align-top">
                    <Link to={`/capabilities/${capability.id}`} className="text-quartz hover:text-frosted-lilac">
                      {capability.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 align-top font-mono text-xs text-mist">
                    {capability.method} {capability.path}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <PriceTag amount={capability.price.amount} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </DocSection>
  );
}

function PaymentSection({ state }: { state: ReturnType<typeof useCapabilities> }): React.JSX.Element {
  const network = state.status === 'success' ? state.data.network : undefined;

  return (
    <DocSection id="payment" title="Authentication & payment">
      <p>
        Callrack has no traditional API-key authentication. There is nothing to sign up for and no key to
        configure — payment itself is the access control, via the{' '}
        <a href="https://github.com/x402-foundation/x402" target="_blank" rel="noreferrer" className="text-frosted-lilac hover:underline">
          x402 protocol
        </a>
        .
      </p>
      <ol className="list-decimal space-y-1 pl-5">
        <li>An unpaid request returns HTTP 402 with a PAYMENT-REQUIRED header.</li>
        <li>That header is base64-encoded JSON: scheme, network, asset, amount, payTo, and a timeout.</li>
        <li>Settle that exact amount{network ? ` on ${formatNetworkLabel(network.name)}` : ''} through the configured facilitator.</li>
        <li>Retry the identical request with a PAYMENT-SIGNATURE header carrying proof of payment.</li>
      </ol>
      <Alert>
        <Info className="size-4" aria-hidden />
        <AlertTitle>Treat the live 402 response as authoritative</AlertTitle>
        <AlertDescription>
          Never hardcode or cache a price. The PAYMENT-REQUIRED header on the actual response is the only
          correct source for what a call costs right now.
        </AlertDescription>
      </Alert>
    </DocSection>
  );
}

function ErrorsSection(): React.JSX.Element {
  return (
    <DocSection id="errors" title="Errors">
      <p>Every non-2xx response is a JSON envelope: <code className="font-mono">{'{ error: { code, message, details? }, meta: { requestId } }'}</code> — except 402, which has an empty body (see above). The X-Request-ID response header lets you trace a specific call.</p>
      <div className="overflow-x-auto rounded-lg border border-inkline">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-inkline bg-deep-sea text-left text-xs text-ash uppercase">
              <th scope="col" className="px-4 py-2 font-medium">Status</th>
              <th scope="col" className="px-4 py-2 font-medium">Code</th>
              <th scope="col" className="px-4 py-2 font-medium">Meaning</th>
            </tr>
          </thead>
          <tbody>
            {ERROR_ROWS.map((row) => (
              <tr key={row.status} className="border-b border-inkline last:border-b-0">
                <td className="px-4 py-3 align-top font-mono text-xs text-quartz">{row.status}</td>
                <td className="px-4 py-3 align-top font-mono text-xs text-frosted-lilac">{row.code}</td>
                <td className="px-4 py-3 align-top">{row.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DocSection>
  );
}

function NetworksSection({ state }: { state: ReturnType<typeof useCapabilities> }): React.JSX.Element {
  return (
    <DocSection id="networks" title="Networks">
      <p>Callrack runs against exactly one Algorand network at a time, configured per deployment:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li><strong className="text-quartz">Algorand Testnet</strong> — for development and integration testing. Test USDC, no real value.</li>
        <li><strong className="text-quartz">Algorand Mainnet</strong> — for production. Real USDC, real settlement.</li>
      </ul>
      {state.status === 'success' ? (
        <p>
          This deployment is currently running on <strong className="text-quartz">{formatNetworkLabel(state.data.network.name)}</strong>{' '}
          (CAIP-2: <code className="font-mono text-xs">{state.data.network.caip2}</code>), settling through{' '}
          <code className="font-mono text-xs">{state.data.network.facilitatorUrl}</code>.
        </p>
      ) : null}
      <p>Never assume which network is active — read it from a live 402 response, or from GET /v1/capabilities.</p>
    </DocSection>
  );
}

function UsdcSection(): React.JSX.Element {
  return (
    <DocSection id="usdc" title="USDC pricing">
      <p>
        Every price Callrack advertises is denominated in USDC, a USD-pegged stablecoin, so a price shown as{' '}
        <PriceTag amount="0.01" /> means one cent, not a fluctuating token amount. On the wire, a 402 response
        carries the amount in USDC's base units (6 decimals) — a client library, not you, should do that
        conversion; never approximate it with floating-point arithmetic.
      </p>
    </DocSection>
  );
}

function AgentsSection(): React.JSX.Element {
  return (
    <DocSection id="agents" title="Agent developer experience">
      <p>
        This is how an agent is expected to use Callrack. The agent client itself is a later phase of this
        project — today, any HTTP-capable agent or script can already follow this flow directly.
      </p>
      <ol className="list-decimal space-y-1 pl-5">
        <li>Discover — read /v1/capabilities or .well-known/x402 for what's callable and what it costs.</li>
        <li>Choose a capability — pick the endpoint that answers the agent's current sub-task.</li>
        <li>Call — POST the request.</li>
        <li>402 — read the live payment requirement; never trust a cached or hardcoded price.</li>
        <li>Pay — settle the exact advertised amount via x402.</li>
        <li>Retry — the same request, with payment proof attached.</li>
        <li>Receive information — use the response as input to the agent's next step.</li>
      </ol>
      <p>
        See <a href="/agents.md" target="_blank" rel="noreferrer" className="text-frosted-lilac hover:underline">/agents.md</a>{' '}
        and <a href="/llms.txt" target="_blank" rel="noreferrer" className="text-frosted-lilac hover:underline">/llms.txt</a>{' '}
        for the machine-readable versions of this same guidance.
      </p>
    </DocSection>
  );
}

function SdkSection(): React.JSX.Element {
  return (
    <DocSection id="sdk" title="Client libraries">
      <p>
        There is no published Callrack client library yet. Call the API directly with any HTTP client — every
        example on this page uses plain <code className="font-mono">fetch</code>/<code className="font-mono">curl</code>{' '}
        and works without one. This section will document a real SDK once one is published, rather than
        describing one that doesn't exist yet.
      </p>
    </DocSection>
  );
}
