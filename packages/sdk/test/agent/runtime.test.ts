import { describe, expect, it, vi } from 'vitest';
import type { PaymentRequirements } from '@x402/core/types';

// See test/x402-payment-client.test.ts for why only ExactAvmScheme's actual
// transaction construction is faked here - everything else in the payment
// path (selection, policy validation, retry, budget) is real.
vi.mock('@x402/avm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@x402/avm')>();
  return {
    ...actual,
    ExactAvmScheme: class {
      readonly scheme = 'exact';
      async createPaymentPayload(x402Version: number, paymentRequirements: PaymentRequirements) {
        return { x402Version, accepted: paymentRequirements, payload: { fakeSignature: 'test-only' } };
      }
    },
  };
});

import { CallrackAgentRuntime } from '../../src/agent/runtime.js';
import { CAPABILITIES_DATA } from '../fixtures/capabilities.js';
import { buildPaymentRequired, createFetchQueue, jsonResponse, paymentRequiredResponse } from '../fixtures/http.js';

const FAKE_SIGNER = { address: 'FAKETESTADDRESS', signTransactions: vi.fn() };

function queueDiscovery(queue: ReturnType<typeof createFetchQueue>): void {
  queue.push(jsonResponse(200, { data: CAPABILITIES_DATA, meta: { requestId: 'req_discovery' } }));
}

function queuePaidCall(queue: ReturnType<typeof createFetchQueue>, path: string, requestId: string): void {
  queue.push(paymentRequiredResponse(buildPaymentRequired({ resourceUrl: `http://localhost:3000${path}` })));
  queue.push(jsonResponse(200, { data: { results: [] }, meta: { requestId } }));
}

describe('CallrackAgentRuntime', () => {
  it('plans, pays for, and executes every capability a task matches, tracking budget exactly', async () => {
    const queue = createFetchQueue();
    vi.stubGlobal('fetch', queue.fetch);
    queueDiscovery(queue);
    queuePaidCall(queue, '/v1/academic/search', 'req_academic');
    queuePaidCall(queue, '/v1/news/search', 'req_news');

    const runtime = new CallrackAgentRuntime({
      client: { baseUrl: 'http://localhost:3000', network: 'testnet', signer: FAKE_SIGNER },
      maxBudget: '0.25',
    });

    const result = await runtime.run('Research renewable energy news and academic papers');

    expect(result.steps.map((step) => step.toolId)).toEqual(['academic.search', 'news.search']);
    expect(result.steps.every((step) => step.error === undefined)).toBe(true);
    expect(result.budget).toEqual({ totalAtomic: '250000', spentAtomic: '15000', remainingAtomic: '235000' });

    const eventTypes = result.events.map((event) => event.type);
    expect(eventTypes).toContain('capability_selected');
    expect(eventTypes).toContain('payment_required');
    expect(eventTypes).toContain('payment_approved');
    expect(eventTypes).toContain('payment_submitted');
    expect(eventTypes).toContain('response_received');
    expect(eventTypes).toContain('budget_updated');
    expect(eventTypes).not.toContain('payment_rejected');

    for (const event of result.events) {
      expect(JSON.stringify(event)).not.toMatch(/mnemonic|privateKey|signTransactions|fakeSignature/i);
    }
    vi.unstubAllGlobals();
  });

  it('rejects a step that would exceed the remaining task budget without calling the capability', async () => {
    const queue = createFetchQueue();
    vi.stubGlobal('fetch', queue.fetch);
    queueDiscovery(queue);
    queuePaidCall(queue, '/v1/academic/search', 'req_academic'); // enough budget for this one only

    const runtime = new CallrackAgentRuntime({
      client: { baseUrl: 'http://localhost:3000', network: 'testnet', signer: FAKE_SIGNER },
      maxBudget: '0.01',
    });

    const result = await runtime.run('Research renewable energy news and academic papers');

    const academicStep = result.steps.find((step) => step.toolId === 'academic.search');
    const newsStep = result.steps.find((step) => step.toolId === 'news.search');
    expect(academicStep?.error).toBeUndefined();
    expect(newsStep?.error).toBe('PAYMENT_BUDGET_EXCEEDED');
    expect(result.budget.remainingAtomic).toBe('0');
    expect(result.events.some((event) => event.type === 'payment_rejected')).toBe(true);
    // Only discovery + the one affordable capability's 402/retry - news.search was never called.
    expect(queue.calls).toHaveLength(3);
    vi.unstubAllGlobals();
  });

  it('discovers and pays for the new information capabilities through the same spending-policy infrastructure', async () => {
    const queue = createFetchQueue();
    vi.stubGlobal('fetch', queue.fetch);
    queueDiscovery(queue);
    queuePaidCall(queue, '/v1/verify', 'req_verify');

    const runtime = new CallrackAgentRuntime({
      client: { baseUrl: 'http://localhost:3000', network: 'testnet', signer: FAKE_SIGNER },
      maxBudget: '0.25',
    });

    const result = await runtime.run('Verify that Nigeria is the most populous country in Africa.');

    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]?.toolId).toBe('information.verify');
    expect(result.steps[0]?.error).toBeUndefined();
    expect(result.events.map((e) => e.type)).toEqual(
      expect.arrayContaining(['capability_selected', 'payment_required', 'payment_approved', 'payment_submitted', 'response_received']),
    );
    vi.unstubAllGlobals();
  });

  it('uses the given planner instead of the deterministic default', async () => {
    const queue = createFetchQueue();
    vi.stubGlobal('fetch', queue.fetch);
    queueDiscovery(queue);
    queuePaidCall(queue, '/v1/news/search', 'req_news');

    const runtime = new CallrackAgentRuntime({
      client: { baseUrl: 'http://localhost:3000', network: 'testnet', signer: FAKE_SIGNER },
      maxBudget: '0.25',
      planner: () => [{ toolId: 'news.search', input: { query: 'anything' } }],
    });

    const result = await runtime.run('a task the deterministic planner would not have matched at all');
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]?.toolId).toBe('news.search');
    vi.unstubAllGlobals();
  });
});
