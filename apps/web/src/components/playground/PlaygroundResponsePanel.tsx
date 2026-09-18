import { CheckCircle2, CircleSlash, ExternalLink, Loader2, Wifi } from 'lucide-react';
import { convertFromTokenAmount, resolveNetwork } from '@callrack/sdk';
import { Button } from '@/components/ui/button';
import { HttpStatusBadge } from '@/components/HttpStatusBadge';
import { CodeBlock } from '@/components/CodeBlock';
import { PriceTag } from '@/components/PriceTag';
import { statusLabel } from '@/lib/http-status';
import { formatNetworkLabel } from '@/lib/format';
import { algorandTransactionExplorerUrl } from '@/lib/algorand-explorer';
import type { PaymentFlowState } from '@/hooks/useWalletPaymentFlow';

/**
 * The x402 challenge's `amount` is always the atomic (base-unit) USDC
 * value (e.g. "10000" for $0.01) — never a decimal dollar string. Passing
 * it straight to something that renders `$${amount}` shows a figure 10^6x
 * too large. `networkName` defaults to 'testnet' only for this display
 * conversion (USDC uses the same decimals on both networks); the actual
 * payment always uses the exact atomic amount from the live challenge.
 */
function formatChallengeAmountUsd(atomicAmount: string, networkName: 'testnet' | 'mainnet' | undefined): string {
  return convertFromTokenAmount(atomicAmount, resolveNetwork(networkName ?? 'testnet').usdcDecimals);
}

export interface PlaygroundResponsePanelProps {
  readonly flow: PaymentFlowState;
  readonly networkName: 'testnet' | 'mainnet' | undefined;
  readonly walletConnected: boolean;
  readonly onApprovePay: () => void;
  readonly onConnectWallet: () => void;
}

const BUSY_LABELS: Partial<Record<PaymentFlowState['status'], string>> = {
  preparing: 'Preparing request…',
  'awaiting-approval': 'Waiting for wallet approval…',
  'submitting-payment': 'Submitting payment…',
  retrying: 'Retrying request with payment…',
};

export function PlaygroundResponsePanel({
  flow,
  networkName,
  walletConnected,
  onApprovePay,
  onConnectWallet,
}: PlaygroundResponsePanelProps): React.JSX.Element {
  const busyLabel = BUSY_LABELS[flow.status];
  if (busyLabel) {
    return (
      <div className="flex items-center gap-2 text-sm text-ash">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {busyLabel}
      </div>
    );
  }

  if (flow.status === 'idle') {
    return <p className="text-sm text-ash">Send a request to see the response here.</p>;
  }

  if (flow.status === 'cancelled') {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 rounded-lg border border-inkline bg-deep-sea p-4">
          <CircleSlash className="mt-0.5 size-4 shrink-0 text-ash" aria-hidden />
          <div>
            <p className="text-sm font-medium text-quartz">Transaction cancelled.</p>
            <p className="mt-1 text-xs text-ash">You can approve the payment again whenever you're ready.</p>
          </div>
        </div>
        {flow.paymentRequired ? (
          <Button size="sm" onClick={onApprovePay} className="self-start">
            Approve & pay again
          </Button>
        ) : null}
      </div>
    );
  }

  if (flow.status === 'failed' && flow.failure) {
    const payment = flow.failure.payment;
    return (
      <div className="flex flex-col gap-3">
        {payment ? (
          <div className="flex flex-col gap-2 rounded-lg border border-sapphire-hairline bg-cobalt-panel p-4">
            <div className="flex items-center gap-2 text-sm text-quartz">
              <CheckCircle2 className="size-4 shrink-0 text-frosted-lilac" aria-hidden />
              Payment successful
            </div>
            <div className="flex items-center gap-2 text-sm text-quartz">
              <CircleSlash className="size-4 shrink-0 text-destructive" aria-hidden />
              Capability failed
            </div>
            {payment.status === 'refunded' ? (
              <div className="flex items-center gap-2 text-sm text-quartz">
                <CheckCircle2 className="size-4 shrink-0 text-frosted-lilac" aria-hidden />
                Refund confirmed
                {payment.refundTransaction ? (
                  <a
                    href={algorandTransactionExplorerUrl(payment.refundTransaction, networkName ?? 'testnet')}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-frosted-lilac underline underline-offset-2"
                  >
                    View on explorer
                    <ExternalLink className="size-3" aria-hidden />
                  </a>
                ) : null}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-ash">
                <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                Refund pending — Callrack will settle this automatically; no action needed.
              </div>
            )}
          </div>
        ) : null}
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="font-mono text-xs text-destructive">{flow.failure.reason}</p>
          <p className="mt-1 text-sm text-mist">{flow.failure.message}</p>
        </div>
        {flow.failure.hint ? (
          <div className="rounded-lg border border-inkline bg-deep-sea p-4">
            <p className="text-xs font-medium text-ash uppercase">What this means</p>
            <p className="mt-1 text-sm text-mist">{flow.failure.hint}</p>
          </div>
        ) : null}
        {flow.paymentRequired ? (
          <Button size="sm" variant="outline" onClick={onApprovePay} className="self-start">
            Try again
          </Button>
        ) : null}
      </div>
    );
  }

  const result = flow.result;
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
    const decimalAmount = requirement ? formatChallengeAmountUsd(requirement.amount, networkName) : undefined;
    return (
      <div className="flex flex-col gap-4">
        <HttpStatusBadge status={402} label={statusLabel(402)} />
        <div className="rounded-lg border border-sapphire-hairline bg-cobalt-panel p-4">
          <p className="font-heading text-sm font-medium text-quartz">Payment required</p>
          <p className="mt-1 text-sm text-mist">
            This is the real, live payment requirement for this call, not a simulation.
          </p>
          {requirement && decimalAmount ? (
            <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-ash uppercase">Amount</dt>
                <dd className="mt-0.5">
                  <PriceTag amount={decimalAmount} className="text-quartz" />{' '}
                  <span className="text-xs text-ash">({requirement.amount} atomic units)</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ash uppercase">Network</dt>
                <dd className="mt-0.5 font-mono text-xs text-mist">
                  {networkName ? formatNetworkLabel(networkName) : requirement.network}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ash uppercase">Asset</dt>
                <dd className="mt-0.5 break-all font-mono text-xs text-mist">{requirement.asset}</dd>
              </div>
              <div>
                <dt className="text-xs text-ash uppercase">Payment destination</dt>
                <dd className="mt-0.5 break-all font-mono text-xs text-mist">{requirement.payTo}</dd>
              </div>
            </dl>
          ) : null}
          <p className="mt-4 text-xs text-ash">
            Callrack never fabricates a successful payment — approving below submits a real, on-chain x402 payment
            for exactly this amount before the request is retried.
          </p>
          <div className="mt-4">
            {walletConnected ? (
              <Button size="sm" onClick={onApprovePay}>
                Approve & pay {decimalAmount ? `$${decimalAmount}` : ''}
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={onConnectWallet}>
                Connect wallet to pay
              </Button>
            )}
          </div>
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
