import { ALGORAND_MAINNET_GENESIS_HASH, ALGORAND_TESTNET_GENESIS_HASH, getDefaultAsset } from '@x402/avm';
import type { Network } from '@x402/core/types';

export type CallrackNetwork = 'testnet' | 'mainnet';

/**
 * @x402/avm exports the Algorand CAIP-2 identifier in two equivalent forms:
 * the short, truncated `ALGORAND_*_CAIP2` constants, and the full genesis
 * hash (`ALGORAND_*_GENESIS_HASH`). Callrack's own resource server
 * (apps/api/src/config/x402-config.service.ts) declares payment
 * requirements using the full genesis-hash form to match what the
 * GoPlausible facilitator advertises, so the SDK's client-side scheme
 * registration must use the identical form or it will never match a real
 * 402 response's `accepts[].network`.
 */
function toNetwork(genesisHash: string): Network {
  return `algorand:${genesisHash}`;
}

export interface ResolvedNetwork {
  readonly network: CallrackNetwork;
  /** CAIP-2 network identifier - the exact value Callrack's server uses, never hand-rolled. */
  readonly caip2: Network;
  /** The USDC asset id for this network, resolved dynamically via @x402/avm - never a hardcoded literal. */
  readonly usdcAssetId: string;
  readonly usdcDecimals: number;
}

export function resolveNetwork(network: CallrackNetwork): ResolvedNetwork {
  const caip2 = toNetwork(network === 'mainnet' ? ALGORAND_MAINNET_GENESIS_HASH : ALGORAND_TESTNET_GENESIS_HASH);
  const usdc = getDefaultAsset(caip2, 'USDC');
  return {
    network,
    caip2,
    usdcAssetId: usdc.asset,
    usdcDecimals: usdc.decimals,
  };
}
