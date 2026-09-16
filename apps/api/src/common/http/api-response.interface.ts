export interface ApiSuccessMeta {
  requestId: string;
  /** Attribution text, populated only when the serving provider requires it. */
  attribution?: string;
}

export interface ApiSuccessResponse<T> {
  data: T;
  meta: ApiSuccessMeta;
}
