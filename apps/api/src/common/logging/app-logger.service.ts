import { Injectable, type LoggerService } from '@nestjs/common';
import { RequestContext } from '../request-context/request-context.js';

export interface StructuredLogEntry {
  timestamp: string;
  level: string;
  requestId?: string;
  context?: string;
  message: string;
  data?: unknown;
}

@Injectable()
export class AppLoggerService implements LoggerService {
  private readonly isProduction = process.env.NODE_ENV === 'production';

  log(message: string, context?: string): void {
    this.write('info', message, context);
  }

  error(message: string, trace?: string, context?: string): void {
    this.write('error', message, context, trace ? { trace } : undefined);
  }

  warn(message: string, context?: string): void {
    this.write('warn', message, context);
  }

  debug(message: string, context?: string): void {
    if (!this.isProduction) {
      this.write('debug', message, context);
    }
  }

  verbose(message: string, context?: string): void {
    if (!this.isProduction) {
      this.write('verbose', message, context);
    }
  }

  private write(level: string, message: string, context?: string, data?: unknown): void {
    const timestamp = new Date().toISOString();
    const requestId = RequestContext.requestId;

    if (this.isProduction) {
      const entry: StructuredLogEntry = {
        timestamp,
        level,
        ...(requestId ? { requestId } : {}),
        ...(context ? { context } : {}),
        message,
        ...(data ? { data } : {}),
      };
      process.stdout.write(`${JSON.stringify(entry)}\n`);
    } else {
      const reqPart = requestId ? ` [${requestId}]` : '';
      const ctxPart = context ? ` [${context}]` : '';
      process.stdout.write(
        `[${timestamp}] ${level.toUpperCase().padEnd(7)}${ctxPart}${reqPart}: ${message}\n`,
      );
      if (data && typeof data === 'object' && 'trace' in data) {
        process.stderr.write(`${(data as { trace: string }).trace}\n`);
      }
    }
  }
}
