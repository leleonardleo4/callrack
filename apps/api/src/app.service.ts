import { Injectable } from '@nestjs/common';
import type { SystemHealthStatus } from '@callrack/types';

@Injectable()
export class AppService {
  private readonly startTime = Date.now();

  getHealth(): SystemHealthStatus {
    return {
      status: 'ok',
      service: 'callrack-api',
      version: '0.1.0',
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      timestamp: new Date().toISOString(),
    };
  }
}
