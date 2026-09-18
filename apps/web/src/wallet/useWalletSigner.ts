import { useMemo } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import {
  defaultSpendPolicy,
  resolveNetwork,
  type CallrackNetwork,
  type CallrackPaymentSigner,
  type CallrackSpendPolicy,
  type ResolvedNetwork,
} from '@callrack/sdk';
import { createWalletPaymentSigner } from '@/wallet/payment-signer';

export interface WalletPaymentContext {
  readonly signer: CallrackPaymentSigner;
  readonly resolvedNetwork: ResolvedNetwork;
  readonly spendPolicy: CallrackSpendPolicy;
}

/**
 * Builds everything `callCapabilityWithWallet` needs from the currently
 * connected wallet — `undefined` when there is no active account or the
 * live Callrack network isn't known yet, so callers can render a
 * "Connect wallet" affordance instead of attempting to pay.
 *
 * `network` must come from the live `GET /v1/capabilities` response, never
 * a locally invented default — see `wallet/network.ts`.
 */
export function useWalletSigner(network: CallrackNetwork | undefined): WalletPaymentContext | undefined {
  const { activeAddress, signTransactions } = useWallet();

  return useMemo(() => {
    if (!activeAddress || !network) return undefined;
    const resolvedNetwork = resolveNetwork(network);
    return {
      signer: createWalletPaymentSigner({ address: activeAddress, signTransactions }),
      resolvedNetwork,
      spendPolicy: defaultSpendPolicy(resolvedNetwork),
    };
  }, [activeAddress, network, signTransactions]);
}
