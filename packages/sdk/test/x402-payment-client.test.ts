import { describe, expect, it, vi } from 'vitest';
import type { PaymentRequirements } from '@x402/core/types';

// Real Algorand transaction construction/signing needs a live algod
// connection and is intentionally out of scope for these tests (see the
// Phase 10 spec: "Do not depend on real blockchain transactions for
// ordinary tests"). Every other export of @x402/avm (network resolution,
// asset lookup, the signer helpers) stays real; only `ExactAvmScheme`'s
// actual transaction construction is replaced with an instant fake payload,
// so the full 402 -> select -> validate -> sign -> retry orchestration in
// `X402PaymentClient` (and the real, unmodified `@x402/fetch` /
// `@x402/core` driving it) is still exercised end to end.
vi.mock('@x402/avm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@x402/avm')>();
  return {
    ...actual,
    ExactAvmScheme: class {
      readonly scheme = 'exact';
      async createPaymentPayload(x402Version: number, paymentRequirements: PaymentRequirements) {
        return {
          x402Version,
          accepted: paymentRequirements,
          payload: { fakeSignature: 'test-only' },
        };
      }
    },
  };
});

import { X402PaymentClient } from '../src/x402-payment-client.js';
import { resolveNetwork } from '../src/network.js';
import { defaultSpendPolicy } from '../src/spend-policy.js';
import { CallrackPaymentPolicyError } from '../src/errors.js';
import { buildPaymentRequired, buildPaymentRequirements, createFetchQueue, jsonResponse, paymentRequiredResponse } from './fixtures/http.js';

const RESOLVED = resolveNetwork('testnet');
const RESOURCE_URL = 'http://localhost:3000/v1/academic/search';
const FAKE_SIGNER = { address: 'FAKETESTADDRESS', signTransactions: vi.fn() };

function client(spendPolicy = defaultSpendPolicy(RESOLVED)) {
  return new X402PaymentClient({ resolvedNetwork: RESOLVED, signer: FAKE_SIGNER, spendPolicy });
}

