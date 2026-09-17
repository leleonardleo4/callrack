import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Send } from 'lucide-react';
import { Seo } from '@/components/Seo';
import { Section, Eyebrow } from '@/components/layout/Section';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { PriceTag } from '@/components/PriceTag';
import { ApiErrorState } from '@/components/ApiErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { DynamicRequestForm } from '@/components/playground/DynamicRequestForm';
import { PlaygroundResponsePanel } from '@/components/playground/PlaygroundResponsePanel';
import { useCapabilities } from '@/hooks/useCapabilities';
import { callCapability, type ApiResult } from '@/lib/api-client';
import { buildRequestBody, initFormState, type FormFieldValue } from '@/lib/dynamic-form';
import type { PublicCapability } from '@/types/capability';

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
        description="Call a real Callrack capability directly from your browser and see the honest HTTP 402 payment requirement: no fake payment success."
        path="/playground"
      />
      <Section>
        <Eyebrow>Playground</Eyebrow>
        <h1 className="mt-3 font-heading text-3xl font-medium text-quartz md:text-4xl">
          Try a real request
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ash">
          This calls the real Callrack API, never mock data. An unpaid request will honestly return{' '}
          <code className="font-mono text-frosted-lilac">402 Payment Required</code>; Callrack never fakes a
          successful payment here.
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
  const [paymentSignature, setPaymentSignature] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<ApiResult<unknown> | undefined>(undefined);

  // Re-seed the form whenever the selected capability changes.
  useEffect(() => {
    setFormState(initFormState(capability.requestSchema, capability.example.request));
    setFieldError(undefined);
    setResult(undefined);
    setPaymentSignature('');
  }, [capability.id, capability.requestSchema, capability.example.request]);

  const canRetryWithPayment = useMemo(
    () => result?.kind === 'payment-required' && paymentSignature.trim().length > 0,
    [result, paymentSignature],
  );

  async function handleSend(signature?: string): Promise<void> {
    const built = buildRequestBody(capability.requestSchema, formState);
    if (!built.ok) {
      setFieldError({ field: built.field, message: built.message });
      return;
    }
    setFieldError(undefined);
    setSending(true);
    try {
      const response = await callCapability(capability.path, built.body, signature);
      setResult(response);
    } finally {
      setSending(false);
    }
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

        {result?.kind === 'payment-required' ? (
          <div className="flex flex-col gap-2 rounded-lg border border-inkline bg-deep-sea p-4">
            <Label htmlFor="payment-signature">Advanced: retry with a payment signature</Label>
            <p className="text-xs text-ash">
              If you already produced a valid x402 payment signature yourself, paste it here to retry this
              exact request and see the real paid response. Callrack never generates or signs a payment.
            </p>
            <Textarea
              id="payment-signature"
              value={paymentSignature}
              onChange={(event) => setPaymentSignature(event.target.value)}
              rows={2}
              className="font-mono text-xs"
              placeholder="PAYMENT-SIGNATURE header value"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={!canRetryWithPayment || sending}
              onClick={() => handleSend(paymentSignature.trim())}
              className="self-start"
            >
              Retry with payment
            </Button>
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border border-inkline bg-deep-sea p-5" role="region" aria-label="Response">
        <PlaygroundResponsePanel result={result} sending={sending} networkName={networkName} />
      </div>
    </div>
  );
}
