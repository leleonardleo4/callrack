import { Injectable } from '@nestjs/common';
import type { SystemHealthStatus } from '@callrack/types';
import { ApiConfigService } from '../config/api-config.service.js';

@Injectable()
export class HealthService {
  private readonly startTime = Date.now();

  constructor(private readonly configService: ApiConfigService) {}

  getHealth(): SystemHealthStatus {
    return {
      status: 'ok',
      service: this.configService.serviceName,
      version: this.configService.version,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      timestamp: new Date().toISOString(),
    };
  }
}
