import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { encodePaymentRequiredHeader, encodePaymentResponseHeader } from '@x402/core/http';
import type { PaymentRequirements } from '@x402/core/types';
import { renderRoute } from '../test-utils/renderRoute';
import { jsonResponse } from '../fixtures/mock-fetch';
import { CAPABILITIES_FIXTURE } from '../fixtures/capabilities';

// Same spirit as packages/sdk/test/agent/runtime.test.ts (which fakes only
// ExactAvmScheme's real Algorand transaction construction while letting
// everything else in the x402 client run for real): this fakes only
// `X402PaymentClient`'s use of @x402/avm's real transaction/crypto pipeline
// — `@callrack/sdk` resolves here as a pre-built workspace dist that
// Vitest's SSR layer externalizes from its transform graph, so mocking the
// nested `@x402/avm` import directly (as the SDK's own in-source test does)
// isn't reachable from this app; mocking at the `@callrack/sdk` boundary
// this app actually imports is. Everything this fake does — probe, decode
// the real PAYMENT-REQUIRED header, call the real injected wallet signer,
// attach the signature, retry — mirrors X402PaymentClient's real externally
// observable behavior exactly; only the transaction bytes are fake.
function base64DecodeUtf8(value: string): string {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

const signTransactionsMock = vi.fn(async (txns: Uint8Array[], indexesToSign?: number[]) =>
  txns.map((_, index) => (!indexesToSign || indexesToSign.includes(index) ? new Uint8Array([9, 9, 9]) : null)),
);

vi.mock('@callrack/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@callrack/sdk')>();

  class FakeX402PaymentClient {
    constructor(
      private readonly options: {
        readonly signer: { readonly signTransactions: typeof signTransactionsMock };
        readonly onPaymentEvent?: (event: Record<string, unknown>) => void;
      },
    ) {}

    readonly fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const probe = await globalThis.fetch(input, init);
      if (probe.status !== 402) return probe;

      const header = probe.headers.get('PAYMENT-REQUIRED');
      if (!header) throw new actual.CallrackPaymentError('Missing PAYMENT-REQUIRED header on a 402 response');
      const decoded = JSON.parse(base64DecodeUtf8(header)) as {
        resource: { url: string };
        accepts: PaymentRequirements[];
        error?: string;
      };
      const requirement = decoded.accepts[0];
      const eventBase = {
        resource: decoded.resource.url,
        network: requirement?.network,
        asset: requirement?.asset,
        amount: requirement?.amount,
        payTo: requirement?.payTo,
      };
      this.options.onPaymentEvent?.({ type: 'payment_required', ...eventBase });
      this.options.onPaymentEvent?.({ type: 'payment_approved', ...eventBase });

      let signed: (Uint8Array | null)[];
      try {
        signed = await this.options.signer.signTransactions([new Uint8Array([1, 2, 3])], [0]);
      } catch (error) {
        throw new actual.CallrackPaymentError(`Payment failed: ${error instanceof Error ? error.message : String(error)}`, {
          cause: error,
        });
      }
      if (!signed[0]) throw new actual.CallrackPaymentError('Payment failed: the wallet did not return a signed transaction');

      this.options.onPaymentEvent?.({ type: 'payment_submitted', ...eventBase });

      const retryResponse = await globalThis.fetch(input, {
        ...init,
        headers: { ...(init?.headers as Record<string, string> | undefined), 'PAYMENT-SIGNATURE': 'fake-signature-test-only' },
      });

      if (retryResponse.status === 402) {
        const retryHeader = retryResponse.headers.get('PAYMENT-REQUIRED');
        const retryDecoded = retryHeader ? (JSON.parse(base64DecodeUtf8(retryHeader)) as { error?: string }) : undefined;
        const reason = retryDecoded?.error ? `: ${retryDecoded.error}` : '';
        throw new actual.CallrackPaymentError(`Payment for ${decoded.resource.url} was rejected by the server${reason}`);
      }
      return retryResponse;
    };
  }

  return { ...actual, X402PaymentClient: FakeX402PaymentClient };
});

const FAKE_ADDRESS = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ';

function mockConnectedWallet() {
  return {
    wallets: [],
    availableWallets: [],
    isReady: true,
    activeWallet: {
      id: 'pera',
      walletKey: 'pera',
      metadata: { name: 'Pera', icon: 'data:image/svg+xml;base64,PHN2Zy8+' },
      accounts: [{ name: 'Pera Account 1', address: FAKE_ADDRESS }],
      activeAccount: { name: 'Pera Account 1', address: FAKE_ADDRESS },
      isConnected: true,
      isActive: true,
      canSignData: false,
      canUsePrivateKey: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
      setActive: vi.fn(),
      setActiveAccount: vi.fn(),
    },
    activeWalletAccounts: [{ name: 'Pera Account 1', address: FAKE_ADDRESS }],
    activeAccount: { name: 'Pera Account 1', address: FAKE_ADDRESS },
    activeAddress: FAKE_ADDRESS,
    signData: vi.fn(),
    withPrivateKey: vi.fn(),
    signTransactions: signTransactionsMock,
    transactionSigner: vi.fn(),
  };
}

vi.mock('@txnlab/use-wallet-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@txnlab/use-wallet-react')>();
  return { ...actual, useWallet: () => mockConnectedWallet() };
});

const PAYMENT_REQUIREMENTS: PaymentRequirements = {
  scheme: 'exact',
  network: 'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=',
  asset: '10458941',
  amount: '3000',
  payTo: 'TTCZHJ24VWV64DMFCXKHS2GMLFVUTBA673THZR7LNYY3GEB3XV7HNUEQXQ',
  maxTimeoutSeconds: 60,
  extra: {},
};

