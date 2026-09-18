import { Injectable } from '@nestjs/common';
import { buildCacheKey, CACHE_TTL_SECONDS, CapabilityCacheService } from '../common/cache/index.js';
import { RequestTrackingService } from '../common/tracking/index.js';
import { InformationSourceRunnerService } from './information-source-runner.service.js';
import { hasNegationCue, termOverlap, tokenize } from './text-relevance.util.js';
import { DEFAULT_INFORMATION_SOURCES, type InformationSourceName } from './information-sources.constants.js';
import type { VerifyRequestDto } from './dto/verify-request.dto.js';
import type { VerifyResponseData, VerifyVerdict } from './verify-response.types.js';

const DEFAULT_MAX_SOURCES = 12;
/** An evidence item counts as "about the claim" once at least a third of the claim's significant terms appear in its title/excerpt. */
const RELEVANCE_THRESHOLD = 0.34;

const VERIFY_CAPABILITY = {
  slug: 'information.verify',
  name: 'Verify',
  endpoint: 'POST /v1/verify',
};

/**
 * Deterministic, explainable claim verification - never an LLM, never
 * semantic entailment. Gathers real evidence from existing Callrack
 * capabilities (academic/news/knowledge, same composition pattern as
 * `ResearchService`), then classifies each item as relevant-and-affirming,
 * relevant-and-denying, or irrelevant using pure lexical heuristics (see
 * `text-relevance.util.ts`). `verdict`/`confidence` are computed entirely
 * from that count - nothing here writes or infers a fact that isn't
 * directly backed by a returned evidence item.
 */
@Injectable()
export class VerifyService {
  constructor(
    private readonly runner: InformationSourceRunnerService,
    private readonly cache: CapabilityCacheService,
    private readonly tracking: RequestTrackingService,
  ) {}

  async verify(dto: VerifyRequestDto, requestId: string): Promise<VerifyResponseData> {
    const sourceTypes = this.resolveSourceTypes(dto.sourceTypes);
    const maxSources = dto.maxSources ?? DEFAULT_MAX_SOURCES;
    const cacheKey = buildCacheKey('verify', { claim: dto.claim, sources: [...sourceTypes].sort().join(','), maxSources });
    const startedAt = Date.now();

    try {
      const { value, cacheHit } = await this.cache.getOrSet(cacheKey, CACHE_TTL_SECONDS.INFORMATION_VERIFY, () =>
        this.execute(dto.claim, sourceTypes, maxSources, requestId),
      );

      this.tracking.record({
        requestId,
        endpoint: VERIFY_CAPABILITY.endpoint,
        capabilitySlug: VERIFY_CAPABILITY.slug,
        capabilityName: VERIFY_CAPABILITY.name,
        status: 'SUCCESS',
        durationMs: Date.now() - startedAt,
        cacheHit,
      });

      return value;
    } catch (error) {
      this.tracking.record({
        requestId,
        endpoint: VERIFY_CAPABILITY.endpoint,
        capabilitySlug: VERIFY_CAPABILITY.slug,
        capabilityName: VERIFY_CAPABILITY.name,
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
    claim: string,
    sourceTypes: InformationSourceName[],
    maxSources: number,
    requestId: string,
  ): Promise<VerifyResponseData> {
    const perSourceLimit = Math.max(1, Math.ceil(maxSources / sourceTypes.length));
    const results = await this.runner.run(sourceTypes, claim, perSourceLimit, requestId);
    const evidence = results.flatMap((result) => result.evidence).slice(0, maxSources);

    const claimTerms = tokenize(claim);
    let agreementCount = 0;
    let contradictionCount = 0;

    for (const item of evidence) {
      const text = `${item.source.title} ${item.excerpt ?? ''}`;
      if (termOverlap(claimTerms, text) < RELEVANCE_THRESHOLD) continue;
      if (hasNegationCue(text)) {
        contradictionCount += 1;
      } else {
        agreementCount += 1;
      }
    }

    const sourcesChecked = agreementCount + contradictionCount;
    const verdict = this.computeVerdict(sourcesChecked, agreementCount, contradictionCount);
    const confidence = sourcesChecked === 0 ? 0 : Number((Math.max(agreementCount, contradictionCount) / sourcesChecked).toFixed(2));

    return { claim, verdict, confidence, evidence, agreementCount, contradictionCount, sourcesChecked };
  }

  private computeVerdict(sourcesChecked: number, agreementCount: number, contradictionCount: number): VerifyVerdict {
    if (sourcesChecked === 0) return 'insufficient';
    if (contradictionCount === 0) return 'supported';
    if (agreementCount === 0) return 'contradicted';
    return 'mixed';
  }
}
