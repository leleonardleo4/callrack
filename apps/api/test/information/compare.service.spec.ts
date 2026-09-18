import { describe, expect, it, vi } from 'vitest';
import { CompareService } from '../../src/information/compare.service.js';
import type { InformationSourceRunnerService } from '../../src/information/information-source-runner.service.js';
import type { CapabilityCacheService } from '../../src/common/cache/index.js';
import type { RequestTrackingService } from '../../src/common/tracking/index.js';
import type { InformationSourceResult } from '../../src/information/information.types.js';
import type { CompareRequestDto } from '../../src/information/dto/compare-request.dto.js';

function fakeRunner(): InformationSourceRunnerService & { run: ReturnType<typeof vi.fn> } {
  return { run: vi.fn() } as unknown as InformationSourceRunnerService & { run: ReturnType<typeof vi.fn> };
}
function fakePassthroughCache(): CapabilityCacheService {
  const store = new Map<string, unknown>();
  return {
    async getOrSet<T>(key: string, _ttl: number, loader: () => Promise<T>) {
      if (store.has(key)) return { value: store.get(key) as T, cacheHit: true };
      const value = await loader();
      store.set(key, value);
      return { value, cacheHit: false };
    },
  } as unknown as CapabilityCacheService;
}
function fakeTracking(): RequestTrackingService & { record: ReturnType<typeof vi.fn> } {
  return { record: vi.fn() } as unknown as RequestTrackingService & { record: ReturnType<typeof vi.fn> };
}
function dto(overrides: Partial<CompareRequestDto> = {}): CompareRequestDto {
  return { query: 'Tesla', ...overrides } as CompareRequestDto;
}
function buildService(runner: ReturnType<typeof fakeRunner>, cache = fakePassthroughCache(), tracking = fakeTracking()) {
  return new CompareService(runner as unknown as InformationSourceRunnerService, cache, tracking as unknown as RequestTrackingService);
}

describe('CompareService', () => {
  it('groups results into subjects, one per distinct title', async () => {
    const runner = fakeRunner();
    const results: InformationSourceResult[] = [
      {
        source: 'knowledge',
        status: 'success',
        evidence: [{ source: { title: 'Tesla, Inc.', url: 'https://wikidata.test/Q1', provider: 'knowledge.search' }, excerpt: 'American EV manufacturer', retrievedAt: '2026-01-15T12:00:00Z' }],
      },
      {
        source: 'news',
        status: 'success',
        evidence: [{ source: { title: 'Tesla stock rises', url: 'https://example.test/a', provider: 'news.search' }, retrievedAt: '2026-01-15T12:00:00Z', data: { country: 'US' } }],
      },
    ];
    runner.run.mockResolvedValue(results);
    const service = buildService(runner);

    const result = await service.compare(dto(), 'req_1');

    expect(result.subjects).toHaveLength(2);
    expect(result.subjects.map((s) => s.name).sort()).toEqual(['Tesla stock rises', 'Tesla, Inc.']);
  });

  it('flattens excerpt and structured data into attribute rows, never fabricating a value', async () => {
    const runner = fakeRunner();
    runner.run.mockResolvedValue([
      {
        source: 'knowledge',
        status: 'success',
        evidence: [{ source: { title: 'Tesla, Inc.', provider: 'knowledge.search' }, excerpt: 'American EV manufacturer', retrievedAt: '2026-01-15T12:00:00Z', data: { id: 'Q1' } }],
      },
    ]);
    const service = buildService(runner);

    const result = await service.compare(dto(), 'req_1');

    expect(result.attributes).toContainEqual({ subject: 'Tesla, Inc.', key: 'excerpt', value: 'American EV manufacturer', provider: 'knowledge.search' });
    expect(result.attributes).toContainEqual({ subject: 'Tesla, Inc.', key: 'id', value: 'Q1', provider: 'knowledge.search' });
  });

  it('returns empty subjects/attributes/disagreements when nothing is found - never fabricates a comparison', async () => {
    const runner = fakeRunner();
    runner.run.mockResolvedValue([
      { source: 'knowledge', status: 'empty', evidence: [] },
      { source: 'news', status: 'empty', evidence: [] },
    ]);
    const service = buildService(runner);

    const result = await service.compare(dto(), 'req_1');

    expect(result.subjects).toEqual([]);
    expect(result.attributes).toEqual([]);
    expect(result.disagreements).toEqual([]);
    expect(result.sources).toEqual([]);
  });

  it('detects a disagreement when two sources describe the same subject differently', async () => {
    const runner = fakeRunner();
    runner.run.mockResolvedValue([
      {
        source: 'knowledge',
        status: 'success',
        evidence: [{ source: { title: 'Tesla, Inc.', provider: 'knowledge.search' }, excerpt: 'American electric vehicle manufacturer', retrievedAt: '2026-01-15T12:00:00Z' }],
      },
      {
        source: 'academic',
        status: 'success',
        evidence: [{ source: { title: 'Tesla, Inc.', provider: 'academic.search' }, excerpt: 'A publicly traded automotive and energy company', retrievedAt: '2026-01-15T12:00:00Z' }],
      },
    ]);
    const service = buildService(runner);

    const result = await service.compare(dto(), 'req_1');

    expect(result.disagreements).toHaveLength(1);
    expect(result.disagreements[0]?.subject).toBe('Tesla, Inc.');
  });

  it('reports which capabilities returned each subject', async () => {
    const runner = fakeRunner();
    runner.run.mockResolvedValue([
      {
        source: 'knowledge',
        status: 'success',
        evidence: [{ source: { title: 'Tesla, Inc.', provider: 'knowledge.search' }, retrievedAt: '2026-01-15T12:00:00Z' }],
      },
    ]);
    const service = buildService(runner);

    const result = await service.compare(dto(), 'req_1');

    expect(result.subjects[0]).toEqual({ name: 'Tesla, Inc.', sources: ['knowledge.search'] });
  });

  it('is a cache miss on the first call and a cache hit on an identical second call', async () => {
    const runner = fakeRunner();
    runner.run.mockResolvedValue([]);
    const tracking = fakeTracking();
    const service = buildService(runner, fakePassthroughCache(), tracking);

    await service.compare(dto(), 'req_1');
    await service.compare(dto(), 'req_2');

    expect(runner.run).toHaveBeenCalledTimes(1);
    expect(tracking.record).toHaveBeenNthCalledWith(1, expect.objectContaining({ cacheHit: false }));
    expect(tracking.record).toHaveBeenNthCalledWith(2, expect.objectContaining({ cacheHit: true }));
  });
});
