import { Injectable } from '@nestjs/common';
import { buildCacheKey, CACHE_TTL_SECONDS, CapabilityCacheService } from '../common/cache/index.js';
import { RequestTrackingService } from '../common/tracking/index.js';
import { InformationSourceRunnerService } from './information-source-runner.service.js';
import { dedupeSources } from './evidence.util.js';
import { DEFAULT_INFORMATION_SOURCES, type InformationSourceName } from './information-sources.constants.js';
import type { EvidenceRequestDto } from './dto/evidence-request.dto.js';
import type { EvidenceResponseData } from './evidence-response.types.js';

const DEFAULT_LIMIT = 5;

const EVIDENCE_CAPABILITY = {
  slug: 'information.evidence',
  name: 'Evidence',
  endpoint: 'POST /v1/evidence',
};

/**
 * A machine-readable evidence pack, not an AI-generated answer: gathers
 * real results from existing Callrack capabilities (same composition
 * pattern as `ResearchService`/`VerifyService`) and returns them with full
 * provenance — never a narrative summary, never a fact not directly traced
 * to one of the returned `findings`.
 */
@Injectable()
export class EvidenceService {
  constructor(
    private readonly runner: InformationSourceRunnerService,
    private readonly cache: CapabilityCacheService,
    private readonly tracking: RequestTrackingService,
  ) {}

  async gather(dto: EvidenceRequestDto, requestId: string): Promise<EvidenceResponseData> {
    const sourceTypes = this.resolveSourceTypes(dto.sourceTypes);
    const limit = dto.limit ?? DEFAULT_LIMIT;
    const cacheKey = buildCacheKey('evidence', { query: dto.query, sources: [...sourceTypes].sort().join(','), limit });
    const startedAt = Date.now();

    try {
      const { value, cacheHit } = await this.cache.getOrSet(cacheKey, CACHE_TTL_SECONDS.INFORMATION_EVIDENCE, () =>
        this.execute(dto.query, sourceTypes, limit, requestId),
      );

      this.tracking.record({
        requestId,
        endpoint: EVIDENCE_CAPABILITY.endpoint,
        capabilitySlug: EVIDENCE_CAPABILITY.slug,
        capabilityName: EVIDENCE_CAPABILITY.name,
        status: 'SUCCESS',
        durationMs: Date.now() - startedAt,
        cacheHit,
      });

      return value;
    } catch (error) {
      this.tracking.record({
        requestId,
        endpoint: EVIDENCE_CAPABILITY.endpoint,
        capabilitySlug: EVIDENCE_CAPABILITY.slug,
        capabilityName: EVIDENCE_CAPABILITY.name,
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
  ): Promise<EvidenceResponseData> {
    const retrievedAt = new Date().toISOString();
    const results = await this.runner.run(sourceTypes, query, limit, requestId);
    const findings = results.flatMap((result) => result.evidence);
    const sources = dedupeSources(findings);

    return { query, findings, sources, retrievedAt };
  }
}
