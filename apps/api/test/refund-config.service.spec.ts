import { describe, expect, it } from 'vitest';
import { RefundConfigService } from '../src/config/refund-config.service.js';
import { X402ConfigService } from '../src/config/x402-config.service.js';

// A throwaway, never-funded Testnet keypair generated solely for this test —
// see the git history for how it was generated (algosdk.generateAccount()).
const TEST_ADDRESS = 'QVZKOLR3AFURUZMJLQVQGCYHZBIX5JPXIJNTD5C74NY5664F6EVJ3MQPQQ';
const TEST_MNEMONIC =
  'obey ostrich program february polar window surprise shrug liberty shaft marriage quality play monitor cover beyond hungry deer purity impose unhappy prevent meadow ability another';

const BASE_X402_ENV = {
  NETWORK: 'testnet' as const,
  TESTNET_FACILITATOR_URL: 'https://facilitator.goplausible.xyz',
  MAINNET_FACILITATOR_URL: 'https://facilitator.goplausible.xyz',
};

describe('RefundConfigService', () => {
  it('is disabled (never throws) when no refund mnemonic is configured at all — most deployments/tests', () => {
    const x402Config = new X402ConfigService({ ...BASE_X402_ENV, TESTNET_PAY_TO: TEST_ADDRESS });
    const service = new RefundConfigService(x402Config, {});

    expect(() => service.onModuleInit()).not.toThrow();
    expect(service.isEnabled).toBe(false);
    expect(() => service.getSignerMnemonicOrThrow()).toThrow(/no refund signer/i);
  });

  it('enables refunds when the mnemonic controls the configured Testnet payTo account', () => {
    const x402Config = new X402ConfigService({ ...BASE_X402_ENV, TESTNET_PAY_TO: TEST_ADDRESS });
    const service = new RefundConfigService(x402Config, { TESTNET_REFUND_MNEMONIC: TEST_MNEMONIC });

    service.onModuleInit();

    expect(service.isEnabled).toBe(true);
    expect(service.merchantAddress).toBe(TEST_ADDRESS);
    expect(service.getSignerMnemonicOrThrow()).toBe(TEST_MNEMONIC);
  });

  it('fails fast at startup when the refund mnemonic does NOT control the configured payTo account', () => {
    const x402Config = new X402ConfigService({
      ...BASE_X402_ENV,
      // A different, unrelated address — the refund signer must never be
      // allowed to run against a payTo it doesn't actually control.
      TESTNET_PAY_TO: 'TTCZHJ24VWV64DMFCXKHS2GMLFVUTBA673THZR7LNYY3GEB3XV7HNUEQXQ',
    });
    const service = new RefundConfigService(x402Config, { TESTNET_REFUND_MNEMONIC: TEST_MNEMONIC });

    expect(() => service.onModuleInit()).toThrow(/does not control the configured payTo/i);
  });

  it('validates only the Mainnet mnemonic when Mainnet is the active network, ignoring an unrelated Testnet mnemonic', () => {
    const x402Config = new X402ConfigService({
      NETWORK: 'mainnet',
      MAINNET_FACILITATOR_URL: 'https://facilitator.goplausible.xyz',
      TESTNET_FACILITATOR_URL: 'https://facilitator.goplausible.xyz',
      MAINNET_PAY_TO: TEST_ADDRESS,
      TESTNET_PAY_TO: 'TTCZHJ24VWV64DMFCXKHS2GMLFVUTBA673THZR7LNYY3GEB3XV7HNUEQXQ',
    });
    // Only a (wrong) TESTNET mnemonic is set — Mainnet has none configured,
    // so this must behave as "disabled", never validate the Testnet one.
    const service = new RefundConfigService(x402Config, { TESTNET_REFUND_MNEMONIC: TEST_MNEMONIC });

    expect(() => service.onModuleInit()).not.toThrow();
    expect(service.isEnabled).toBe(false);
  });
});
