import { describe, expect, it, vi } from 'vitest';
import { RefundService } from '../../src/refunds/refund.service.js';
import type { AlgorandRefundClient } from '../../src/refunds/algorand-refund-client.js';
import type { DatabaseService } from '../../src/database/database.service.js';
import type { TrustedPaymentInfo } from '../../src/refunds/refund.types.js';

const MERCHANT = 'TTCZHJ24VWV64DMFCXKHS2GMLFVUTBA673THZR7LNYY3GEB3XV7HNUEQXQ';
const PAYER = 'V4BOVWHAQJUNZAPU4D7B4N2ALHVMHBRJ2F75EJG5E5XS5JFJZGAU4SS2UA';
const NETWORK = 'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe';
const ASSET = '10458941';

function basePayment(overrides: Partial<TrustedPaymentInfo> = {}): TrustedPaymentInfo {
  return {
    originalPaymentTransaction: 'TXN123',
    network: NETWORK,
    asset: ASSET,
    amount: '10000',
    payer: PAYER,
    ...overrides,
  };
}

function fakeRefundRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'refund-1',
    requestId: 'req_1',
    originalPaymentTransaction: 'TXN123',
    network: NETWORK,
    asset: ASSET,
    amount: '10000',
    payer: PAYER,
    merchantAddress: MERCHANT,
    status: 'PENDING',
    refundTransaction: null,
    attemptCount: 0,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    confirmedAt: null,
    ...overrides,
  };
}

function fakeDatabase(overrides: {
  create?: ReturnType<typeof vi.fn>;
  findUnique?: ReturnType<typeof vi.fn>;
  findUniqueOrThrow?: ReturnType<typeof vi.fn>;
  updateMany?: ReturnType<typeof vi.fn>;
  update?: ReturnType<typeof vi.fn>;
  findMany?: ReturnType<typeof vi.fn>;
}): DatabaseService {
  return {
    client: {
      refund: {
        create: overrides.create ?? vi.fn(),
        findUnique: overrides.findUnique ?? vi.fn(),
        findUniqueOrThrow: overrides.findUniqueOrThrow ?? vi.fn(),
        updateMany: overrides.updateMany ?? vi.fn(),
        update: overrides.update ?? vi.fn(),
        findMany: overrides.findMany ?? vi.fn(),
      },
    },
  } as unknown as DatabaseService;
}

function fakeAlgorand(overrides: { sendRefund?: ReturnType<typeof vi.fn> } = {}): AlgorandRefundClient {
  return {
    sendRefund: overrides.sendRefund ?? vi.fn().mockResolvedValue({ transactionId: 'REFUND_TXN_1', confirmedRound: 42 }),
  } as unknown as AlgorandRefundClient;
}

