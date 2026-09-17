export interface ApiSuccessMeta {
  requestId: string;
  /** Attribution text, populated only when the serving provider requires it. */
  attribution?: string;
  /** Short source identifier, populated for capabilities with a single, named data source. */
  source?: string;
  /** Which Callrack capability sources actually ran, populated by composition capabilities. */
  sourcesUsed?: string[];
}

export interface ApiSuccessResponse<T> {
  data: T;
  meta: ApiSuccessMeta;
}
