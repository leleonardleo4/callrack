import type { SystemHealthStatus } from '@callrack/types';

export interface CallrackOptions {
  baseUrl?: string;
  apiKey?: string;
}

export class CallrackClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor(options: CallrackOptions = {}) {
    this.baseUrl = options.baseUrl ?? 'http://localhost:3000';
    this.apiKey = options.apiKey;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public async getHealth(): Promise<SystemHealthStatus> {
    return {
      status: 'ok',
      service: 'api',
      version: '0.1.0',
      uptime: 0,
      timestamp: new Date().toISOString(),
    };
  }
}
