export interface ApiSuccessMeta {
  requestId: string;
  /** Attribution text, populated only when the serving provider requires it. */
  attribution?: string;
  /** Short source identifier, populated for capabilities with a single, named data source. */
  source?: string;
}

export interface ApiSuccessResponse<T> {
  data: T;
  meta: ApiSuccessMeta;
}
