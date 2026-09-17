import { describe, expect, it } from 'vitest';
import { defaultSpendPolicy, selectAcceptablePaymentRequirement } from '../src/spend-policy.js';
import { resolveNetwork } from '../src/network.js';
import { buildPaymentRequired, buildPaymentRequirements } from './fixtures/http.js';

const RESOLVED = resolveNetwork('testnet');
const RESOURCE_URL = 'http://localhost:3000/v1/academic/search';

describe('selectAcceptablePaymentRequirement', () => {
  it('rejects when the server-advertised resource does not match the request the SDK made', () => {
    const paymentRequired = buildPaymentRequired({ resourceUrl: 'https://evil.example/v1/academic/search' });
    const result = selectAcceptablePaymentRequirement({
      paymentRequired,
      expectedResourceUrl: RESOURCE_URL,
      policy: defaultSpendPolicy(RESOLVED),
      usdcDecimals: RESOLVED.usdcDecimals,
    });
    expect(result).toEqual({ ok: false, reason: 'RESOURCE_MISMATCH' });
  });

  it('rejects a requirement on a network the policy does not allow', () => {
    const paymentRequired = buildPaymentRequired({
      resourceUrl: RESOURCE_URL,
      accepts: [buildPaymentRequirements({ network: 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=' })],
    });
    const result = selectAcceptablePaymentRequirement({
      paymentRequired,
      expectedResourceUrl: RESOURCE_URL,
      policy: defaultSpendPolicy(RESOLVED),
      usdcDecimals: RESOLVED.usdcDecimals,
    });
    expect(result).toEqual({ ok: false, reason: 'NO_ACCEPTABLE_PAYMENT_REQUIREMENT' });
  });

  it('rejects a requirement in an asset the policy does not allow', () => {
    const paymentRequired = buildPaymentRequired({
      resourceUrl: RESOURCE_URL,
      accepts: [buildPaymentRequirements({ asset: '999999999' })],
    });
    const result = selectAcceptablePaymentRequirement({
      paymentRequired,
      expectedResourceUrl: RESOURCE_URL,
      policy: defaultSpendPolicy(RESOLVED),
      usdcDecimals: RESOLVED.usdcDecimals,
    });
    expect(result).toEqual({ ok: false, reason: 'NO_ACCEPTABLE_PAYMENT_REQUIREMENT' });
  });

  it('rejects a requirement whose amount exceeds the policy cap', () => {
    const paymentRequired = buildPaymentRequired({
      resourceUrl: RESOURCE_URL,
      // Policy caps at 1.00 USDC (1_000_000 atomic units at 6 decimals).
      accepts: [buildPaymentRequirements({ amount: '2000000' })],
    });
    const result = selectAcceptablePaymentRequirement({
      paymentRequired,
      expectedResourceUrl: RESOURCE_URL,
      policy: defaultSpendPolicy(RESOLVED),
      usdcDecimals: RESOLVED.usdcDecimals,
    });
    expect(result).toEqual({ ok: false, reason: 'NO_ACCEPTABLE_PAYMENT_REQUIREMENT' });
  });

  it('rejects when nothing in accepts uses a recognized scheme', () => {
    const paymentRequired = buildPaymentRequired({
      resourceUrl: RESOURCE_URL,
      accepts: [buildPaymentRequirements({ scheme: 'upto' })],
    });
    const result = selectAcceptablePaymentRequirement({
      paymentRequired,
      expectedResourceUrl: RESOURCE_URL,
      policy: defaultSpendPolicy(RESOLVED),
      usdcDecimals: RESOLVED.usdcDecimals,
    });
    expect(result).toEqual({ ok: false, reason: 'NO_ACCEPTABLE_PAYMENT_REQUIREMENT' });
  });

  it('never assumes accepts[0] is acceptable — picks the first requirement that actually satisfies policy', () => {
    const acceptable = buildPaymentRequirements({ amount: '5000' });
    const paymentRequired = buildPaymentRequired({
      resourceUrl: RESOURCE_URL,
      accepts: [
        buildPaymentRequirements({ network: 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73ktiC1qzkkit8=' }),
        buildPaymentRequirements({ asset: '999999999' }),
        acceptable,
      ],
    });
    const result = selectAcceptablePaymentRequirement({
      paymentRequired,
      expectedResourceUrl: RESOURCE_URL,
      policy: defaultSpendPolicy(RESOLVED),
      usdcDecimals: RESOLVED.usdcDecimals,
    });
    expect(result).toEqual({ ok: true, requirement: acceptable });
  });
});

describe('defaultSpendPolicy', () => {
  it('scopes to exactly the resolved network and its USDC asset, capped at $1.00', () => {
    const policy = defaultSpendPolicy(RESOLVED);
    expect(policy.allowedNetworks).toEqual([RESOLVED.caip2]);
    expect(policy.allowedAssets).toEqual([RESOLVED.usdcAssetId]);
    expect(policy.maxPayment).toBe('1.00');
  });
});
