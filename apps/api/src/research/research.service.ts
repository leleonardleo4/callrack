import { HttpException, Injectable } from '@nestjs/common';
import { buildCacheKey, CACHE_TTL_SECONDS, CapabilityCacheService } from '../common/cache/index.js';
import { RequestTrackingService } from '../common/tracking/index.js';
import { markCapabilityExecutionFailed } from '../common/request-context/capability-outcome.js';
import { AcademicService } from '../academic/academic.service.js';
import { NewsService } from '../news/news.service.js';
import { KnowledgeService } from '../knowledge/knowledge.service.js';
import { CensusService } from '../government/census.service.js';
import { academicToEvidence, detectDisagreements, knowledgeToEvidence, newsToEvidence } from '../information/evidence.util.js';
import type { AcademicSearchResponseData } from '../academic/academic-response.types.js';
import type { NewsSearchResponseData } from '../news/news-response.types.js';
import type { KnowledgeSearchResponseData } from '../knowledge/knowledge-response.types.js';
import type { EvidenceItem } from '../information/information.types.js';
import { planResearch } from './research.planner.js';
import type { ResearchRequestDto } from './dto/research-request.dto.js';
import type { ResearchSourceName } from './research-sources.constants.js';
import type {
  ResearchOverallStatus,
  ResearchResponseData,
  ResearchSourceEntry,
  ResearchSourceError,
  ResearchSourceStatus,
  ResearchSourcesMap,
} from './research-response.types.js';

const DEFAULT_LIMIT = 5;

const RESEARCH_CAPABILITY = {
  slug: 'research',
  name: 'Research',
  endpoint: 'POST /v1/research',
};

function isErrorPayload(value: unknown): value is { code: string; message: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).code === 'string' &&
    typeof (value as Record<string, unknown>).message === 'string'
  );
}

/**
 * Research composes existing capability *services* directly (never HTTP,
 * never provider adapters) - see the module import for confirmation there's
 * no way for this to call itself: "research" isn't a valid source name, and
 * nothing here depends on an HTTP client.
 */
@Injectable()
export class ResearchService {
  constructor(
    private readonly academic: AcademicService,
    private readonly news: NewsService,
    private readonly knowledge: KnowledgeService,
    private readonly census: CensusService,
    private readonly cache: CapabilityCacheService,
    private readonly tracking: RequestTrackingService,
  ) {}

  async research(dto: ResearchRequestDto, requestId: string): Promise<ResearchResponseData> {
    const plan = planResearch(dto);
    const limit = dto.limit ?? DEFAULT_LIMIT;
    const cacheKey = this.buildResearchCacheKey(dto, plan.sources, limit);
    const startedAt = Date.now();

    try {
      const { value, cacheHit } = await this.cache.getOrSet(cacheKey, CACHE_TTL_SECONDS.RESEARCH, () =>
        this.execute(dto, plan.sources, limit, requestId),
      );

      this.tracking.record({
        requestId,
        endpoint: RESEARCH_CAPABILITY.endpoint,
        capabilitySlug: RESEARCH_CAPABILITY.slug,
        capabilityName: RESEARCH_CAPABILITY.name,
        status: 'SUCCESS',
        durationMs: Date.now() - startedAt,
        cacheHit,
      });

      return value;
    } catch (error) {
      this.tracking.record({
        requestId,
        endpoint: RESEARCH_CAPABILITY.endpoint,
        capabilitySlug: RESEARCH_CAPABILITY.slug,
        capabilityName: RESEARCH_CAPABILITY.name,
        status: 'ERROR',
        durationMs: Date.now() - startedAt,
        cacheHit: false,
      });
      throw error;
    }
  }

  /** Every meaningful input that changes the plan/result is folded into the key. */
  private buildResearchCacheKey(dto: ResearchRequestDto, sources: ResearchSourceName[], limit: number): string {
    return buildCacheKey('research', {
      query: dto.query,
      sources: [...sources].sort().join(','),
      limit,
      govDataset: dto.government?.dataset,
      govYear: dto.government?.year,
      govVariables: dto.government ? [...dto.government.variables].sort().join(',') : undefined,
      govGeography: dto.government?.forGeography,
    });
  }

