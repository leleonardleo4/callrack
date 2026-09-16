import {
  type CallHandler,
  type ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { type Observable, tap } from 'rxjs';
import { RequestContext } from '../request-context/request-context.js';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<FastifyRequest>();
    const res = http.getResponse<FastifyReply>();

    const startTime = Date.now();
    const method = req.method;
    const url = req.url;

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = res.statusCode || 200;
          const requestId = RequestContext.requestId ?? req.id ?? 'unknown';
          this.logger.log(`${method} ${url} → ${statusCode} → ${duration}ms [${requestId}]`);
        },
        error: (error: unknown) => {
          const duration = Date.now() - startTime;
          const statusCode =
            error instanceof HttpException ? error.getStatus() : res.statusCode || 500;
          const requestId = RequestContext.requestId ?? req.id ?? 'unknown';
          this.logger.warn(`${method} ${url} → ${statusCode} → ${duration}ms [${requestId}]`);
        },
      }),
    );
  }
}
