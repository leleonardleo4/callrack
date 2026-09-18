/**
 * Lora is the current AlgoKit-maintained Algorand block explorer (the
 * older AlgoExplorer.io is effectively deprecated) - used here only to link
 * to a REAL, already-known transaction id the API returned; never to
 * fabricate or guess a transaction.
 */
export function algorandTransactionExplorerUrl(txId: string, network: 'testnet' | 'mainnet'): string {
  return `https://lora.algokit.io/${network}/transaction/${txId}`;
}
