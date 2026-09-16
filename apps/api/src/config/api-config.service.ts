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

  get corsOrigins(): string[] {
    return this.config.CORS_ORIGIN.split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
  }

  get serviceName(): string {
    return this.config.SERVICE_NAME;
  }

  get version(): string {
    return this.config.API_VERSION;
  }

  get raw(): ApiConfig {
    return this.config;
  }
}
