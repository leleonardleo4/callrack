import { describe, expect, it } from 'vitest';
import { ALGORAND_MAINNET_GENESIS_HASH, ALGORAND_TESTNET_GENESIS_HASH } from '@x402/avm';
import { X402ConfigService } from '../src/config/x402-config.service.js';

const VALID_TESTNET_ADDR = 'TTCZHJ24VWV64DMFCXKHS2GMLFVUTBA673THZR7LNYY3GEB3XV7HNUEQXQ';
const VALID_MAINNET_ADDR = 'V4BOVWHAQJUNZAPU4D7B4N2ALHVMHBRJ2F75EJG5E5XS5JFJZGAU4SS2UA';
const FACILITATOR_URL = 'https://facilitator.goplausible.xyz';
// GoPlausible currently advertises Algorand support using the full
// genesis-hash CAIP-2 form — see x402-config.service.ts's toNetwork() note.
const ALGORAND_TESTNET_CAIP2 = `algorand:${ALGORAND_TESTNET_GENESIS_HASH}`;
const ALGORAND_MAINNET_CAIP2 = `algorand:${ALGORAND_MAINNET_GENESIS_HASH}`;

const VALID_ENV: Record<string, string> = {
  NETWORK: 'testnet',
  TESTNET_PAY_TO: VALID_TESTNET_ADDR,
  MAINNET_PAY_TO: VALID_MAINNET_ADDR,
  TESTNET_FACILITATOR_URL: FACILITATOR_URL,
  MAINNET_FACILITATOR_URL: FACILITATOR_URL,
};

describe('X402ConfigService', () => {
  it('resolves the Testnet CAIP-2 network and payTo when NETWORK=testnet', () => {
    const service = new X402ConfigService(VALID_ENV);
    expect(service.network).toBe('testnet');
    expect(service.caip2Network).toBe(ALGORAND_TESTNET_CAIP2);
    expect(service.payTo).toBe(VALID_TESTNET_ADDR);
    expect(service.facilitatorUrl).toBe(FACILITATOR_URL);
  });

  it('resolves the Mainnet CAIP-2 network and payTo when NETWORK=mainnet', () => {
    const service = new X402ConfigService({ ...VALID_ENV, NETWORK: 'mainnet' });
    expect(service.network).toBe('mainnet');
    expect(service.caip2Network).toBe(ALGORAND_MAINNET_CAIP2);
    expect(service.payTo).toBe(VALID_MAINNET_ADDR);
  });

  it('never resolves Mainnet payTo/network while NETWORK=testnet, even if Mainnet vars are configured', () => {
    const service = new X402ConfigService(VALID_ENV);
    expect(service.payTo).not.toBe(VALID_MAINNET_ADDR);
    expect(service.caip2Network).not.toBe(ALGORAND_MAINNET_CAIP2);
  });

  it('exposes a single activeNetworkConfig bundling everything x402 needs', () => {
    const service = new X402ConfigService(VALID_ENV);
    expect(service.activeNetworkConfig).toEqual({
      network: 'testnet',
      caip2Network: ALGORAND_TESTNET_CAIP2,
      payTo: VALID_TESTNET_ADDR,
      facilitatorUrl: FACILITATOR_URL,
    });
  });

  it('throws at construction for an unsupported network', () => {
    expect(() => new X402ConfigService({ ...VALID_ENV, NETWORK: 'devnet' })).toThrow(
      /Callrack x402 configuration validation failed/,
    );
  });

  it('throws at construction for a missing active payTo', () => {
    const { MAINNET_PAY_TO, ...rest } = VALID_ENV;
    expect(() => new X402ConfigService({ ...rest, NETWORK: 'mainnet' })).toThrow(
      /Callrack x402 configuration validation failed/,
    );
  });

  it('throws at construction for an invalid payTo address', () => {
    expect(() => new X402ConfigService({ ...VALID_ENV, TESTNET_PAY_TO: 'not-an-address' })).toThrow(
      /Callrack x402 configuration validation failed/,
    );
  });

  it('throws at construction for a missing facilitator URL', () => {
    const { TESTNET_FACILITATOR_URL, ...rest } = VALID_ENV;
    expect(() => new X402ConfigService(rest)).toThrow(/Callrack x402 configuration validation failed/);
  });
});