function paymentRequiredResponse(resourceUrl: string, overrides: Partial<PaymentRequirements> = {}): Response {
  const header = encodePaymentRequiredHeader({
    x402Version: 2,
    resource: { url: resourceUrl },
    accepts: [{ ...PAYMENT_REQUIREMENTS, ...overrides }],
  });
  return new Response(null, { status: 402, headers: { 'PAYMENT-REQUIRED': header, 'x-request-id': 'req_402' } });
}

function paidSuccessResponse(): Response {
  const paymentResponseHeader = encodePaymentResponseHeader({
    success: true,
    transaction: 'FAKETXID',
    network: PAYMENT_REQUIREMENTS.network,
    payer: FAKE_ADDRESS,
  });
  return jsonResponse(
    { data: { location: { latitude: 6.5244, longitude: 3.3792 } }, meta: { requestId: 'req_paid' } },
    { headers: { 'PAYMENT-RESPONSE': paymentResponseHeader }, requestId: 'req_paid' },
  );
}

/** Routes fetch calls by URL suffix, returning the next queued response for that route each time it's called again. */
function stubRoutedFetch(routes: Record<string, Response[]>): void {
  const counters = new Map<string, number>();
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const routeKey = Object.keys(routes).find((key) => url.endsWith(key));
      if (!routeKey) return Promise.reject(new Error(`No stubbed route for ${url}`));
      const responses = routes[routeKey]!;
      const index = counters.get(routeKey) ?? 0;
      counters.set(routeKey, index + 1);
      const response = responses[Math.min(index, responses.length - 1)]!;
      return Promise.resolve(response.clone());
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  signTransactionsMock.mockClear();
});

describe('Playground wallet payment flow (real x402 client, fake wallet crypto only)', () => {
  it('pays for a 402 request through the connected wallet and displays the real paid response', async () => {
    stubRoutedFetch({
      '/v1/capabilities': [jsonResponse({ data: CAPABILITIES_FIXTURE, meta: { requestId: 'req_caps' } })],
      // 1) our own unpaid probe, 2) X402PaymentClient's own internal probe, 3) the paid retry.
      '/v1/weather': [
        paymentRequiredResponse('http://localhost:3000/v1/weather'),
        paymentRequiredResponse('http://localhost:3000/v1/weather'),
        paidSuccessResponse(),
      ],
    });

    const user = userEvent.setup();
    renderRoute('/playground');

    await screen.findByText('POST /v1/weather');
    await user.click(screen.getByRole('button', { name: /send request/i }));

    const response = screen.getByRole('region', { name: /response/i });
    const approveButton = await within(response).findByRole('button', { name: /approve & pay/i });
    expect(within(response).getByText('TTCZHJ24VWV64DMFCXKHS2GMLFVUTBA673THZR7LNYY3GEB3XV7HNUEQXQ')).toBeInTheDocument();

    await user.click(approveButton);

    await waitFor(() => expect(signTransactionsMock).toHaveBeenCalledTimes(1));
    expect(signTransactionsMock).toHaveBeenCalledWith(expect.any(Array), expect.any(Array));

    expect(await within(response).findByText('Payment verified')).toBeInTheDocument();
    expect(within(response).getByText(/"latitude": 6.5244/)).toBeInTheDocument();
  });

  it('shows "Transaction cancelled." — never an API failure — when the wallet rejects signing', async () => {
    signTransactionsMock.mockImplementationOnce(async () => {
      throw new Error('Transaction request was rejected by the user.');
    });
    stubRoutedFetch({
      '/v1/capabilities': [jsonResponse({ data: CAPABILITIES_FIXTURE, meta: { requestId: 'req_caps' } })],
      '/v1/weather': [paymentRequiredResponse('http://localhost:3000/v1/weather'), paymentRequiredResponse('http://localhost:3000/v1/weather')],
    });

    const user = userEvent.setup();
    renderRoute('/playground');

    await screen.findByText('POST /v1/weather');
    await user.click(screen.getByRole('button', { name: /send request/i }));
    const response = screen.getByRole('region', { name: /response/i });
    await user.click(await within(response).findByRole('button', { name: /approve & pay/i }));

    expect(await within(response).findByText('Transaction cancelled.')).toBeInTheDocument();
    expect(within(response).queryByText(/PAYMENT_REJECTED|api-error/i)).not.toBeInTheDocument();
  });

  it('surfaces the real CallrackPaymentError message when the server rejects the payment', async () => {
    stubRoutedFetch({
      '/v1/capabilities': [jsonResponse({ data: CAPABILITIES_FIXTURE, meta: { requestId: 'req_caps' } })],
      '/v1/weather': [
        paymentRequiredResponse('http://localhost:3000/v1/weather'),
        paymentRequiredResponse('http://localhost:3000/v1/weather', {}),
        new Response(null, {
          status: 402,
          headers: {
            'PAYMENT-REQUIRED': encodePaymentRequiredHeader({
              x402Version: 2,
              resource: { url: 'http://localhost:3000/v1/weather' },
              accepts: [PAYMENT_REQUIREMENTS],
              error: 'Transaction simulation failed: receiver error: must optin, asset 10458941 missing',
            }),
            'x-request-id': 'req_rejected',
          },
        }),
      ],
    });

    const user = userEvent.setup();
    renderRoute('/playground');

    await screen.findByText('POST /v1/weather');
    await user.click(screen.getByRole('button', { name: /send request/i }));
    const response = screen.getByRole('region', { name: /response/i });
    await user.click(await within(response).findByRole('button', { name: /approve & pay/i }));

    expect(await within(response).findByText(/must optin, asset 10458941 missing/i)).toBeInTheDocument();
  });
});
