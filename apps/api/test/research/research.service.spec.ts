import { afterEach, describe, expect, it, vi } from 'vitest';
import { BadGatewayException, GatewayTimeoutException } from '@nestjs/common';
import { ResearchService } from '../../src/research/research.service.js';
import type { AcademicService } from '../../src/academic/academic.service.js';
import type { NewsService } from '../../src/news/news.service.js';
import type { KnowledgeService } from '../../src/knowledge/knowledge.service.js';
import type { CensusService } from '../../src/government/census.service.js';
import type { CapabilityCacheService } from '../../src/common/cache/index.js';
import type { RequestTrackingService } from '../../src/common/tracking/index.js';
import type { ResearchRequestDto } from '../../src/research/dto/research-request.dto.js';

function fakeAcademic(): AcademicService & { search: ReturnType<typeof vi.fn> } {
  return { search: vi.fn() } as unknown as AcademicService & { search: ReturnType<typeof vi.fn> };
}
function fakeNews(): NewsService & { search: ReturnType<typeof vi.fn> } {
  return { search: vi.fn() } as unknown as NewsService & { search: ReturnType<typeof vi.fn> };
}
function fakeKnowledge(): KnowledgeService & { search: ReturnType<typeof vi.fn> } {
  return { search: vi.fn() } as unknown as KnowledgeService & { search: ReturnType<typeof vi.fn> };
}
function fakeCensus(): CensusService & { query: ReturnType<typeof vi.fn> } {
  return { query: vi.fn() } as unknown as CensusService & { query: ReturnType<typeof vi.fn> };
}

function fakePassthroughCache(): CapabilityCacheService {
  const store = new Map<string, unknown>();
  return {
    async getOrSet<T>(key: string, _ttl: number, loader: () => Promise<T>) {
      if (store.has(key)) {
        return { value: store.get(key) as T, cacheHit: true };
      }
      const value = await loader();
      store.set(key, value);
      return { value, cacheHit: false };
    },
  } as unknown as CapabilityCacheService;
}

function fakeTracking(): RequestTrackingService & { record: ReturnType<typeof vi.fn> } {
  return { record: vi.fn() } as unknown as RequestTrackingService & { record: ReturnType<typeof vi.fn> };
}

function dto(overrides: Partial<ResearchRequestDto> = {}): ResearchRequestDto {
  return { query: 'renewable energy investment in Africa', ...overrides } as ResearchRequestDto;
}

function buildService(overrides: {
  academic?: ReturnType<typeof fakeAcademic>;
  news?: ReturnType<typeof fakeNews>;
  knowledge?: ReturnType<typeof fakeKnowledge>;
  census?: ReturnType<typeof fakeCensus>;
  cache?: CapabilityCacheService;
  tracking?: ReturnType<typeof fakeTracking>;
} = {}) {
  return new ResearchService(
    (overrides.academic ?? fakeAcademic()) as unknown as AcademicService,
    (overrides.news ?? fakeNews()) as unknown as NewsService,
    (overrides.knowledge ?? fakeKnowledge()) as unknown as KnowledgeService,
    (overrides.census ?? fakeCensus()) as unknown as CensusService,
    overrides.cache ?? fakePassthroughCache(),
    (overrides.tracking ?? fakeTracking()) as unknown as RequestTrackingService,
  );
}

const ACADEMIC_RESULT = { results: [{ id: 'w1', title: 'x', authors: [], publicationYear: null, doi: null, url: null, journal: null, citations: null, openAccess: false, source: 'openalex' }], meta: { count: 1 } };
const NEWS_RESULT = { results: [{ title: 'x', url: 'https://example.test', source: null, publishedAt: null, language: null, country: null }] };
const KNOWLEDGE_RESULT = { results: [{ id: 'Q1', name: 'x', description: null, url: 'https://example.test', source: 'wikimedia' }] };
const CENSUS_RESULT = { dataset: 'acs/acs1', year: 2021, columns: ['NAME'], rows: [{ NAME: 'California' }] };

