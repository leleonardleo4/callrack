import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ApiErrorCode } from './api-error-codes.js';
import type { ApiErrorResponse } from './api-error.interface.js';
import { RequestContext } from '../request-context/request-context.js';
import { REQUEST_ID_RESPONSE_HEADER, resolveRequestId } from '../http/request-id.util.js';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    // 1. Resolve request ID
    const requestId =
      RequestContext.requestId ??
      request?.id ??
      resolveRequestId(request?.headers?.['x-request-id']);

    // Ensure response header carries the Request ID
    response.header(REQUEST_ID_RESPONSE_HEADER, requestId);

    const isProduction = process.env.NODE_ENV === 'production';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = ApiErrorCode.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected internal server error occurred.';
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        code = this.mapStatusToErrorCode(status);
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resObj = exceptionResponse as Record<string, unknown>;

        code = (resObj.code as string) || this.mapStatusToErrorCode(status);
        message =
          (resObj.message as string) ||
          (Array.isArray(resObj.message) ? resObj.message.join('; ') : exception.message);

        if (resObj.details !== undefined) {
          details = resObj.details;
        } else if (Array.isArray(resObj.message)) {
          // Default NestJS ValidationPipe message array
          details = { errors: resObj.message };
        }
      }
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = ApiErrorCode.INTERNAL_SERVER_ERROR;
      message = isProduction ? 'An unexpected internal server error occurred.' : exception.message;
      if (!isProduction) {
        details = { stack: exception.stack };
      }
      this.logger.error(
        `Unhandled Exception [${requestId}]: ${exception.message}`,
        exception.stack,
      );
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = ApiErrorCode.INTERNAL_SERVER_ERROR;
      message = 'An unexpected error occurred.';
      this.logger.error(`Unknown Exception [${requestId}]: ${String(exception)}`);
    }

    const payload: ApiErrorResponse = {
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
      meta: {
        requestId,
      },
    };

    response.status(status).send(payload);
  }

  private mapStatusToErrorCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ApiErrorCode.BAD_REQUEST;
      case HttpStatus.UNAUTHORIZED:
        return ApiErrorCode.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ApiErrorCode.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ApiErrorCode.NOT_FOUND;
      case HttpStatus.METHOD_NOT_ALLOWED:
        return ApiErrorCode.METHOD_NOT_ALLOWED;
      case HttpStatus.CONFLICT:
        return ApiErrorCode.CONFLICT;
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return ApiErrorCode.UNPROCESSABLE_ENTITY;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ApiErrorCode.TOO_MANY_REQUESTS;
      default:
        return ApiErrorCode.INTERNAL_SERVER_ERROR;
    }
  }
}
