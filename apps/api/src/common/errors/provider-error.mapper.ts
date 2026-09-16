import { BadGatewayException, BadRequestException, GatewayTimeoutException, HttpException, HttpStatus } from '@nestjs/common';
import { ProviderError, ProviderErrorCode } from '../../providers/common/index.js';
import { ApiErrorCode } from './api-error-codes.js';

/**
 * Translates a normalized provider-layer error into a Callrack API error.
 * Never leaks provider stack traces, credentials, or raw upstream payloads —
 * only a stable code and a safe, generic message.
 */
export function mapProviderErrorToHttpException(error: ProviderError): HttpException {
  switch (error.code) {
    case ProviderErrorCode.PROVIDER_TIMEOUT:
      return new GatewayTimeoutException({
        code: ApiErrorCode.PROVIDER_TIMEOUT,
        message: 'The upstream provider timed out. Please try again.',
      });
    case ProviderErrorCode.PROVIDER_RATE_LIMITED:
      return new HttpException(
        {
          code: ApiErrorCode.PROVIDER_RATE_LIMITED,
          message: 'The upstream provider is rate-limiting requests. Please try again shortly.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    case ProviderErrorCode.PROVIDER_INVALID_REQUEST:
      return new BadRequestException({
        code: ApiErrorCode.INVALID_REQUEST,
        message: 'The upstream provider rejected the request.',
      });
    case ProviderErrorCode.PROVIDER_UNAVAILABLE:
    case ProviderErrorCode.PROVIDER_AUTHENTICATION_FAILED:
    case ProviderErrorCode.PROVIDER_BAD_RESPONSE:
    case ProviderErrorCode.PROVIDER_UNKNOWN_ERROR:
    default:
      return new BadGatewayException({
        code: ApiErrorCode.PROVIDER_UNAVAILABLE,
        message: 'The upstream provider is currently unavailable. Please try again later.',
      });
  }
}
