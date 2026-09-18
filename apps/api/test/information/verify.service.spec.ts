import { describe, expect, it, vi } from 'vitest';
import { VerifyService } from '../../src/information/verify.service.js';
import type { InformationSourceRunnerService } from '../../src/information/information-source-runner.service.js';
import type { CapabilityCacheService } from '../../src/common/cache/index.js';
import type { RequestTrackingService } from '../../src/common/tracking/index.js';
import type { InformationSourceResult } from '../../src/information/information.types.js';
import type { VerifyRequestDto } from '../../src/information/dto/verify-request.dto.js';

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

function dto(overrides: Partial<VerifyRequestDto> = {}): VerifyRequestDto {
  return { claim: 'Nigeria is the most populous country in Africa.', ...overrides } as VerifyRequestDto;
}

function buildService(runner: ReturnType<typeof fakeRunner>, cache = fakePassthroughCache(), tracking = fakeTracking()) {
  return new VerifyService(runner as unknown as InformationSourceRunnerService, cache, tracking as unknown as RequestTrackingService);
}

function affirmingResult(source: 'academic' | 'news' | 'knowledge'): InformationSourceResult {
  return {
    source,
    status: 'success',
    evidence: [
      {
        source: { title: 'Nigeria population report', provider: `${source}.search` },
        excerpt: 'Nigeria has the largest population in Africa, with over 200 million people.',
        retrievedAt: '2026-01-15T12:00:00Z',
      },
    ],
  };
}

function contradictingResult(source: 'academic' | 'news' | 'knowledge'): InformationSourceResult {
  return {
    source,
    status: 'success',
    evidence: [
      {
        source: { title: 'Nigeria population claim debunked', provider: `${source}.search` },
        excerpt: 'The claim that Nigeria has the largest population in Africa has been debunked by demographers.',
        retrievedAt: '2026-01-15T12:00:00Z',
      },
    ],
  };
}

function irrelevantResult(source: 'academic' | 'news' | 'knowledge'): InformationSourceResult {
  return {
    source,
    status: 'success',
    evidence: [{ source: { title: 'Weather forecast for Lagos', provider: `${source}.search` }, retrievedAt: '2026-01-15T12:00:00Z' }],
  };
}

describe('VerifyService', () => {
  it('returns "supported" when relevant evidence only affirms the claim', async () => {
    const runner = fakeRunner();
    runner.run.mockResolvedValue([affirmingResult('academic'), affirmingResult('news'), affirmingResult('knowledge')]);
    const service = buildService(runner);

    const result = await service.verify(dto(), 'req_1');

    expect(result.verdict).toBe('supported');
    expect(result.agreementCount).toBe(3);
    expect(result.contradictionCount).toBe(0);
    expect(result.sourcesChecked).toBe(3);
    expect(result.confidence).toBe(1);
    expect(result.evidence).toHaveLength(3);
  });

  it('returns "contradicted" when relevant evidence only denies the claim', async () => {
    const runner = fakeRunner();
    runner.run.mockResolvedValue([contradictingResult('academic'), contradictingResult('news')]);
    const service = buildService(runner);

    const result = await service.verify(dto(), 'req_1');

    expect(result.verdict).toBe('contradicted');
    expect(result.agreementCount).toBe(0);
    expect(result.contradictionCount).toBe(2);
  });

  it('returns "mixed" when some evidence affirms and some denies', async () => {
    const runner = fakeRunner();
    runner.run.mockResolvedValue([affirmingResult('academic'), contradictingResult('news')]);
    const service = buildService(runner);

    const result = await service.verify(dto(), 'req_1');

    expect(result.verdict).toBe('mixed');
    expect(result.agreementCount).toBe(1);
    expect(result.contradictionCount).toBe(1);
    expect(result.confidence).toBe(0.5);
  });

  it('returns "insufficient" when nothing relevant was found - never fabricates a verdict', async () => {
    const runner = fakeRunner();
    runner.run.mockResolvedValue([irrelevantResult('academic'), irrelevantResult('news')]);
    const service = buildService(runner);

    const result = await service.verify(dto(), 'req_1');

    expect(result.verdict).toBe('insufficient');
    expect(result.sourcesChecked).toBe(0);
    expect(result.confidence).toBe(0);
  });

  it('returns "insufficient" when every source is empty', async () => {
    const runner = fakeRunner();
    runner.run.mockResolvedValue([
      { source: 'academic', status: 'empty', evidence: [] },
      { source: 'news', status: 'empty', evidence: [] },
    ]);
    const service = buildService(runner);

    const result = await service.verify(dto(), 'req_1');

    expect(result.verdict).toBe('insufficient');
    expect(result.evidence).toEqual([]);
  });

  it('tolerates a failed source and still verifies from the sources that succeeded', async () => {
    const runner = fakeRunner();
    runner.run.mockResolvedValue([
      affirmingResult('academic'),
      { source: 'news', status: 'failed', evidence: [], error: { code: 'PROVIDER_UNAVAILABLE', message: 'down' } },
    ]);
    const service = buildService(runner);

    const result = await service.verify(dto(), 'req_1');

    expect(result.verdict).toBe('supported');
    expect(result.sourcesChecked).toBe(1);
  });

  it('defaults to academic + news + knowledge when sourceTypes is omitted', async () => {
    const runner = fakeRunner();
    runner.run.mockResolvedValue([]);
    const service = buildService(runner);

    await service.verify(dto(), 'req_1');

    expect(runner.run).toHaveBeenCalledWith(expect.arrayContaining(['academic', 'news', 'knowledge']), expect.any(String), expect.any(Number), 'req_1');
  });

  it('respects an explicit sourceTypes selection', async () => {
    const runner = fakeRunner();
    runner.run.mockResolvedValue([]);
    const service = buildService(runner);

    await service.verify(dto({ sourceTypes: ['news'] }), 'req_1');

    expect(runner.run).toHaveBeenCalledWith(['news'], expect.any(String), expect.any(Number), 'req_1');
  });

  it('caps returned evidence at maxSources', async () => {
    const runner = fakeRunner();
    runner.run.mockResolvedValue([
      {
        source: 'academic',
        status: 'success',
        evidence: Array.from({ length: 10 }, (_, i) => ({
          source: { title: `Nigeria population report ${i}`, provider: 'academic.search' },
          excerpt: 'Nigeria has the largest population in Africa.',
          retrievedAt: '2026-01-15T12:00:00Z',
        })),
      },
    ]);
    const service = buildService(runner);

    const result = await service.verify(dto({ maxSources: 3 }), 'req_1');

    expect(result.evidence.length).toBeLessThanOrEqual(3);
  });

  it('is a cache miss on the first call and a cache hit on an identical second call', async () => {
    const runner = fakeRunner();
    runner.run.mockResolvedValue([affirmingResult('academic')]);
    const tracking = fakeTracking();
    const service = buildService(runner, fakePassthroughCache(), tracking);

    await service.verify(dto(), 'req_1');
    await service.verify(dto(), 'req_2');

    expect(runner.run).toHaveBeenCalledTimes(1);
    expect(tracking.record).toHaveBeenNthCalledWith(1, expect.objectContaining({ cacheHit: false }));
    expect(tracking.record).toHaveBeenNthCalledWith(2, expect.objectContaining({ cacheHit: true }));
  });
});
