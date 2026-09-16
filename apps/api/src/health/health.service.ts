import { Injectable } from '@nestjs/common';
import type { ReadinessStatus, SystemHealthStatus } from '@callrack/types';
import { ApiConfigService } from '../config/api-config.service.js';
import { DatabaseService } from '../database/database.service.js';
import { RedisService } from '../redis/redis.service.js';

@Injectable()
export class HealthService {
  private readonly startTime = Date.now();

  constructor(
    private readonly configService: ApiConfigService,
    private readonly databaseService: DatabaseService,
    private readonly redisService: RedisService,
  ) {}

  getHealth(): SystemHealthStatus {
    return {
      status: 'ok',
      service: this.configService.serviceName,
      version: this.configService.version,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness(): Promise<ReadinessStatus> {
    const [databaseHealthy, redisHealthy] = await Promise.all([
      this.databaseService.isHealthy(),
      this.redisService.isHealthy(),
    ]);

    return {
      status: databaseHealthy && redisHealthy ? 'ok' : 'degraded',
      checks: {
        database: databaseHealthy ? 'ok' : 'down',
        redis: redisHealthy ? 'ok' : 'down',
      },
      timestamp: new Date().toISOString(),
    };
  }
}
