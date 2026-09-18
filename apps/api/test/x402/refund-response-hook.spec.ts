import { describe, expect, it, vi } from 'vitest';
import { encodePaymentResponseHeader } from '@x402/core/http';
import type { SettleResponse } from '@x402/core/types';
import { createRefundOnSendHook } from '../../src/x402/refund-response-hook.js';
import type { RefundOrchestrationService } from '../../src/refunds/refund-orchestration.service.js';
import type { X402ConfigService } from '../../src/config/x402-config.service.js';
import { RequestContext } from '../../src/common/request-context/request-context.js';
import { markCapabilityExecutionFailed } from '../../src/common/request-context/capability-outcome.js';

const NETWORK = 'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe';
const PAYER = 'V4BOVWHAQJUNZAPU4D7B4N2ALHVMHBRJ2F75EJG5E5XS5JFJZGAU4SS2UA';
const MERCHANT = 'TTCZHJ24VWV64DMFCXKHS2GMLFVUTBA673THZR7LNYY3GEB3XV7HNUEQXQ';

function successSettlement(overrides: Partial<SettleResponse> = {}): SettleResponse {
  return { success: true, transaction: 'TXN_ABC', network: NETWORK, payer: PAYER, ...overrides };
}

function fakeRequest(options: {
  x402Context?: unknown;
  paymentResponseHeader?: string;
}) {
  return {
    id: 'req_x',
    x402Context: options.x402Context,
  } as any;
}

function fakeReply(initialStatus: number, headers: Record<string, string> = {}) {
  let statusCode = initialStatus;
  return {
    get statusCode() {
      return statusCode;
    },
    status(code: number) {
      statusCode = code;
      return this;
    },
    getHeader(name: string) {
      return headers[name.toLowerCase()] ?? headers[name];
    },
  } as any;
}

function fakeX402Context(paymentRequirements: Record<string, unknown> = {}) {
  return {
    paymentRequirements: {
      scheme: 'exact',
      network: NETWORK,
      asset: '10458941',
      amount: '10000',
      payTo: MERCHANT,
      maxTimeoutSeconds: 60,
      extra: {},
      ...paymentRequirements,
    },
    paymentPayload: { x402Version: 2, accepted: {}, payload: {} },
  };
}

function fakeOrchestrator(handle: ReturnType<typeof vi.fn>): RefundOrchestrationService {
  return { handleFailedPaidCapability: handle } as unknown as RefundOrchestrationService;
}

const fakeX402Config = { network: 'testnet' } as unknown as X402ConfigService;