describe('X402PaymentClient', () => {
  it('pays a 402 and retries the original request, returning the paid response', async () => {
    const queue = createFetchQueue();
    vi.stubGlobal('fetch', queue.fetch);
    queue.push(paymentRequiredResponse(buildPaymentRequired({ resourceUrl: RESOURCE_URL })));
    queue.push(jsonResponse(200, { data: { results: [] }, meta: { requestId: 'req_paid' } }));

    const response = await client().fetch(RESOURCE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'test' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ meta: { requestId: 'req_paid' } });
    expect(queue.calls).toHaveLength(2);
    vi.unstubAllGlobals();
  });

  it('preserves the original POST method and body exactly on the paid retry', async () => {
    const queue = createFetchQueue();
    vi.stubGlobal('fetch', queue.fetch);
    queue.push(paymentRequiredResponse(buildPaymentRequired({ resourceUrl: RESOURCE_URL })));
    queue.push(jsonResponse(200, { data: {}, meta: { requestId: 'req_paid' } }));

    const body = JSON.stringify({ query: 'renewable energy', limit: 5 });
    await client().fetch(RESOURCE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    });

    const retryRequest = queue.calls[1]!;
    expect(retryRequest.method).toBe('POST');
    expect(await retryRequest.clone().text()).toBe(body);
    expect(retryRequest.headers.get('PAYMENT-SIGNATURE') ?? retryRequest.headers.get('X-PAYMENT')).toBeTruthy();
    vi.unstubAllGlobals();
  });

  it('never signs a second time when the paid retry itself fails', async () => {
    const queue = createFetchQueue();
    vi.stubGlobal('fetch', queue.fetch);
    queue.push(paymentRequiredResponse(buildPaymentRequired({ resourceUrl: RESOURCE_URL })));
    queue.push(paymentRequiredResponse(buildPaymentRequired({ resourceUrl: RESOURCE_URL })));

    const response = await client().fetch(RESOURCE_URL, { method: 'POST', body: '{}' });

    expect(response.status).toBe(402);
    expect(queue.calls).toHaveLength(2);
    vi.unstubAllGlobals();
  });

  it('rejects a payment requirement whose resource does not match the request the SDK made', async () => {
    const queue = createFetchQueue();
    vi.stubGlobal('fetch', queue.fetch);
    queue.push(paymentRequiredResponse(buildPaymentRequired({ resourceUrl: 'https://evil.example/v1/academic/search' })));

    const error = await client()
      .fetch(RESOURCE_URL, { method: 'POST', body: '{}' })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CallrackPaymentPolicyError);
    expect((error as InstanceType<typeof CallrackPaymentPolicyError>).reason).toBe('RESOURCE_MISMATCH');
    vi.unstubAllGlobals();
  });

  it('rejects a payment requirement on a network this client never registered', async () => {
    const queue = createFetchQueue();
    vi.stubGlobal('fetch', queue.fetch);
    queue.push(
      paymentRequiredResponse(
        buildPaymentRequired({
          resourceUrl: RESOURCE_URL,
          accepts: [buildPaymentRequirements({ network: 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=' })],
        }),
      ),
    );

    const error = await client()
      .fetch(RESOURCE_URL, { method: 'POST', body: '{}' })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CallrackPaymentPolicyError);
    expect((error as InstanceType<typeof CallrackPaymentPolicyError>).reason).toBe('NO_ACCEPTABLE_PAYMENT_REQUIREMENT');
    vi.unstubAllGlobals();
  });

  it('rejects a payment requirement in an asset outside the spend policy', async () => {
    const queue = createFetchQueue();
    vi.stubGlobal('fetch', queue.fetch);
    queue.push(
      paymentRequiredResponse(
        buildPaymentRequired({ resourceUrl: RESOURCE_URL, accepts: [buildPaymentRequirements({ asset: '999999999' })] }),
      ),
    );

    const error = await client()
      .fetch(RESOURCE_URL, { method: 'POST', body: '{}' })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CallrackPaymentPolicyError);
    expect((error as InstanceType<typeof CallrackPaymentPolicyError>).reason).toBe('NO_ACCEPTABLE_PAYMENT_REQUIREMENT');
    vi.unstubAllGlobals();
  });

  it('rejects a payment requirement whose amount exceeds the spend policy cap', async () => {
    const queue = createFetchQueue();
    vi.stubGlobal('fetch', queue.fetch);
    queue.push(
      paymentRequiredResponse(
        buildPaymentRequired({ resourceUrl: RESOURCE_URL, accepts: [buildPaymentRequirements({ amount: '5000000' })] }),
      ),
    );

    const error = await client()
      .fetch(RESOURCE_URL, { method: 'POST', body: '{}' })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CallrackPaymentPolicyError);
    expect((error as InstanceType<typeof CallrackPaymentPolicyError>).reason).toBe('NO_ACCEPTABLE_PAYMENT_REQUIREMENT');
    vi.unstubAllGlobals();
  });

  it('emits the payment_required / payment_approved / payment_submitted lifecycle', async () => {
    const queue = createFetchQueue();
    vi.stubGlobal('fetch', queue.fetch);
    queue.push(paymentRequiredResponse(buildPaymentRequired({ resourceUrl: RESOURCE_URL })));
    queue.push(jsonResponse(200, { data: {}, meta: { requestId: 'req_paid' } }));

    const onPaymentEvent = vi.fn();
    await new X402PaymentClient({
      resolvedNetwork: RESOLVED,
      signer: FAKE_SIGNER,
      spendPolicy: defaultSpendPolicy(RESOLVED),
      onPaymentEvent,
    }).fetch(RESOURCE_URL, { method: 'POST', body: '{}' });

    expect(onPaymentEvent.mock.calls.map((call) => call[0].type)).toEqual([
      'payment_required',
      'payment_approved',
      'payment_submitted',
    ]);
    vi.unstubAllGlobals();
  });
});
