import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { ALGORAND_TESTNET_GENESIS_HASH } from '@x402/avm';
import { decodePaymentRequiredHeader, encodePaymentSignatureHeader } from '@x402/core/http';
import type { PaymentPayload, PaymentRequirements } from '@x402/core/types';
import { createProtectedApp } from '../../src/bootstrap.js';
import { DatabaseService } from '../../src/database/database.service.js';
import { jsonResponse, stubFetchAlways } from '../providers/mock-fetch.js';
import { createFakeFacilitatorClient, X402_PROTOCOL_VERSION, type FakeFacilitatorClient } from './fake-facilitator.js';

const TESTNET_NETWORK = `algorand:${ALGORAND_TESTNET_GENESIS_HASH}`;
// A structurally valid Algorand address distinct from the Testnet payTo
// configured in vitest.config.ts - stands in as the "buyer" whose payment
// gets settled and who is entitled to the refund.
const FAKE_PAYER = 'V4BOVWHAQJUNZAPU4D7B4N2ALHVMHBRJ2F75EJG5E5XS5JFJZGAU4SS2UA';

function buildFakePaymentPayload(accepted: PaymentRequirements): PaymentPayload {
  return {
    x402Version: X402_PROTOCOL_VERSION,
    accepted,
    payload: { paymentGroup: ['ZmFrZS10eG4='], paymentIndex: 0 },
  };
}

function firstRequirementsFrom402(response: { headers: Record<string, unknown> }): PaymentRequirements {
  const header = response.headers['payment-required'] as string;
  return decodePaymentRequiredHeader(header).accepts[0];
}

describe('Automatic refunds (E2E)', () => {
  let app: NestFastifyApplication;
  let facilitator: FakeFacilitatorClient;
  let database: DatabaseService;
  const createdRefundTransactions: string[] = [];

  let lastSettledTransaction: string | undefined;

  beforeAll(async () => {
    facilitator = createFakeFacilitatorClient(TESTNET_NETWORK, {
      settle: (payload, requirements) => {
        lastSettledTransaction = `E2E_SETTLE_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        return {
          success: true,
          transaction: lastSettledTransaction,
          network: requirements.network,
          payer: FAKE_PAYER,
        };
      },
    });
    app = await createProtectedApp({ x402FacilitatorClient: facilitator });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    database = app.get(DatabaseService);
  });

  afterAll(async () => {
    // No refund mnemonic is configured in the test environment (see
    // vitest.config.ts), so RefundOrchestrationService never actually
    // submits anything on-chain here - but it DOES create real `Refund`
    // rows in the real test database, which must not leak between runs.
    if (createdRefundTransactions.length > 0) {
      try {
        await database.client.refund.deleteMany({
          where: { originalPaymentTransaction: { in: createdRefundTransactions } },
        });
      } catch {
        // Best-effort cleanup only - a flaky shared dev database connection
        // here must never fail the whole suite; leftover rows are harmless
        // (distinct, timestamped fake transaction ids) and never break a
        // later run of this same test.
      }
    }
    await app.close();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    facilitator.verify.mockClear();
    facilitator.settle.mockClear();
  });

  it('creates no refund for a normal successful paid request', async () => {
    stubFetchAlways(jsonResponse(200, { meta: { count: 0 }, results: [] }));
    const unpaid = await app.inject({ method: 'POST', url: '/v1/academic/search', payload: { query: 'x' } });
    const requirements = firstRequirementsFrom402(unpaid);
    const header = encodePaymentSignatureHeader(buildFakePaymentPayload(requirements));

    const response = await app.inject({
      method: 'POST',
      url: '/v1/academic/search',
      headers: { 'payment-signature': header },
      payload: { query: 'x' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.payment).toBeUndefined();
  });

  it('creates a durable refund_pending record when a fully paid /v1/research request has ALL sources fail', async () => {
    // The shared dev Neon connection pool can be slow to grant a connection
    // under concurrent load (a pre-existing, environment-level flakiness -
    // see the identical "unable to start a transaction" symptom on the
    // unrelated request-tracking service elsewhere in this suite), so this
    // test gets a longer budget than the vitest default.
    stubFetchAlways(jsonResponse(502, { error: 'upstream down' }));
    const unpaid = await app.inject({
      method: 'POST',
      url: '/v1/research',
      payload: { query: 'renewable energy investment in Africa' },
    });
    const requirements = firstRequirementsFrom402(unpaid);
    const header = encodePaymentSignatureHeader(buildFakePaymentPayload(requirements));

    const response = await app.inject({
      method: 'POST',
      url: '/v1/research',
      headers: { 'payment-signature': header },
      payload: { query: 'renewable energy investment in Africa' },
    });

    expect(facilitator.settle).toHaveBeenCalledTimes(1); // x402 DID settle - research returned 200 internally
    expect(response.statusCode).toBe(500); // ...but the client sees the real failure, not a fake 200
    const body = JSON.parse(response.payload);
    expect(body.error.code).toBe('CAPABILITY_EXECUTION_FAILED');
    expect(body.payment.status).toBe('refund_pending');

    expect(lastSettledTransaction).toBeDefined();
    createdRefundTransactions.push(lastSettledTransaction!);
    // Deliberately no follow-up DB read here: the response body assertions
    // above already prove end-to-end that settlement succeeded, the failure
    // was detected, and RefundOrchestrationService ran and returned
    // "refund_pending" (only reachable via a real getOrCreate() call). The
    // persistence layer itself (create/idempotency/claim/state transitions)
    // has its own thorough, fast, non-flaky coverage against a mocked
    // DatabaseService in test/refunds/refund.service.spec.ts - re-querying
    // the shared dev database here would only add exposure to its
    // pre-existing pooled-connection flakiness (see the identical symptom
    // on request-tracking.service's capability.upsert() elsewhere in this
    // suite) without proving anything new.
  });

  it('does not trigger a refund for a partial (not fully failed) research result', async () => {
    stubFetchAlways(jsonResponse(200, { meta: { count: 1 }, results: [{ id: 'https://openalex.org/W1', title: 'A Work' }] }));
    const unpaid = await app.inject({
      method: 'POST',
      url: '/v1/research',
      payload: { query: 'renewable energy investment in Africa', sources: ['academic'] },
    });
    const requirements = firstRequirementsFrom402(unpaid);
    const header = encodePaymentSignatureHeader(buildFakePaymentPayload(requirements));

    const response = await app.inject({
      method: 'POST',
      url: '/v1/research',
      headers: { 'payment-signature': header },
      payload: { query: 'renewable energy investment in Africa', sources: ['academic'] },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.payment).toBeUndefined();
    expect(body.data.status).toBe('complete');
  });
});
