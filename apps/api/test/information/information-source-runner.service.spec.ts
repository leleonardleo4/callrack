import { describe, expect, it, vi } from 'vitest';
import { GatewayTimeoutException } from '@nestjs/common';
import { InformationSourceRunnerService } from '../../src/information/information-source-runner.service.js';
import type { AcademicService } from '../../src/academic/academic.service.js';
import type { NewsService } from '../../src/news/news.service.js';
import type { KnowledgeService } from '../../src/knowledge/knowledge.service.js';

function fakeAcademic(): AcademicService & { search: ReturnType<typeof vi.fn> } {
  return { search: vi.fn() } as unknown as AcademicService & { search: ReturnType<typeof vi.fn> };
}
function fakeNews(): NewsService & { search: ReturnType<typeof vi.fn> } {
  return { search: vi.fn() } as unknown as NewsService & { search: ReturnType<typeof vi.fn> };
}
function fakeKnowledge(): KnowledgeService & { search: ReturnType<typeof vi.fn> } {
  return { search: vi.fn() } as unknown as KnowledgeService & { search: ReturnType<typeof vi.fn> };
}

const ACADEMIC_RESULT = {
  results: [{ id: 'w1', title: 'x', authors: [], publicationYear: null, doi: null, url: null, journal: null, citations: null, openAccess: false, source: 'openalex' }],
  meta: { count: 1 },
};
const NEWS_RESULT = { results: [{ title: 'x', url: 'https://example.test', source: null, publishedAt: null, language: null, country: null }] };
const KNOWLEDGE_RESULT = { results: [{ id: 'Q1', name: 'x', description: null, url: 'https://example.test', source: 'wikimedia' }] };

describe('InformationSourceRunnerService', () => {
  it('runs the requested sources and maps each to evidence items', async () => {
    const academic = fakeAcademic();
    academic.search.mockResolvedValue(ACADEMIC_RESULT);
    const news = fakeNews();
    news.search.mockResolvedValue(NEWS_RESULT);
    const knowledge = fakeKnowledge();
    knowledge.search.mockResolvedValue(KNOWLEDGE_RESULT);
    const runner = new InformationSourceRunnerService(academic as unknown as AcademicService, news as unknown as NewsService, knowledge as unknown as KnowledgeService);

    const results = await runner.run(['academic', 'news', 'knowledge'], 'query', 5, 'req_1');

    expect(results).toHaveLength(3);
    expect(results.every((r) => r.status === 'success')).toBe(true);
    expect(results.flatMap((r) => r.evidence)).toHaveLength(3);
  });

  it('marks a source "empty" when it returns no results, without failing the others', async () => {
    const academic = fakeAcademic();
    academic.search.mockResolvedValue({ results: [], meta: { count: 0 } });
    const news = fakeNews();
    news.search.mockResolvedValue(NEWS_RESULT);
    const knowledge = fakeKnowledge();
    const runner = new InformationSourceRunnerService(academic as unknown as AcademicService, news as unknown as NewsService, knowledge as unknown as KnowledgeService);

    const results = await runner.run(['academic', 'news'], 'query', 5, 'req_1');

    expect(results.find((r) => r.source === 'academic')?.status).toBe('empty');
    expect(results.find((r) => r.source === 'news')?.status).toBe('success');
  });

  it('marks a failing source "failed" with a safe error, and does not fail the others', async () => {
    const academic = fakeAcademic();
    academic.search.mockRejectedValue(new GatewayTimeoutException({ code: 'PROVIDER_TIMEOUT', message: 'timed out' }));
    const news = fakeNews();
    news.search.mockResolvedValue(NEWS_RESULT);
    const knowledge = fakeKnowledge();
    const runner = new InformationSourceRunnerService(academic as unknown as AcademicService, news as unknown as NewsService, knowledge as unknown as KnowledgeService);

    const results = await runner.run(['academic', 'news'], 'query', 5, 'req_1');

    const academicResult = results.find((r) => r.source === 'academic');
    expect(academicResult?.status).toBe('failed');
    expect(academicResult?.evidence).toEqual([]);
    expect(academicResult?.error).toEqual({ code: 'PROVIDER_TIMEOUT', message: 'timed out' });
    expect(results.find((r) => r.source === 'news')?.status).toBe('success');
  });

  it('never leaks a raw non-HttpException error message', async () => {
    const academic = fakeAcademic();
    academic.search.mockRejectedValue(new Error('ECONNRESET at 10.0.0.1:5432 password=hunter2'));
    const runner = new InformationSourceRunnerService(
      academic as unknown as AcademicService,
      fakeNews() as unknown as NewsService,
      fakeKnowledge() as unknown as KnowledgeService,
    );

    const [result] = await runner.run(['academic'], 'query', 5, 'req_1');

    expect(result!.error).toEqual({ code: 'SOURCE_UNAVAILABLE', message: 'The source was temporarily unavailable.' });
  });

  it('propagates a distinct sub-request-id per source', async () => {
    const academic = fakeAcademic();
    academic.search.mockResolvedValue(ACADEMIC_RESULT);
    const news = fakeNews();
    news.search.mockResolvedValue(NEWS_RESULT);
    const runner = new InformationSourceRunnerService(academic as unknown as AcademicService, news as unknown as NewsService, fakeKnowledge() as unknown as KnowledgeService);

    await runner.run(['academic', 'news'], 'query', 5, 'req_1');

    expect(academic.search).toHaveBeenCalledWith(expect.anything(), 'req_1:academic');
    expect(news.search).toHaveBeenCalledWith(expect.anything(), 'req_1:news');
  });
});
