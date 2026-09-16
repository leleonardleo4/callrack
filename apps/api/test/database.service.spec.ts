import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatabaseService } from '../src/database/database.service.js';

describe('DatabaseService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports healthy when a query succeeds', async () => {
    const service = new DatabaseService();
    vi.spyOn(service.client, '$queryRaw').mockResolvedValue([{ '?column?': 1 }]);

    expect(await service.isHealthy()).toBe(true);
  });

  it('reports unhealthy when the query throws', async () => {
    const service = new DatabaseService();
    vi.spyOn(service.client, '$queryRaw').mockRejectedValue(new Error('connection refused'));

    expect(await service.isHealthy()).toBe(false);
  });

  it('does not throw during onModuleInit even if the connection fails', async () => {
    const service = new DatabaseService();
    vi.spyOn(service.client, '$connect').mockRejectedValue(new Error('connection refused'));

    await expect(service.onModuleInit()).resolves.toBeUndefined();
  });

  it('disconnects cleanly on module destroy', async () => {
    const service = new DatabaseService();
    const disconnectSpy = vi.spyOn(service.client, '$disconnect').mockResolvedValue(undefined);

    await service.onModuleDestroy();

    expect(disconnectSpy).toHaveBeenCalledOnce();
  });
});
