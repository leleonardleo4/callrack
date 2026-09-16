import { afterEach, describe, expect, it, vi } from 'vitest';
import { RedisService } from '../src/redis/redis.service.js';
import { ApiConfigService } from '../src/config/api-config.service.js';

function createConfigService(): ApiConfigService {
  return new ApiConfigService({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://callrack:callrack_dev_password@localhost:5432/callrack_test',
    REDIS_URL: 'redis://localhost:6379',
    API_PORT: '3000',
    WEB_PORT: '5173',
  });
}

describe('RedisService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports healthy when ping succeeds', async () => {
    const service = new RedisService(createConfigService());
    const client = (service as unknown as { client: { ping: () => Promise<string> } }).client;
    vi.spyOn(client, 'ping').mockResolvedValue('PONG');

    expect(await service.isHealthy()).toBe(true);
  });

  it('reports unhealthy when ping throws', async () => {
    const service = new RedisService(createConfigService());
    const client = (service as unknown as { client: { ping: () => Promise<string> } }).client;
    vi.spyOn(client, 'ping').mockRejectedValue(new Error('connection refused'));

    expect(await service.isHealthy()).toBe(false);
  });

  it('does not throw during onModuleInit even if the connection fails', async () => {
    const service = new RedisService(createConfigService());
    const client = (service as unknown as { client: { connect: () => Promise<void> } }).client;
    vi.spyOn(client, 'connect').mockRejectedValue(new Error('connection refused'));

    await expect(service.onModuleInit()).resolves.toBeUndefined();
  });

  it('disconnects cleanly on module destroy', async () => {
    const service = new RedisService(createConfigService());
    const client = (service as unknown as { client: { disconnect: () => void } }).client;
    const disconnectSpy = vi.spyOn(client, 'disconnect').mockImplementation(() => undefined);

    await service.onModuleDestroy();

    expect(disconnectSpy).toHaveBeenCalledOnce();
  });
});
