export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

export interface SystemHealthStatus {
  status: 'ok' | 'degraded' | 'down';
  service: string;
  version: string;
  uptime: number;
  timestamp: string;
}

export interface ReadinessStatus {
  status: 'ok' | 'degraded';
  checks: {
    database: 'ok' | 'down';
    redis: 'ok' | 'down';
  };
  timestamp: string;
}
