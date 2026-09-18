import { describe, expect, it } from 'vitest';
import { NetworkId } from '@txnlab/use-wallet-react';
import { toCallrackNetwork, toUseWalletNetworkId } from '@/wallet/network';

describe('wallet/network', () => {
  it('maps Callrack testnet/mainnet to the matching use-wallet NetworkId', () => {
    expect(toUseWalletNetworkId('testnet')).toBe(NetworkId.TESTNET);
    expect(toUseWalletNetworkId('mainnet')).toBe(NetworkId.MAINNET);
  });

  it('maps use-wallet NetworkId back to Callrack testnet/mainnet', () => {
    expect(toCallrackNetwork(NetworkId.TESTNET)).toBe('testnet');
    expect(toCallrackNetwork(NetworkId.MAINNET)).toBe('mainnet');
  });

  it('never invents a third network - an unknown network id maps to undefined, not a guess', () => {
    expect(toCallrackNetwork('betanet')).toBeUndefined();
    expect(toCallrackNetwork('localnet')).toBeUndefined();
  });
});
