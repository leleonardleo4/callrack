import type { ApiErrorCode } from './api-error-codes.js';

export interface ApiErrorPayload {
  code: ApiErrorCode | string;
  message: string;
  details?: unknown;
}

export interface ApiErrorMeta {
  requestId: string;
}

export interface ApiErrorResponse {
  error: ApiErrorPayload;
  meta: ApiErrorMeta;
}
