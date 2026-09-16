import { describe, expect, it, vi } from 'vitest';
import { RequestTrackingService } from '../../../src/common/tracking/request-tracking.service.js';
import type { DatabaseService } from '../../../src/database/database.service.js';

function fakeDatabaseService(overrides: {
  capabilityUpsert?: ReturnType<typeof vi.fn>;
  providerUpsert?: ReturnType<typeof vi.fn>;
  requestCreate?: ReturnType<typeof vi.fn>;
}): DatabaseService {
  return {
    client: {
      capability: { upsert: overrides.capabilityUpsert ?? vi.fn().mockResolvedValue({ id: 'cap-1' }) },
      provider: { upsert: overrides.providerUpsert ?? vi.fn().mockResolvedValue({ id: 'prov-1' }) },
      request: { create: overrides.requestCreate ?? vi.fn().mockResolvedValue({ id: 'req-row-1' }) },
    },
  } as unknown as DatabaseService;
}

describe('RequestTrackingService', () => {
  it('upserts the capability and provider, then creates a request row', async () => {
    const capabilityUpsert = vi.fn().mockResolvedValue({ id: 'cap-1' });
    const providerUpsert = vi.fn().mockResolvedValue({ id: 'prov-1' });
    const requestCreate = vi.fn().mockResolvedValue({ id: 'req-row-1' });
    const database = fakeDatabaseService({ capabilityUpsert, providerUpsert, requestCreate });
    const service = new RequestTrackingService(database);

    service.record({
      requestId: 'req_1',
      endpoint: 'POST /v1/academic/search',
      capabilitySlug: 'academic-search',
      capabilityName: 'Academic Search',
      providerSlug: 'academic.openalex',
      providerName: 'OpenAlex',
      status: 'SUCCESS',
      durationMs: 42,
      cacheHit: false,
    });

    await vi.waitFor(() => expect(requestCreate).toHaveBeenCalled());

    expect(capabilityUpsert).toHaveBeenCalledWith({
      where: { slug: 'academic-search' },
      update: {},
      create: { slug: 'academic-search', name: 'Academic Search' },
    });
    expect(providerUpsert).toHaveBeenCalledWith({
      where: { slug: 'academic.openalex' },
      update: {},
      create: { slug: 'academic.openalex', name: 'OpenAlex' },
    });
    expect(requestCreate).toHaveBeenCalledWith({
      data: {
        requestId: 'req_1',
        endpoint: 'POST /v1/academic/search',
        capabilityId: 'cap-1',
        providerId: 'prov-1',
        status: 'SUCCESS',
        durationMs: 42,
        cacheHit: false,
      },
    });
  });

  it('omits providerId when no provider was used (e.g. a cache hit)', async () => {
    const providerUpsert = vi.fn();
    const requestCreate = vi.fn().mockResolvedValue({ id: 'req-row-1' });
    const database = fakeDatabaseService({ providerUpsert, requestCreate });
    const service = new RequestTrackingService(database);

    service.record({
      requestId: 'req_2',
      endpoint: 'POST /v1/academic/search',
      capabilitySlug: 'academic-search',
      capabilityName: 'Academic Search',
      status: 'SUCCESS',
      durationMs: 5,
      cacheHit: true,
    });

    await vi.waitFor(() => expect(requestCreate).toHaveBeenCalled());

    expect(providerUpsert).not.toHaveBeenCalled();
    expect(requestCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ providerId: undefined }) }),
    );
  });

  it('never throws when the database is unreachable', async () => {
    const requestCreate = vi.fn().mockRejectedValue(new Error('connection refused'));
    const database = fakeDatabaseService({ requestCreate });
    const service = new RequestTrackingService(database);

    expect(() =>
      service.record({
        requestId: 'req_3',
        endpoint: 'POST /v1/news/search',
        capabilitySlug: 'news-search',
        capabilityName: 'News Search',
        status: 'ERROR',
        durationMs: 1,
        cacheHit: false,
      }),
    ).not.toThrow();

    await vi.waitFor(() => expect(requestCreate).toHaveBeenCalled());
  });
});