describe('ResearchService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('composes the default sources (academic + news + knowledge) and marks the result complete', async () => {
    const academic = fakeAcademic();
    academic.search.mockResolvedValue(ACADEMIC_RESULT);
    const news = fakeNews();
    news.search.mockResolvedValue(NEWS_RESULT);
    const knowledge = fakeKnowledge();
    knowledge.search.mockResolvedValue(KNOWLEDGE_RESULT);
    const census = fakeCensus();
    const service = buildService({ academic, news, knowledge, census });

    const result = await service.research(dto(), 'req_1');

    expect(result.status).toBe('complete');
    expect(result.sources.academic).toEqual({ status: 'success', data: ACADEMIC_RESULT });
    expect(result.sources.news).toEqual({ status: 'success', data: NEWS_RESULT });
    expect(result.sources.knowledge).toEqual({ status: 'success', data: KNOWLEDGE_RESULT });
    expect(result.sources.government).toBeUndefined();
    expect(census.query).not.toHaveBeenCalled();
  });

  it('never calls government by default', async () => {
    const census = fakeCensus();
    const service = buildService({ census });

    await service.research(dto(), 'req_1');

    expect(census.query).not.toHaveBeenCalled();
  });

  it('marks a source "empty" when it succeeds with no results', async () => {
    const academic = fakeAcademic();
    academic.search.mockResolvedValue({ results: [], meta: { count: 0 } });
    const news = fakeNews();
    news.search.mockResolvedValue(NEWS_RESULT);
    const knowledge = fakeKnowledge();
    knowledge.search.mockResolvedValue(KNOWLEDGE_RESULT);
    const service = buildService({ academic, news, knowledge });

    const result = await service.research(dto(), 'req_1');

    expect(result.sources.academic?.status).toBe('empty');
    expect(result.status).toBe('complete');
  });

  it('marks one failing source as "failed" and the overall status as "partial"', async () => {
    const academic = fakeAcademic();
    academic.search.mockResolvedValue(ACADEMIC_RESULT);
    const news = fakeNews();
    news.search.mockResolvedValue(NEWS_RESULT);
    const knowledge = fakeKnowledge();
    knowledge.search.mockRejectedValue(new GatewayTimeoutException({ code: 'PROVIDER_TIMEOUT', message: 'timed out' }));
    const service = buildService({ academic, news, knowledge });

    const result = await service.research(dto(), 'req_1');

    expect(result.status).toBe('partial');
    expect(result.sources.knowledge).toEqual({
      status: 'failed',
      error: { code: 'PROVIDER_TIMEOUT', message: 'timed out' },
    });
    expect(result.sources.academic?.status).toBe('success');
    expect(result.sources.news?.status).toBe('success');
  });

  it('marks the overall status "partial" when multiple (but not all) sources fail', async () => {
    const academic = fakeAcademic();
    academic.search.mockRejectedValue(new BadGatewayException({ code: 'PROVIDER_UNAVAILABLE', message: 'down' }));
    const news = fakeNews();
    news.search.mockRejectedValue(new BadGatewayException({ code: 'PROVIDER_UNAVAILABLE', message: 'down' }));
    const knowledge = fakeKnowledge();
    knowledge.search.mockResolvedValue(KNOWLEDGE_RESULT);
    const service = buildService({ academic, news, knowledge });

    const result = await service.research(dto(), 'req_1');

    expect(result.status).toBe('partial');
    expect(result.sources.academic?.status).toBe('failed');
    expect(result.sources.news?.status).toBe('failed');
    expect(result.sources.knowledge?.status).toBe('success');
  });

  it('marks the overall status "failed" when every requested source fails', async () => {
    const academic = fakeAcademic();
    academic.search.mockRejectedValue(new BadGatewayException({ code: 'PROVIDER_UNAVAILABLE', message: 'down' }));
    const news = fakeNews();
    news.search.mockRejectedValue(new BadGatewayException({ code: 'PROVIDER_UNAVAILABLE', message: 'down' }));
    const knowledge = fakeKnowledge();
    knowledge.search.mockRejectedValue(new BadGatewayException({ code: 'PROVIDER_UNAVAILABLE', message: 'down' }));
    const service = buildService({ academic, news, knowledge });

    const result = await service.research(dto(), 'req_1');

    expect(result.status).toBe('failed');
  });

  it('never leaks a raw non-HttpException error message as a source error', async () => {
    const academic = fakeAcademic();
    academic.search.mockRejectedValue(new Error('ECONNRESET at 10.0.0.1:5432 password=hunter2'));
    const service = buildService({ academic });

    const result = await service.research(dto({ sources: ['academic'] }), 'req_1');

    expect(result.sources.academic).toEqual({
      status: 'failed',
      error: { code: 'SOURCE_UNAVAILABLE', message: 'The source was temporarily unavailable.' },
    });
  });

  it('composes government only when explicitly requested with its required options', async () => {
    const census = fakeCensus();
    census.query.mockResolvedValue(CENSUS_RESULT);
    const service = buildService({ census });

    const result = await service.research(
      dto({
        sources: ['government'],
        government: { dataset: 'acs/acs1', year: 2021, variables: ['NAME'], forGeography: 'state:*' },
      }),
      'req_1',
    );

    expect(result.sources.government).toEqual({ status: 'success', data: CENSUS_RESULT });
    expect(census.query).toHaveBeenCalledWith(
      { dataset: 'acs/acs1', year: 2021, variables: ['NAME'], forGeography: 'state:*' },
      'req_1:government',
    );
  });

  it('fails the government source cleanly if requested without its options', async () => {
    const census = fakeCensus();
    const service = buildService({ census });

    const result = await service.research(dto({ sources: ['government'] }), 'req_1');

    expect(result.sources.government?.status).toBe('failed');
    expect(result.status).toBe('failed');
    expect(census.query).not.toHaveBeenCalled();
  });

  it('propagates a distinct sub-request-id per source (avoids requestId collisions in tracking)', async () => {
    const academic = fakeAcademic();
    academic.search.mockResolvedValue(ACADEMIC_RESULT);
    const news = fakeNews();
    news.search.mockResolvedValue(NEWS_RESULT);
    const knowledge = fakeKnowledge();
    knowledge.search.mockResolvedValue(KNOWLEDGE_RESULT);
    const service = buildService({ academic, news, knowledge });

    await service.research(dto(), 'req_1');

    expect(academic.search).toHaveBeenCalledWith(expect.anything(), 'req_1:academic');
    expect(news.search).toHaveBeenCalledWith(expect.anything(), 'req_1:news');
    expect(knowledge.search).toHaveBeenCalledWith(expect.anything(), 'req_1:knowledge');
  });

  it('runs independent sources concurrently, not sequentially', async () => {
    const order: string[] = [];
    const academic = fakeAcademic();
    academic.search.mockImplementation(async () => {
      order.push('academic:start');
      await new Promise((resolve) => setTimeout(resolve, 20));
      order.push('academic:end');
      return ACADEMIC_RESULT;
    });
    const news = fakeNews();
    news.search.mockImplementation(async () => {
      order.push('news:start');
      await new Promise((resolve) => setTimeout(resolve, 5));
      order.push('news:end');
      return NEWS_RESULT;
    });
    const knowledge = fakeKnowledge();
    knowledge.search.mockResolvedValue(KNOWLEDGE_RESULT);
    const service = buildService({ academic, news, knowledge });

    await service.research(dto(), 'req_1');

    // If these ran sequentially, "news:start" would appear after "academic:end".
    // Concurrent execution means the faster "news" call finishes before "academic".
    expect(order.indexOf('news:end')).toBeLessThan(order.indexOf('academic:end'));
    expect(order.indexOf('news:start')).toBeLessThan(order.indexOf('academic:end'));
  });

  it('is a cache miss on the first call and a cache hit on an identical second call', async () => {
    const academic = fakeAcademic();
    academic.search.mockResolvedValue(ACADEMIC_RESULT);
    const news = fakeNews();
    news.search.mockResolvedValue(NEWS_RESULT);
    const knowledge = fakeKnowledge();
    knowledge.search.mockResolvedValue(KNOWLEDGE_RESULT);
    const tracking = fakeTracking();
    const service = buildService({ academic, news, knowledge, tracking });

    await service.research(dto(), 'req_1');
    await service.research(dto(), 'req_2');

    expect(academic.search).toHaveBeenCalledTimes(1);
    expect(news.search).toHaveBeenCalledTimes(1);
    expect(knowledge.search).toHaveBeenCalledTimes(1);
    expect(tracking.record).toHaveBeenNthCalledWith(1, expect.objectContaining({ cacheHit: false }));
    expect(tracking.record).toHaveBeenNthCalledWith(2, expect.objectContaining({ cacheHit: true }));
  });

  it('produces a different cache key (re-executes) when the query changes', async () => {
    const academic = fakeAcademic();
    academic.search.mockResolvedValue(ACADEMIC_RESULT);
    const news = fakeNews();
    news.search.mockResolvedValue(NEWS_RESULT);
    const knowledge = fakeKnowledge();
    knowledge.search.mockResolvedValue(KNOWLEDGE_RESULT);
    const service = buildService({ academic, news, knowledge });

    await service.research(dto({ query: 'first topic' }), 'req_1');
    await service.research(dto({ query: 'second topic' }), 'req_2');

    expect(academic.search).toHaveBeenCalledTimes(2);
  });

  it('produces a different cache key (re-executes) when sources differ', async () => {
    const academic = fakeAcademic();
    academic.search.mockResolvedValue(ACADEMIC_RESULT);
    const news = fakeNews();
    news.search.mockResolvedValue(NEWS_RESULT);
    const knowledge = fakeKnowledge();
    knowledge.search.mockResolvedValue(KNOWLEDGE_RESULT);
    const service = buildService({ academic, news, knowledge });

    await service.research(dto({ sources: ['academic', 'news'] }), 'req_1');
    await service.research(dto({ sources: ['academic', 'news', 'knowledge'] }), 'req_2');

    expect(academic.search).toHaveBeenCalledTimes(2);
  });

  it('shares a cache entry regardless of requested source order', async () => {
    const academic = fakeAcademic();
    academic.search.mockResolvedValue(ACADEMIC_RESULT);
    const news = fakeNews();
    news.search.mockResolvedValue(NEWS_RESULT);
    const service = buildService({ academic, news });

    await service.research(dto({ sources: ['academic', 'news'] }), 'req_1');
    await service.research(dto({ sources: ['news', 'academic'] }), 'req_2');

    expect(academic.search).toHaveBeenCalledTimes(1);
  });

  it('produces a different cache key (re-executes) when the limit differs', async () => {
    const academic = fakeAcademic();
    academic.search.mockResolvedValue(ACADEMIC_RESULT);
    const news = fakeNews();
    news.search.mockResolvedValue(NEWS_RESULT);
    const knowledge = fakeKnowledge();
    knowledge.search.mockResolvedValue(KNOWLEDGE_RESULT);
    const service = buildService({ academic, news, knowledge });

    await service.research(dto({ limit: 3 }), 'req_1');
    await service.research(dto({ limit: 7 }), 'req_2');

    expect(academic.search).toHaveBeenCalledTimes(2);
  });
});
