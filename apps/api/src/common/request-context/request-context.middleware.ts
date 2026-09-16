import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { RequestContext } from './request-context.js';
import { REQUEST_ID_RESPONSE_HEADER } from '../http/request-id.util.js';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(
    req: FastifyRequest['raw'] & { id?: string },
    res: FastifyReply['raw'],
    next: () => void,
  ): void {
    const requestId = (req as unknown as { id?: string }).id ?? 'req_unknown';
    res.setHeader(REQUEST_ID_RESPONSE_HEADER, requestId);
    RequestContext.run({ requestId }, () => {
      next();
    });
  }
}
