import { HttpException, Injectable } from '@nestjs/common';
import { AcademicService } from '../academic/academic.service.js';
import { NewsService } from '../news/news.service.js';
import { KnowledgeService } from '../knowledge/knowledge.service.js';
import { academicToEvidence, knowledgeToEvidence, newsToEvidence } from './evidence.util.js';
import type { InformationSourceName } from './information-sources.constants.js';
import type { InformationSourceError, InformationSourceResult } from './information.types.js';

function isErrorPayload(value: unknown): value is { code: string; message: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).code === 'string' &&
    typeof (value as Record<string, unknown>).message === 'string'
  );
}

function toSourceError(error: unknown): InformationSourceError {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (isErrorPayload(response)) {
      return { code: response.code, message: response.message };
    }
    return { code: 'SOURCE_UNAVAILABLE', message: error.message };
  }
  return { code: 'SOURCE_UNAVAILABLE', message: 'The source was temporarily unavailable.' };
}

/**
 * Runs the same set of Callrack capability *services* (never provider
 * adapters, never HTTP) that `research.service.ts` composes, normalizing
 * each into provenance-preserving `EvidenceItem`s. Shared by `verify`,
 * `evidence`, and `compare` so none of them re-implement "call
 * academic/news/knowledge, tolerate one failing, map the result" three
 * separate times.
 */
@Injectable()
export class InformationSourceRunnerService {
  constructor(
    private readonly academic: AcademicService,
    private readonly news: NewsService,
    private readonly knowledge: KnowledgeService,
  ) {}

  async run(
    sources: readonly InformationSourceName[],
    query: string,
    limit: number,
    requestId: string,
  ): Promise<InformationSourceResult[]> {
    return Promise.all(sources.map((source) => this.runOne(source, query, limit, requestId)));
  }

  private async runOne(
    source: InformationSourceName,
    query: string,
    limit: number,
    requestId: string,
  ): Promise<InformationSourceResult> {
    const retrievedAt = new Date().toISOString();
    try {
      switch (source) {
        case 'academic': {
          const data = await this.academic.search({ query, limit }, `${requestId}:academic`);
          return { source, status: data.results.length > 0 ? 'success' : 'empty', evidence: academicToEvidence(data, retrievedAt) };
        }
        case 'news': {
          const data = await this.news.search({ query, limit }, `${requestId}:news`);
          return { source, status: data.results.length > 0 ? 'success' : 'empty', evidence: newsToEvidence(data, retrievedAt) };
        }
        case 'knowledge': {
          const data = await this.knowledge.search({ query, limit }, `${requestId}:knowledge`);
          return { source, status: data.results.length > 0 ? 'success' : 'empty', evidence: knowledgeToEvidence(data, retrievedAt) };
        }
      }
    } catch (error) {
      return { source, status: 'failed', evidence: [], error: toSourceError(error) };
    }
  }
}
