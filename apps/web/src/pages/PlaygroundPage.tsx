import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Send } from 'lucide-react';
import { Seo } from '@/components/Seo';
import { Section, Eyebrow } from '@/components/layout/Section';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { PriceTag } from '@/components/PriceTag';
import { ApiErrorState } from '@/components/ApiErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { DynamicRequestForm } from '@/components/playground/DynamicRequestForm';
import { PlaygroundResponsePanel } from '@/components/playground/PlaygroundResponsePanel';
import { WalletConnectDialog } from '@/components/wallet/WalletConnectDialog';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useWalletPaymentFlow } from '@/hooks/useWalletPaymentFlow';
import { useWalletSigner } from '@/wallet/useWalletSigner';
import { buildRequestBody, initFormState, type FormFieldValue } from '@/lib/dynamic-form';
import { formatNetworkLabel } from '@/lib/format';
import type { PublicCapability } from '@/types/capability';

const BUSY_STATUSES = new Set(['preparing', 'awaiting-approval', 'submitting-payment', 'retrying']);

export function PlaygroundPage(): React.JSX.Element {
  const state = useCapabilities();
  const [searchParams, setSearchParams] = useSearchParams();

  const capabilities = state.status === 'success' ? state.data.capabilities : [];
  const selectedId = searchParams.get('capability') ?? capabilities[0]?.id ?? '';
  const capability = capabilities.find((c) => c.id === selectedId);

  return (
    <>
      <Seo
        title="Playground"
        description="Call a real Callrack capability directly from your browser, connect an Algorand wallet, and see the honest HTTP 402 payment flow: no fake payment success."
        path="/playground"
      />
      <Section>
        <Eyebrow>Playground</Eyebrow>
        <h1 className="mt-3 font-heading text-3xl font-medium text-quartz md:text-4xl">
          Try a real request
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ash">
          This calls the real Callrack API, never mock data. An unpaid request will honestly return{' '}
          <code className="font-mono text-frosted-lilac">402 Payment Required</code>. Connect a wallet to approve a
          real x402 payment and retry - Callrack never fakes a successful payment here.
        </p>

        <div className="mt-10">
          {state.status === 'loading' ? <Skeleton className="h-96 w-full" /> : null}
          {state.status === 'error' ? <ApiErrorState message={state.message} /> : null}
          {state.status === 'success' && capability ? (
            <PlaygroundBody
              capabilities={capabilities}
              capability={capability}
              onSelectCapability={(id) => setSearchParams({ capability: id })}
              networkName={state.data.network.name}
            />
          ) : null}
          {state.status === 'success' && !capability ? (
            <p className="text-sm text-ash">No capabilities are available.</p>
          ) : null}
        </div>
      </Section>
    </>
  );
}

interface PlaygroundBodyProps {
  readonly capabilities: readonly PublicCapability[];
  readonly capability: PublicCapability;
  readonly onSelectCapability: (id: string) => void;
  readonly networkName: 'testnet' | 'mainnet';
}

function PlaygroundBody({ capabilities, capability, onSelectCapability, networkName }: PlaygroundBodyProps): React.JSX.Element {
  const [formState, setFormState] = useState<Record<string, FormFieldValue>>(() =>
    initFormState(capability.requestSchema, capability.example.request),
  );
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | undefined>(undefined);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);

  const { state: flow, start, approveAndPay, reset } = useWalletPaymentFlow();
  const wallet = useWalletSigner(networkName);
  const sending = BUSY_STATUSES.has(flow.status);

  // Re-seed the form whenever the selected capability changes.
  useEffect(() => {
    setFormState(initFormState(capability.requestSchema, capability.example.request));
    setFieldError(undefined);
    reset();
  }, [capability.id, capability.requestSchema, capability.example.request, reset]);

  async function handleSend(): Promise<void> {
    const built = buildRequestBody(capability.requestSchema, formState);
    if (!built.ok) {
      setFieldError({ field: built.field, message: built.message });
      return;
    }
    setFieldError(undefined);
    await start(capability, built.body);
  }

  async function handleApprovePay(): Promise<void> {
    if (!wallet) {
      setConnectDialogOpen(true);
      return;
    }
    await approveAndPay(wallet, formatNetworkLabel(networkName));
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="capability-select">Capability</Label>
          <Select value={capability.id} onValueChange={onSelectCapability}>
            <SelectTrigger id="capability-select" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {capabilities.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-inkline bg-deep-sea px-4 py-3">
          <code className="font-mono text-xs text-mist">
            {capability.method} {capability.path}
          </code>
          <PriceTag amount={capability.price.amount} />
        </div>

        <DynamicRequestForm
          schema={capability.requestSchema}
          values={formState}
          onChange={(name, value) => setFormState((prev) => ({ ...prev, [name]: value }))}
          fieldError={fieldError}
        />

        <Button onClick={() => handleSend()} disabled={sending} className="self-start">
          <Send className="size-4" aria-hidden /> Send request
        </Button>
      </div>

      <div className="rounded-lg border border-inkline bg-deep-sea p-5" role="region" aria-label="Response">
        <PlaygroundResponsePanel
          flow={flow}
          networkName={networkName}
          walletConnected={Boolean(wallet)}
          onApprovePay={handleApprovePay}
          onConnectWallet={() => setConnectDialogOpen(true)}
        />
      </div>

      <WalletConnectDialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen} />
    </div>
  );
}
