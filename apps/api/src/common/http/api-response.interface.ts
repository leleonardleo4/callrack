export interface ApiSuccessMeta {
  requestId: string;
  /** Attribution text, populated only when the serving provider requires it. */
  attribution?: string;
  /** Short source identifier, populated for capabilities with a single, named data source. */
  source?: string;
  /** Which Callrack capability sources actually ran, populated by composition capabilities. */
  sourcesUsed?: string[];
  /** This capability's own registry price - the exact amount an x402 payment for this request actually settled. */
  price?: { amount: string; currency: 'USDC' };
}

export interface ApiSuccessResponse<T> {
  data: T;
  meta: ApiSuccessMeta;
}