describe('createRefundOnSendHook', () => {
  it('does nothing for a route that never went through x402 at all', async () => {
    const handle = vi.fn();
    const hook = createRefundOnSendHook({ refundOrchestrator: fakeOrchestrator(handle), x402Config: fakeX402Config });
    const payload = JSON.stringify({ data: {} });

    const result = await hook(fakeRequest({}), fakeReply(200), payload);

    expect(result).toBe(payload);
    expect(handle).not.toHaveBeenCalled();
  });

  it('does nothing when there is no PAYMENT-RESPONSE header at all (payment never settled)', async () => {
    const handle = vi.fn();
    const hook = createRefundOnSendHook({ refundOrchestrator: fakeOrchestrator(handle), x402Config: fakeX402Config });
    const payload = JSON.stringify({ error: { code: 'PROVIDER_UNAVAILABLE', message: 'down' }, meta: {} });

    const result = await hook(fakeRequest({ x402Context: fakeX402Context() }), fakeReply(502), payload);

    expect(result).toBe(payload);
    expect(handle).not.toHaveBeenCalled();
  });

  it('does nothing for a settlement that reports failure (settlement failed = no refund)', async () => {
    const handle = vi.fn();
    const hook = createRefundOnSendHook({ refundOrchestrator: fakeOrchestrator(handle), x402Config: fakeX402Config });
    const header = encodePaymentResponseHeader({ success: false, errorReason: 'insufficient_funds', network: NETWORK, transaction: '' });
    const payload = JSON.stringify({ error: { code: 'X', message: 'x' }, meta: {} });

    const result = await hook(
      fakeRequest({ x402Context: fakeX402Context() }),
      fakeReply(402, { 'payment-response': header }),
      payload,
    );

    expect(result).toBe(payload);
    expect(handle).not.toHaveBeenCalled();
  });

  it('does nothing for a normal successful paid response (settled AND status < 400, no failure marker)', async () => {
    const handle = vi.fn();
    const hook = createRefundOnSendHook({ refundOrchestrator: fakeOrchestrator(handle), x402Config: fakeX402Config });
    const header = encodePaymentResponseHeader(successSettlement());
    const payload = JSON.stringify({ data: { ok: true }, meta: {} });

    const result = await hook(
      fakeRequest({ x402Context: fakeX402Context() }),
      fakeReply(200, { 'payment-response': header }),
      payload,
    );

    expect(result).toBe(payload);
    expect(handle).not.toHaveBeenCalled();
  });

  it('triggers a refund and rewrites the body when settlement succeeded but the response is a real 5xx (capability threw / returned an error)', async () => {
    const handle = vi.fn().mockResolvedValue({ status: 'refunded', refundTransaction: 'REFUND_TXN_1' });
    const hook = createRefundOnSendHook({ refundOrchestrator: fakeOrchestrator(handle), x402Config: fakeX402Config });
    const header = encodePaymentResponseHeader(successSettlement());
    const payload = JSON.stringify({ error: { code: 'PROVIDER_UNAVAILABLE', message: 'down' }, meta: { requestId: 'req_x' } });
    const reply = fakeReply(500, { 'payment-response': header });

    const result = await hook(fakeRequest({ x402Context: fakeX402Context() }), reply, payload);

    expect(handle).toHaveBeenCalledTimes(1);
    const body = JSON.parse(result as string);
    expect(body.error.code).toBe('PROVIDER_UNAVAILABLE');
    expect(body.payment).toEqual({ status: 'refunded', refundTransaction: 'REFUND_TXN_1' });
    expect(reply.statusCode).toBe(500);
  });

  it('reports refund_pending when the refund could not be confirmed inline', async () => {
    const handle = vi.fn().mockResolvedValue({ status: 'refund_pending' });
    const hook = createRefundOnSendHook({ refundOrchestrator: fakeOrchestrator(handle), x402Config: fakeX402Config });
    const header = encodePaymentResponseHeader(successSettlement());
    const payload = JSON.stringify({ error: { code: 'PROVIDER_UNAVAILABLE', message: 'down' }, meta: {} });

    const result = await hook(
      fakeRequest({ x402Context: fakeX402Context() }),
      fakeReply(500, { 'payment-response': header }),
      payload,
    );

    const body = JSON.parse(result as string);
    expect(body.payment).toEqual({ status: 'refund_pending' });
  });

  it('synthesizes a 500 CAPABILITY_EXECUTION_FAILED envelope for a 200 response marked as a failed execution (research total failure)', async () => {
    const handle = vi.fn().mockResolvedValue({ status: 'refund_pending' });
    const hook = createRefundOnSendHook({ refundOrchestrator: fakeOrchestrator(handle), x402Config: fakeX402Config });
    const header = encodePaymentResponseHeader(successSettlement());
    const payload = JSON.stringify({ data: { status: 'failed', sources: {} }, meta: { requestId: 'req_x' } });
    const reply = fakeReply(200, { 'payment-response': header });

    const result = await RequestContext.run({ requestId: 'req_x' }, async () => {
      markCapabilityExecutionFailed('All requested research sources failed.');
      return hook(fakeRequest({ x402Context: fakeX402Context() }), reply, payload);
    });

    expect(handle).toHaveBeenCalledTimes(1);
    expect(reply.statusCode).toBe(500);
    const body = JSON.parse(result as string);
    expect(body.error.code).toBe('CAPABILITY_EXECUTION_FAILED');
    expect(body.payment).toEqual({ status: 'refund_pending' });
  });

  it('never triggers a refund for a 200 response when no failure was ever marked (a genuinely partial-but-successful research result)', async () => {
    const handle = vi.fn();
    const hook = createRefundOnSendHook({ refundOrchestrator: fakeOrchestrator(handle), x402Config: fakeX402Config });
    const header = encodePaymentResponseHeader(successSettlement());
    const payload = JSON.stringify({ data: { status: 'partial', sources: {} }, meta: {} });

    const result = await RequestContext.run({ requestId: 'req_y' }, () =>
      hook(fakeRequest({ x402Context: fakeX402Context() }), fakeReply(200, { 'payment-response': header }), payload),
    );

    expect(result).toBe(payload);
    expect(handle).not.toHaveBeenCalled();
  });
});