  /** Runs every planned source concurrently - bounded by construction (max 4 known sources). */
  private async execute(
    dto: ResearchRequestDto,
    sources: ResearchSourceName[],
    limit: number,
    requestId: string,
  ): Promise<ResearchResponseData> {
    const retrievedAt = new Date().toISOString();
    const entries = await Promise.all(
      sources.map(async (name) => [name, await this.runOne(name, dto, limit, requestId)] as const),
    );

    const sourcesMap: Partial<Record<ResearchSourceName, ResearchSourceEntry<unknown>>> = {};
    for (const [name, entry] of entries) {
      sourcesMap[name] = entry;
    }

    const findings = this.deriveFindings(entries, retrievedAt);
    const status = this.computeOverallStatus(entries.map(([, entry]) => entry.status));

    // Research's HTTP status stays 200 even here - this always-200 contract
    // is documented and intentional (see the controller's own docs) - but a
    // TOTAL failure (every requested source failed) is still a failed paid
    // execution from Callrack's own contract, distinct from a partial
    // result. This marker is what lets the centralized refund boundary
    // (install-x402-middleware.ts) tell the two apart without either
    // breaking research's status contract or duplicating refund logic here.
    if (status === 'failed') {
      markCapabilityExecutionFailed('All requested research sources failed.');
    }

    return {
      query: dto.query,
      status,
      sources: sourcesMap as ResearchSourcesMap,
      findings,
      disagreements: detectDisagreements(findings),
      composition: {
        sourcesRequested: sources,
        sourcesSucceeded: entries.filter(([, entry]) => entry.status === 'success').map(([name]) => name),
        sourcesEmpty: entries.filter(([, entry]) => entry.status === 'empty').map(([name]) => name),
        sourcesFailed: entries.filter(([, entry]) => entry.status === 'failed').map(([name]) => name),
        retrievedAt,
      },
    };
  }

  /**
   * Normalizes academic/news/knowledge results into provenance-preserving
   * evidence items, reusing the exact same mapping `verify`/`evidence`/
   * `compare` use (`information/evidence.util.ts`) - never a second,
   * divergent normalization. `government`'s tabular row data has no natural
   * title/excerpt shape to normalize into, so it's deliberately excluded
   * here; it remains fully represented in `sources.government`.
   */
  private deriveFindings(
    entries: readonly (readonly [ResearchSourceName, ResearchSourceEntry<unknown>])[],
    retrievedAt: string,
  ): EvidenceItem[] {
    const findings: EvidenceItem[] = [];
    for (const [name, entry] of entries) {
      if (entry.status !== 'success' || !entry.data) continue;
      switch (name) {
        case 'academic':
          findings.push(...academicToEvidence(entry.data as AcademicSearchResponseData, retrievedAt));
          break;
        case 'news':
          findings.push(...newsToEvidence(entry.data as NewsSearchResponseData, retrievedAt));
          break;
        case 'knowledge':
          findings.push(...knowledgeToEvidence(entry.data as KnowledgeSearchResponseData, retrievedAt));
          break;
        case 'government':
          break;
      }
    }
    return findings;
  }

  private async runOne(
    name: ResearchSourceName,
    dto: ResearchRequestDto,
    limit: number,
    requestId: string,
  ): Promise<ResearchSourceEntry<unknown>> {
    switch (name) {
      case 'academic':
        return this.runSource(
          () => this.academic.search({ query: dto.query, limit }, `${requestId}:academic`),
          (data) => data.results.length > 0,
        );
      case 'news':
        return this.runSource(
          () => this.news.search({ query: dto.query, limit }, `${requestId}:news`),
          (data) => data.results.length > 0,
        );
      case 'knowledge':
        return this.runSource(
          () => this.knowledge.search({ query: dto.query, limit }, `${requestId}:knowledge`),
          (data) => data.results.length > 0,
        );
      case 'government': {
        if (!dto.government) {
          return {
            status: 'failed',
            error: {
              code: 'INVALID_REQUEST',
              message: 'The government source requires dataset, year, variables, and forGeography.',
            },
          };
        }
        const government = dto.government;
        return this.runSource(
          () => this.census.query(government, `${requestId}:government`),
          (data) => data.rows.length > 0,
        );
      }
    }
  }

  private async runSource<T>(
    run: () => Promise<T>,
    hasResults: (data: T) => boolean,
  ): Promise<ResearchSourceEntry<T>> {
    try {
      const data = await run();
      return { status: hasResults(data) ? 'success' : 'empty', data };
    } catch (error) {
      return { status: 'failed', error: this.toSourceError(error) };
    }
  }

  private toSourceError(error: unknown): ResearchSourceError {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (isErrorPayload(response)) {
        return { code: response.code, message: response.message };
      }
      return { code: 'SOURCE_UNAVAILABLE', message: error.message };
    }
    return { code: 'SOURCE_UNAVAILABLE', message: 'The source was temporarily unavailable.' };
  }

  private computeOverallStatus(statuses: ResearchSourceStatus[]): ResearchOverallStatus {
    if (statuses.length > 0 && statuses.every((status) => status === 'failed')) {
      return 'failed';
    }
    if (statuses.some((status) => status === 'failed')) {
      return 'partial';
    }
    return 'complete';
  }
}
