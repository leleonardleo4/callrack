import { describe, expect, it, vi } from 'vitest';
import { type ArgumentsHost, BadRequestException, NotFoundException } from '@nestjs/common';
import { ApiExceptionFilter } from '../src/common/errors/api-exception.filter.js';
import { ApiErrorCode } from '../src/common/errors/api-error-codes.js';

describe('ApiExceptionFilter', () => {
  function createMockHost(requestId = 'req_mock123') {
    let responseStatus = 200;
    let responseBody: unknown = null;
    const responseHeaders: Record<string, string> = {};

    const mockReply = {
      header: vi.fn((key: string, value: string) => {
        responseHeaders[key] = value;
        return mockReply;
      }),
      status: vi.fn((code: number) => {
        responseStatus = code;
        return mockReply;
      }),
      send: vi.fn((body: unknown) => {
        responseBody = body;
        return mockReply;
      }),
    };

    const mockRequest = {
      id: requestId,
      headers: { 'x-request-id': requestId },
    };

    const mockHost: ArgumentsHost = {
      switchToHttp: () => ({
        getResponse: () => mockReply as any,
        getRequest: () => mockRequest as any,
        getNext: () => vi.fn() as any,
      }),
    } as unknown as ArgumentsHost;

    return {
      host: mockHost,
      mockReply,
      getStatus: () => responseStatus,
      getBody: () => responseBody as any,
      getHeaders: () => responseHeaders,
    };
  }

  it('formats NotFoundException with standard 404 envelope', () => {
    const filter = new ApiExceptionFilter();
    const ctx = createMockHost('req_not_found');

    filter.catch(new NotFoundException('Resource was not found'), ctx.host);

    expect(ctx.getStatus()).toBe(404);
    const body = ctx.getBody();
    expect(body.error.code).toBe(ApiErrorCode.NOT_FOUND);
    expect(body.error.message).toBe('Resource was not found');
    expect(body.meta.requestId).toBe('req_not_found');
    expect(ctx.getHeaders()['X-Request-ID']).toBe('req_not_found');
  });

  it('formats BadRequestException with custom code and details', () => {
    const filter = new ApiExceptionFilter();
    const ctx = createMockHost('req_bad_request');

    filter.catch(
      new BadRequestException({
        code: ApiErrorCode.VALIDATION_ERROR,
        message: 'Request validation failed.',
        details: { fields: { email: ['email must be an email'] } },
      }),
      ctx.host,
    );

    expect(ctx.getStatus()).toBe(400);
    const body = ctx.getBody();
    expect(body.error.code).toBe(ApiErrorCode.VALIDATION_ERROR);
    expect(body.error.details.fields.email).toContain('email must be an email');
    expect(body.meta.requestId).toBe('req_bad_request');
  });

  it('formats unexpected Error as 500 INTERNAL_SERVER_ERROR', () => {
    const filter = new ApiExceptionFilter();
    const ctx = createMockHost('req_internal_err');

    filter.catch(new Error('Database disk full'), ctx.host);

    expect(ctx.getStatus()).toBe(500);
    const body = ctx.getBody();
    expect(body.error.code).toBe(ApiErrorCode.INTERNAL_SERVER_ERROR);
    expect(body.meta.requestId).toBe('req_internal_err');
  });
});
