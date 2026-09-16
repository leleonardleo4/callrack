import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { createRedisClient, RedisCache, type RedisClientType } from '@callrack/redis';
import { ApiConfigService } from '../config/api-config.service.js';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: RedisClientType;

  readonly cache: RedisCache;

  constructor(configService: ApiConfigService) {
    this.client = createRedisClient(configService.raw.REDIS_URL);
    this.cache = new RedisCache(this.client);
    this.client.on('error', (error: Error) => {
      this.logger.warn(`Redis connection error: ${error.message}`);
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error) {
      this.logger.warn(
        `Failed to establish an initial Redis connection: ${(error as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.client.disconnect();
  }

  async isHealthy(): Promise<boolean> {
    try {
      const pong = await this.client.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }

  /** Cheap, synchronous readiness check so callers can skip Redis without waiting on retries. */
  get isReady(): boolean {
    return this.client.status === 'ready';
  }
}
