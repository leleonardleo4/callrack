import { describe, expect, it } from 'vitest';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';

describe('AppController', () => {
  it('should return health status', () => {
    const service = new AppService();
    const controller = new AppController(service);
    const health = controller.getHealth();

    expect(health.status).toBe('ok');
    expect(health.service).toBe('callrack-api');
  });
});
