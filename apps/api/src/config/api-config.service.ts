import { Injectable, Optional } from '@nestjs/common';
import { type ApiConfig, validateApiConfig } from './api-config.schema.js';

@Injectable()
export class ApiConfigService {
  private readonly config: ApiConfig;

  constructor(@Optional() customEnv?: Record<string, string | undefined>) {
    this.config = validateApiConfig(customEnv ?? process.env);
  }

  get nodeEnv(): 'development' | 'test' | 'production' {
    return this.config.NODE_ENV;
  }

  get isProduction(): boolean {
    return this.config.NODE_ENV === 'production';
  }

  get isDevelopment(): boolean {
    return this.config.NODE_ENV === 'development';
  }

  get isTest(): boolean {
    return this.config.NODE_ENV === 'test';
  }

  get port(): number {
    return this.config.API_PORT;
  }

  get apiPrefix(): string {
    return this.config.API_PREFIX;
  }

  get version(): string {
    return this.config.API_VERSION;
  }

  get trustProxy(): boolean {
    return this.config.TRUST_PROXY;
  }

  get bodyLimitBytes(): number {
    return this.config.BODY_LIMIT_BYTES;
  }

  get rateLimitMax(): number {
    return this.config.RATE_LIMIT_MAX;
  }

  get rateLimitWindowMs(): number {
    return this.config.RATE_LIMIT_WINDOW_MS;
  }

  get raw(): ApiConfig {
    return this.config;
  }
}
