import type { ApiErrorCode } from './api-error-codes.js';

export interface ApiErrorPayload {
  code: ApiErrorCode | string;
  message: string;
  details?: unknown;
}

export interface ApiErrorMeta {
  requestId: string;
}

/** Present only on a paid request whose capability failed after settlement succeeded - see RefundOrchestrationService. */
export interface ApiPaymentRefundInfo {
  status: 'refunded' | 'refund_pending';
  refundTransaction?: string;
}

export interface ApiErrorResponse {
  error: ApiErrorPayload;
  meta: ApiErrorMeta;
  payment?: ApiPaymentRefundInfo;
}
