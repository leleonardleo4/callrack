import { NetworkId } from '@txnlab/use-wallet-react';
import type { CallrackNetwork } from '@callrack/sdk';
import type { PublicNetworkInfo } from '@/types/capability';

/**
 * Maps Callrack's own network name (as returned by the live
 * `GET /v1/capabilities` response - the single source of truth for which
 * network the API/x402 challenge is on) to use-wallet's `NetworkId`. There
 * is no third, Playground-invented network here: only the two Callrack
 * already supports.
 */
export function toUseWalletNetworkId(network: PublicNetworkInfo['name']): NetworkId {
  return network === 'mainnet' ? NetworkId.MAINNET : NetworkId.TESTNET;
}

/** The inverse of `toUseWalletNetworkId`, for comparing use-wallet's active network back against Callrack's. */
export function toCallrackNetwork(networkId: string): CallrackNetwork | undefined {
  if (networkId === NetworkId.MAINNET) return 'mainnet';
  if (networkId === NetworkId.TESTNET) return 'testnet';
  return undefined;
}
