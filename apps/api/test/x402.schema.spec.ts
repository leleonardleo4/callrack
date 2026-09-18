import { describe, expect, it } from 'vitest';
import { validateX402Config } from '../src/config/x402.schema.js';

const VALID_TESTNET_ADDR = 'TTCZHJ24VWV64DMFCXKHS2GMLFVUTBA673THZR7LNYY3GEB3XV7HNUEQXQ';
const VALID_MAINNET_ADDR = 'V4BOVWHAQJUNZAPU4D7B4N2ALHVMHBRJ2F75EJG5E5XS5JFJZGAU4SS2UA';
const FACILITATOR_URL = 'https://facilitator.goplausible.xyz';

const VALID_ENV: Record<string, string> = {
  NETWORK: 'testnet',
  TESTNET_PAY_TO: VALID_TESTNET_ADDR,
  MAINNET_PAY_TO: VALID_MAINNET_ADDR,
  TESTNET_FACILITATOR_URL: FACILITATOR_URL,
  MAINNET_FACILITATOR_URL: FACILITATOR_URL,
};

describe('validateX402Config', () => {
  it('accepts a fully valid testnet configuration', () => {
    const config = validateX402Config(VALID_ENV);
    expect(config.NETWORK).toBe('testnet');
    expect(config.TESTNET_PAY_TO).toBe(VALID_TESTNET_ADDR);
  });

  it('accepts a fully valid mainnet configuration', () => {
    const config = validateX402Config({ ...VALID_ENV, NETWORK: 'mainnet' });
    expect(config.NETWORK).toBe('mainnet');
  });

  it('only requires the active network\'s PAY_TO / FACILITATOR_URL, not the other network\'s', () => {
    const { MAINNET_PAY_TO, MAINNET_FACILITATOR_URL, ...testnetOnly } = VALID_ENV;
    expect(() => validateX402Config(testnetOnly)).not.toThrow();
  });

  it('rejects an unsupported network value', () => {
    expect(() => validateX402Config({ ...VALID_ENV, NETWORK: 'devnet' })).toThrow(
      /Callrack x402 configuration validation failed/,
    );
  });

  it('rejects a missing NETWORK entirely', () => {
    const { NETWORK, ...rest } = VALID_ENV;
    expect(() => validateX402Config(rest)).toThrow(/Callrack x402 configuration validation failed/);
  });

  it('rejects NETWORK=testnet with a missing TESTNET_PAY_TO', () => {
    const { TESTNET_PAY_TO, ...rest } = VALID_ENV;
    expect(() => validateX402Config(rest)).toThrow(/TESTNET_PAY_TO is required/);
  });

  it('rejects NETWORK=mainnet with a missing MAINNET_PAY_TO', () => {
    const { MAINNET_PAY_TO, ...rest } = VALID_ENV;
    expect(() => validateX402Config({ ...rest, NETWORK: 'mainnet' })).toThrow(/MAINNET_PAY_TO is required/);
  });

  it('rejects a structurally invalid Algorand payTo address', () => {
    expect(() => validateX402Config({ ...VALID_ENV, TESTNET_PAY_TO: 'not-an-address' })).toThrow(
      /TESTNET_PAY_TO must be a structurally valid Algorand address/,
    );
  });

  it('rejects a payTo that is the right length but fails checksum', () => {
    const almostValid = VALID_TESTNET_ADDR.slice(0, -1) + (VALID_TESTNET_ADDR.endsWith('A') ? 'B' : 'A');
    expect(() => validateX402Config({ ...VALID_ENV, TESTNET_PAY_TO: almostValid })).toThrow(
      /TESTNET_PAY_TO must be a structurally valid Algorand address/,
    );
  });

  it('rejects a missing facilitator URL for the active network', () => {
    const { TESTNET_FACILITATOR_URL, ...rest } = VALID_ENV;
    expect(() => validateX402Config(rest)).toThrow(/TESTNET_FACILITATOR_URL is required/);
  });

  it('rejects a malformed facilitator URL', () => {
    expect(() => validateX402Config({ ...VALID_ENV, TESTNET_FACILITATOR_URL: 'not a url' })).toThrow(
      /TESTNET_FACILITATOR_URL must be a valid URL/,
    );
  });

  it('rejects MAINNET_PAY_TO equal to TESTNET_PAY_TO on a mainnet deployment', () => {
    expect(() =>
      validateX402Config({ ...VALID_ENV, NETWORK: 'mainnet', MAINNET_PAY_TO: VALID_TESTNET_ADDR }),
    ).toThrow(/MAINNET_PAY_TO must not be the same address as TESTNET_PAY_TO/);
  });

  it('allows MAINNET_PAY_TO equal to TESTNET_PAY_TO when NETWORK=testnet (not the deployment that would spend it)', () => {
    expect(() => validateX402Config({ ...VALID_ENV, NETWORK: 'testnet', MAINNET_PAY_TO: VALID_TESTNET_ADDR })).not.toThrow();
  });

  it('does not silently default a missing network selection', () => {
    let thrown = false;
    try {
      validateX402Config({});
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
  });
});
