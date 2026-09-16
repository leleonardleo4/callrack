import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { SystemHealthStatus } from '@callrack/types';
import { HealthService } from './health.service.js';

@ApiTags('System')
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: 'Health check',
    description: 'Verifies that the Callrack API process is alive and responsive.',
  })
  @ApiResponse({
    status: 200,
    description: 'System is healthy and responsive.',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        service: { type: 'string', example: 'callrack-api' },
        version: { type: 'string', example: '0.1.0' },
        uptime: { type: 'number', example: 123 },
        timestamp: { type: 'string', example: '2026-09-16T19:00:00.000Z' },
      },
    },
  })
  getHealth(): SystemHealthStatus {
    return this.healthService.getHealth();
  }
}
