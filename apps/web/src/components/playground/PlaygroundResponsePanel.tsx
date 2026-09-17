import { CheckCircle2, Wifi } from 'lucide-react';
import { HttpStatusBadge } from '@/components/HttpStatusBadge';
import { CodeBlock } from '@/components/CodeBlock';
import { PriceTag } from '@/components/PriceTag';
import { statusLabel } from '@/lib/http-status';
import { formatNetworkLabel } from '@/lib/format';
import type { ApiResult } from '@/lib/api-client';

export interface PlaygroundResponsePanelProps {
  readonly result: ApiResult<unknown> | undefined;
  readonly sending: boolean;
  readonly networkName: 'testnet' | 'mainnet' | undefined;
}

export function PlaygroundResponsePanel({ result, sending, networkName }: PlaygroundResponsePanelProps): React.JSX.Element {
  if (sending) {
    return <p className="text-sm text-ash">Sending request…</p>;
  }

  if (!result) {
    return <p className="text-sm text-ash">Send a request to see the response here.</p>;
  }

  if (result.kind === 'network-error') {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <Wifi className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
        <div>
          <p className="text-sm font-medium text-destructive">Network error</p>
          <p className="mt-1 text-sm text-mist">{result.message}</p>
          <p className="mt-1 text-xs text-ash">
            Check that the Callrack API is running and reachable, and that CORS allows this origin.
          </p>
        </div>
      </div>
    );
  }

  if (result.kind === 'payment-required') {
    const requirement = result.paymentRequired.accepts[0];
    return (
      <div className="flex flex-col gap-4">
        <HttpStatusBadge status={402} label={statusLabel(402)} />
        <div className="rounded-lg border border-sapphire-hairline bg-cobalt-panel p-4">
          <p className="font-heading text-sm font-medium text-quartz">Payment required</p>
          <p className="mt-1 text-sm text-mist">
            This is the real, live payment requirement for this call — not a simulation.
          </p>
          {requirement ? (
            <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-ash uppercase">Price</dt>
                <dd className="mt-0.5">
                  <PriceTag amount={requirement.amount} className="text-quartz" />{' '}
                  <span className="text-xs text-ash">(atomic units of asset {requirement.asset})</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ash uppercase">Network</dt>
                <dd className="mt-0.5 font-mono text-xs text-mist">
                  {networkName ? formatNetworkLabel(networkName) : requirement.network}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ash uppercase">Payment destination</dt>
                <dd className="mt-0.5 break-all font-mono text-xs text-mist">{requirement.payTo}</dd>
              </div>
              <div>
                <dt className="text-xs text-ash uppercase">Timeout</dt>
                <dd className="mt-0.5 text-mist">{requirement.maxTimeoutSeconds}s</dd>
              </div>
            </dl>
          ) : null}
          <p className="mt-4 text-xs text-ash">
            To see the real paid response, settle this exact amount via x402 and retry below with your payment
            signature. Callrack never fabricates a successful payment.
          </p>
        </div>
        <details className="text-xs text-ash">
          <summary className="cursor-pointer select-none">Raw PAYMENT-REQUIRED payload</summary>
          <div className="mt-2">
            <CodeBlock code={JSON.stringify(result.paymentRequired, null, 2)} />
          </div>
        </details>
      </div>
    );
  }

  if (result.kind === 'api-error') {
    return (
      <div className="flex flex-col gap-3">
        <HttpStatusBadge status={result.status} label={statusLabel(result.status)} />
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="font-mono text-xs text-destructive">{result.error.code}</p>
          <p className="mt-1 text-sm text-mist">{result.error.message}</p>
        </div>
        {result.error.details ? (
          <CodeBlock label="error.details" code={JSON.stringify(result.error.details, null, 2)} />
        ) : null}
        {result.requestId ? <p className="text-xs text-ash">Request ID: {result.requestId}</p> : null}
      </div>
    );
  }

  // success
  return (
    <div className="flex flex-col gap-4">
      <HttpStatusBadge status={result.status} label={statusLabel(result.status)} />
      {result.paymentResponse ? (
        <div className="flex items-start gap-3 rounded-lg border border-sapphire-hairline bg-cobalt-panel p-4">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-frosted-lilac" aria-hidden />
          <div>
            <p className="text-sm font-medium text-quartz">Payment verified</p>
            <p className="mt-1 text-xs text-mist">
              The server confirmed real payment settlement before returning this response.
            </p>
          </div>
        </div>
      ) : null}
      <CodeBlock label="response.json" code={JSON.stringify(result.data, null, 2)} />
      <p className="text-xs text-ash">Request ID: {result.requestId}</p>
    </div>
  );
}
