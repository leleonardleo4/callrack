import { Injectable } from '@nestjs/common';
import { buildCacheKey, CACHE_TTL_SECONDS, CapabilityCacheService } from '../common/cache/index.js';
import { RequestTrackingService } from '../common/tracking/index.js';
import { InformationSourceRunnerService } from './information-source-runner.service.js';
import { dedupeSources, detectDisagreements } from './evidence.util.js';
import { DEFAULT_INFORMATION_SOURCES, type InformationSourceName } from './information-sources.constants.js';
import type { CompareRequestDto } from './dto/compare-request.dto.js';
import type { CompareAttributeRow, CompareResponseData, CompareSubject } from './compare-response.types.js';
import type { EvidenceItem } from './information.types.js';

const DEFAULT_LIMIT = 5;

const COMPARE_CAPABILITY = {
  slug: 'information.compare',
  name: 'Compare',
  endpoint: 'POST /v1/compare',
};

/**
 * Structured comparison across whatever distinct subjects the underlying
 * Callrack capabilities actually return for a query (same composition
 * pattern as `ResearchService`/`VerifyService`/`EvidenceService`) — never an
 * invented comparison table. A subject with only one attribute, or zero
 * detected disagreements, is a correct, common result, not a bug: this
 * never fills in a value a provider didn't actually return.
 */
@Injectable()
export class CompareService {
  constructor(
    private readonly runner: InformationSourceRunnerService,
    private readonly cache: CapabilityCacheService,
    private readonly tracking: RequestTrackingService,
  ) {}

  async compare(dto: CompareRequestDto, requestId: string): Promise<CompareResponseData> {
    const sourceTypes = this.resolveSourceTypes(dto.sourceTypes);
    const limit = dto.limit ?? DEFAULT_LIMIT;
    const cacheKey = buildCacheKey('compare', { query: dto.query, sources: [...sourceTypes].sort().join(','), limit });
    const startedAt = Date.now();

    try {
      const { value, cacheHit } = await this.cache.getOrSet(cacheKey, CACHE_TTL_SECONDS.INFORMATION_COMPARE, () =>
        this.execute(dto.query, sourceTypes, limit, requestId),
      );

      this.tracking.record({
        requestId,
        endpoint: COMPARE_CAPABILITY.endpoint,
        capabilitySlug: COMPARE_CAPABILITY.slug,
        capabilityName: COMPARE_CAPABILITY.name,
        status: 'SUCCESS',
        durationMs: Date.now() - startedAt,
        cacheHit,
      });

      return value;
    } catch (error) {
      this.tracking.record({
        requestId,
        endpoint: COMPARE_CAPABILITY.endpoint,
        capabilitySlug: COMPARE_CAPABILITY.slug,
        capabilityName: COMPARE_CAPABILITY.name,
        status: 'ERROR',
        durationMs: Date.now() - startedAt,
        cacheHit: false,
      });
      throw error;
    }
  }

  private resolveSourceTypes(requested: InformationSourceName[] | undefined): InformationSourceName[] {
    return requested && requested.length > 0 ? [...new Set(requested)] : [...DEFAULT_INFORMATION_SOURCES];
  }

  private async execute(
    query: string,
    sourceTypes: InformationSourceName[],
    limit: number,
    requestId: string,
  ): Promise<CompareResponseData> {
    const results = await this.runner.run(sourceTypes, query, limit, requestId);
    const evidence = results.flatMap((result) => result.evidence);

    return {
      query,
      subjects: this.buildSubjects(evidence),
      attributes: this.buildAttributes(evidence),
      sources: dedupeSources(evidence),
      disagreements: detectDisagreements(evidence),
    };
  }

  private buildSubjects(evidence: readonly EvidenceItem[]): CompareSubject[] {
    const byName = new Map<string, Set<string>>();
    for (const item of evidence) {
      const providers = byName.get(item.source.title) ?? new Set<string>();
      providers.add(item.source.provider);
      byName.set(item.source.title, providers);
    }
    return [...byName.entries()].map(([name, providers]) => ({ name, sources: [...providers] }));
  }

  private buildAttributes(evidence: readonly EvidenceItem[]): CompareAttributeRow[] {
    const rows: CompareAttributeRow[] = [];
    for (const item of evidence) {
      if (item.excerpt) {
        rows.push({ subject: item.source.title, key: 'excerpt', value: item.excerpt, provider: item.source.provider });
      }
      if (item.data) {
        for (const [key, value] of Object.entries(item.data)) {
          rows.push({ subject: item.source.title, key, value: String(value), provider: item.source.provider });
        }
      }
    }
    return rows;
  }
}
