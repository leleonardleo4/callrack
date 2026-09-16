import { describe, expect, it } from 'vitest';
import { BadGatewayException, BadRequestException, GatewayTimeoutException, HttpStatus } from '@nestjs/common';
import { mapProviderErrorToHttpException } from '../../../src/common/errors/provider-error.mapper.js';
import { ApiErrorCode } from '../../../src/common/errors/api-error-codes.js';
import { ProviderError, ProviderErrorCode } from '../../../src/providers/common/index.js';

function providerError(code: ProviderErrorCode): ProviderError {
  return new ProviderError({ code, message: 'boom', providerSlug: 'test.provider' });
}

describe('mapProviderErrorToHttpException', () => {
  it('maps PROVIDER_TIMEOUT to 504', () => {
    const exception = mapProviderErrorToHttpException(providerError(ProviderErrorCode.PROVIDER_TIMEOUT));
    expect(exception).toBeInstanceOf(GatewayTimeoutException);
    expect(exception.getStatus()).toBe(HttpStatus.GATEWAY_TIMEOUT);
    expect((exception.getResponse() as { code: string }).code).toBe(ApiErrorCode.PROVIDER_TIMEOUT);
  });

  it('maps PROVIDER_RATE_LIMITED to 429', () => {
    const exception = mapProviderErrorToHttpException(providerError(ProviderErrorCode.PROVIDER_RATE_LIMITED));
    expect(exception.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect((exception.getResponse() as { code: string }).code).toBe(ApiErrorCode.PROVIDER_RATE_LIMITED);
  });

  it('maps PROVIDER_INVALID_REQUEST to 400', () => {
    const exception = mapProviderErrorToHttpException(providerError(ProviderErrorCode.PROVIDER_INVALID_REQUEST));
    expect(exception).toBeInstanceOf(BadRequestException);
    expect((exception.getResponse() as { code: string }).code).toBe(ApiErrorCode.INVALID_REQUEST);
  });

  it.each([
    ProviderErrorCode.PROVIDER_UNAVAILABLE,
    ProviderErrorCode.PROVIDER_AUTHENTICATION_FAILED,
    ProviderErrorCode.PROVIDER_BAD_RESPONSE,
    ProviderErrorCode.PROVIDER_UNKNOWN_ERROR,
  ])('maps %s to 502 without leaking the underlying cause', (code) => {
    const exception = mapProviderErrorToHttpException(providerError(code));
    expect(exception).toBeInstanceOf(BadGatewayException);
    const response = exception.getResponse() as { code: string; message: string };
    expect(response.code).toBe(ApiErrorCode.PROVIDER_UNAVAILABLE);
    expect(response.message).not.toContain('boom');
  });
});
