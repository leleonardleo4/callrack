import { describe, expect, it, vi } from 'vitest';
import { EvidenceService } from '../../src/information/evidence.service.js';
import type { InformationSourceRunnerService } from '../../src/information/information-source-runner.service.js';
import type { CapabilityCacheService } from '../../src/common/cache/index.js';
import type { RequestTrackingService } from '../../src/common/tracking/index.js';
import type { InformationSourceResult } from '../../src/information/information.types.js';
import type { EvidenceRequestDto } from '../../src/information/dto/evidence-request.dto.js';

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
function dto(overrides: Partial<EvidenceRequestDto> = {}): EvidenceRequestDto {
  return { query: 'renewable energy investment in Africa', ...overrides } as EvidenceRequestDto;
}
function buildService(runner: ReturnType<typeof fakeRunner>, cache = fakePassthroughCache(), tracking = fakeTracking()) {
  return new EvidenceService(runner as unknown as InformationSourceRunnerService, cache, tracking as unknown as RequestTrackingService);
}

const NEWS_RESULT: InformationSourceResult = {
  source: 'news',
  status: 'success',
  evidence: [{ source: { title: 'Example headline', url: 'https://example.test/a', provider: 'news.search' }, retrievedAt: '2026-01-15T12:00:00Z', data: { country: 'Nigeria' } }],
};
const KNOWLEDGE_RESULT: InformationSourceResult = {
  source: 'knowledge',
  status: 'success',
  evidence: [{ source: { title: 'Renewable energy', url: 'https://wikidata.test/Q1', provider: 'knowledge.search' }, excerpt: 'energy from renewable sources', retrievedAt: '2026-01-15T12:00:00Z' }],
};

describe('EvidenceService', () => {
  it('returns findings and a deduplicated source list with real provenance', async () => {
    const runner = fakeRunner();
    runner.run.mockResolvedValue([NEWS_RESULT, KNOWLEDGE_RESULT]);
    const service = buildService(runner);

    const result = await service.gather(dto(), 'req_1');

    expect(result.query).toBe('renewable energy investment in Africa');
    expect(result.findings).toHaveLength(2);
    expect(result.sources).toHaveLength(2);
    expect(result.retrievedAt).toEqual(expect.any(String));
  });

  it('returns empty findings/sources rather than a fabricated result when nothing is found', async () => {
    const runner = fakeRunner();
    runner.run.mockResolvedValue([
      { source: 'news', status: 'empty', evidence: [] },
      { source: 'knowledge', status: 'empty', evidence: [] },
    ]);
    const service = buildService(runner);

    const result = await service.gather(dto(), 'req_1');

    expect(result.findings).toEqual([]);
    expect(result.sources).toEqual([]);
  });

  it('tolerates a failed source, returning findings from the sources that succeeded', async () => {
    const runner = fakeRunner();
    runner.run.mockResolvedValue([NEWS_RESULT, { source: 'academic', status: 'failed', evidence: [], error: { code: 'PROVIDER_UNAVAILABLE', message: 'down' } }]);
    const service = buildService(runner);

    const result = await service.gather(dto(), 'req_1');

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.source.provider).toBe('news.search');
  });

  it('respects an explicit sourceTypes selection and a custom limit', async () => {
    const runner = fakeRunner();
    runner.run.mockResolvedValue([NEWS_RESULT]);
    const service = buildService(runner);

    await service.gather(dto({ sourceTypes: ['news'], limit: 3 }), 'req_1');

    expect(runner.run).toHaveBeenCalledWith(['news'], expect.any(String), 3, 'req_1');
  });

  it('is a cache miss on the first call and a cache hit on an identical second call', async () => {
    const runner = fakeRunner();
    runner.run.mockResolvedValue([NEWS_RESULT]);
    const tracking = fakeTracking();
    const service = buildService(runner, fakePassthroughCache(), tracking);

    await service.gather(dto(), 'req_1');
    await service.gather(dto(), 'req_2');

    expect(runner.run).toHaveBeenCalledTimes(1);
    expect(tracking.record).toHaveBeenNthCalledWith(1, expect.objectContaining({ cacheHit: false }));
    expect(tracking.record).toHaveBeenNthCalledWith(2, expect.objectContaining({ cacheHit: true }));
  });
});