describe('RefundService.checkEligibility', () => {
  const expected = { network: NETWORK, assetId: ASSET, merchantAddress: MERCHANT };

  it('is eligible for a structurally valid, correctly-scoped payment', () => {
    const service = new RefundService(fakeDatabase({}), fakeAlgorand());
    expect(service.checkEligibility(basePayment(), expected)).toEqual({ eligible: true });
  });

  it('rejects a missing payer — the client can never omit its way into choosing a recipient', () => {
    const service = new RefundService(fakeDatabase({}), fakeAlgorand());
    const result = service.checkEligibility(basePayment({ payer: undefined }), expected);
    expect(result.eligible).toBe(false);
  });

  it('rejects a structurally invalid Algorand address as payer', () => {
    const service = new RefundService(fakeDatabase({}), fakeAlgorand());
    const result = service.checkEligibility(basePayment({ payer: 'not-an-address' }), expected);
    expect(result.eligible).toBe(false);
  });

  it('rejects the merchant address as its own refund payer', () => {
    const service = new RefundService(fakeDatabase({}), fakeAlgorand());
    const result = service.checkEligibility(basePayment({ payer: MERCHANT }), expected);
    expect(result.eligible).toBe(false);
    expect(result.reason).toMatch(/merchant/i);
  });

  it('rejects a network mismatch', () => {
    const service = new RefundService(fakeDatabase({}), fakeAlgorand());
    const result = service.checkEligibility(basePayment({ network: 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k' }), expected);
    expect(result.eligible).toBe(false);
    expect(result.reason).toMatch(/network/i);
  });

  it('rejects an asset mismatch', () => {
    const service = new RefundService(fakeDatabase({}), fakeAlgorand());
    const result = service.checkEligibility(basePayment({ asset: '31566704' }), expected);
    expect(result.eligible).toBe(false);
    expect(result.reason).toMatch(/asset/i);
  });

  it('rejects a non-positive or non-integer amount', () => {
    const service = new RefundService(fakeDatabase({}), fakeAlgorand());
    expect(service.checkEligibility(basePayment({ amount: '0' }), expected).eligible).toBe(false);
    expect(service.checkEligibility(basePayment({ amount: '-100' }), expected).eligible).toBe(false);
    expect(service.checkEligibility(basePayment({ amount: '10.5' }), expected).eligible).toBe(false);
  });
});

describe('RefundService.getOrCreate (idempotency)', () => {
  it('creates a new refund row for a fresh original payment', async () => {
    const create = vi.fn().mockResolvedValue(fakeRefundRow());
    const service = new RefundService(fakeDatabase({ create }), fakeAlgorand());

    const { refund, created } = await service.getOrCreate(basePayment(), MERCHANT, 'req_1');

    expect(created).toBe(true);
    expect(refund.originalPaymentTransaction).toBe('TXN123');
    expect(create).toHaveBeenCalledWith({
      data: {
        requestId: 'req_1',
        originalPaymentTransaction: 'TXN123',
        network: NETWORK,
        asset: ASSET,
        amount: '10000',
        payer: PAYER,
        merchantAddress: MERCHANT,
      },
    });
  });

  it('returns the existing row instead of creating a duplicate when the unique constraint is hit', async () => {
    const existing = fakeRefundRow({ status: 'CONFIRMED', refundTransaction: 'REFUND_TXN_1' });
    const conflictError = Object.assign(new Error('Unique constraint failed'), { code: 'P2002', clientVersion: 'x' });
    // Mirrors the shape RefundService checks for (`Prisma.PrismaClientKnownRequestError`).
    const { Prisma } = await import('@callrack/db');
    Object.setPrototypeOf(conflictError, Prisma.PrismaClientKnownRequestError.prototype);

    const create = vi.fn().mockRejectedValue(conflictError);
    const findUnique = vi.fn().mockResolvedValue(existing);
    const service = new RefundService(fakeDatabase({ create, findUnique }), fakeAlgorand());

    const { refund, created } = await service.getOrCreate(basePayment(), MERCHANT, 'req_2');

    expect(created).toBe(false);
    expect(refund).toBe(existing);
    expect(findUnique).toHaveBeenCalledWith({ where: { originalPaymentTransaction: 'TXN123' } });
  });
});

describe('RefundService.attemptProcessing', () => {
  it('claims a PENDING refund, submits it, and marks it CONFIRMED on success', async () => {
    const pending = fakeRefundRow({ status: 'PENDING' });
    const processing = fakeRefundRow({ status: 'PROCESSING', attemptCount: 1 });
    const submitted = fakeRefundRow({ status: 'SUBMITTED', attemptCount: 1 });
    const confirmed = fakeRefundRow({ status: 'CONFIRMED', attemptCount: 1, refundTransaction: 'REFUND_TXN_1' });

    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const findUniqueOrThrow = vi.fn().mockResolvedValue(processing);
    const update = vi.fn().mockResolvedValueOnce(submitted).mockResolvedValueOnce(confirmed);
    const sendRefund = vi.fn().mockResolvedValue({ transactionId: 'REFUND_TXN_1', confirmedRound: 100 });

    const service = new RefundService(
      fakeDatabase({ updateMany, findUniqueOrThrow, update }),
      fakeAlgorand({ sendRefund }),
    );

    const result = await service.attemptProcessing(pending.id, 'testnet', 'mnemonic words here');

    expect(result.status).toBe('CONFIRMED');
    expect(result.refundTransaction).toBe('REFUND_TXN_1');
    expect(sendRefund).toHaveBeenCalledWith(
      expect.objectContaining({ network: 'testnet', receiver: PAYER, atomicAmount: '10000', assetId: ASSET }),
    );
  });

  it('marks the refund FAILED with the real error message when the on-chain send throws', async () => {
    const processing = fakeRefundRow({ status: 'PROCESSING', attemptCount: 1 });
    const submitted = fakeRefundRow({ status: 'SUBMITTED', attemptCount: 1 });
    const failed = fakeRefundRow({ status: 'FAILED', attemptCount: 1, lastError: 'RPC timeout' });

    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const findUniqueOrThrow = vi.fn().mockResolvedValue(processing);
    const update = vi.fn().mockResolvedValueOnce(submitted).mockResolvedValueOnce(failed);
    const sendRefund = vi.fn().mockRejectedValue(new Error('RPC timeout'));

    const service = new RefundService(
      fakeDatabase({ updateMany, findUniqueOrThrow, update }),
      fakeAlgorand({ sendRefund }),
    );

    const result = await service.attemptProcessing(processing.id, 'testnet', 'mnemonic words here');

    expect(result.status).toBe('FAILED');
    expect(update).toHaveBeenLastCalledWith({
      where: { id: processing.id },
      data: { status: 'FAILED', lastError: 'RPC timeout' },
    });
  });

  it('does not attempt a second submission for a refund another caller already claimed (or that is already CONFIRMED)', async () => {
    const alreadyConfirmed = fakeRefundRow({ status: 'CONFIRMED', refundTransaction: 'REFUND_TXN_1' });
    const updateMany = vi.fn().mockResolvedValue({ count: 0 }); // claim fails: not PENDING/FAILED anymore
    const findUniqueOrThrow = vi.fn().mockResolvedValue(alreadyConfirmed);
    const sendRefund = vi.fn();

    const service = new RefundService(fakeDatabase({ updateMany, findUniqueOrThrow }), fakeAlgorand({ sendRefund }));

    const result = await service.attemptProcessing(alreadyConfirmed.id, 'testnet', 'mnemonic words here');

    expect(result).toBe(alreadyConfirmed);
    expect(sendRefund).not.toHaveBeenCalled();
  });
});

describe('RefundService.toClientView', () => {
  it('reports "refunded" with the transaction id only once CONFIRMED', () => {
    const service = new RefundService(fakeDatabase({}), fakeAlgorand());
    expect(service.toClientView(fakeRefundRow({ status: 'CONFIRMED', refundTransaction: 'TXN' }))).toEqual({
      status: 'refunded',
      refundTransaction: 'TXN',
    });
  });

  it.each(['PENDING', 'PROCESSING', 'SUBMITTED', 'FAILED'])('reports "refund_pending" while %s', (status) => {
    const service = new RefundService(fakeDatabase({}), fakeAlgorand());
    expect(service.toClientView(fakeRefundRow({ status }))).toEqual({ status: 'refund_pending' });
  });
});
