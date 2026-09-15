import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';
import type { SystemHealthStatus } from '@callrack/types';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth(): SystemHealthStatus {
    return this.appService.getHealth();
  }

  @Get()
  getHello(): { message: string } {
    return { message: 'Callrack API Phase 0 Foundation' };
  }
}
