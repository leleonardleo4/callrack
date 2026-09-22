import { Injectable, Optional } from '@nestjs/common';
import {
  BaseProviderAdapter,
  defineProviderMetadata,
  ProviderConfigService,
  ProviderError,
  ProviderErrorCode,
  ProviderHttpClient,
  type ProviderAdapterOptions,
  type ProviderMetadata,
} from '../../common/index.js';
import type {
  AcademicProvider,
  AcademicSearchInput,
  AcademicSearchResult,
  AcademicWorkInput,
  AcademicWorkResult,
} from '../academic.types.js';
import { mapCrossrefSearchResponse, mapCrossrefWork } from './crossref.mapper.js';
import type { CrossrefWorkResponse, CrossrefWorksResponse } from './crossref.types.js';

const PROVIDER_SLUG = 'academic.crossref';

/**
 * Tighter than ProviderHttpClient's own 10s/2-retries default, for the
 * same reason as OPENALEX_TIMEOUT_MS/OPENALEX_RETRY in openalex.provider.ts:
 * bound total academic-search latency so /v1/compare, /v1/evidence, and
 * friends leave real headroom for x402 payment settlement before their
 * already-signed transaction's validity window expires. Crossref is the
 * fallback of last resort (no further fallback after it), so it keeps one
 * retry - worth the extra ~6s for a real shot at data OpenAlex couldn't
 * provide - just not OpenAlex's original 2.
 */
const CROSSREF_TIMEOUT_MS = 6_000;
const CROSSREF_RETRY = { maxAttempts: 1 } as const;

@Injectable()
export class CrossrefProvider extends BaseProviderAdapter implements AcademicProvider {
  readonly metadata: ProviderMetadata = defineProviderMetadata({
    slug: PROVIDER_SLUG,
    name: 'Crossref',
    description: 'Scholarly metadata registry for DOI-registered works.',
    category: 'academic',
    website: 'https://www.crossref.org',
    attributionRequired: false,
    license: 'CC0',
    commercialUse: 'allowed',
  });

  private readonly mailto: string | undefined;

  constructor(config: ProviderConfigService, @Optional() options?: ProviderAdapterOptions) {
    super(
      new ProviderHttpClient({
        providerSlug: PROVIDER_SLUG,
        baseUrl: 'https://api.crossref.org',
        timeoutMs: options?.timeoutMs ?? CROSSREF_TIMEOUT_MS,
        retry: options?.retry ?? CROSSREF_RETRY,
      }),
    );
    this.mailto = config.crossrefMailto;
  }

  async searchWorks(input: AcademicSearchInput): Promise<AcademicSearchResult> {
    const raw = await this.http.requestJson<CrossrefWorksResponse>({
      path: 'works',
      query: {
        'query.bibliographic': input.query,
        rows: input.limit ?? 10,
        mailto: this.mailto,
      },
    });
    return mapCrossrefSearchResponse(raw);
  }

  async getWork(input: AcademicWorkInput): Promise<AcademicWorkResult> {
    const raw = await this.http.requestJson<CrossrefWorkResponse>({
      path: `works/${encodeURIComponent(input.id)}`,
      query: { mailto: this.mailto },
    });
    if (!raw?.message) {
      throw new ProviderError({
        code: ProviderErrorCode.PROVIDER_BAD_RESPONSE,
        message: 'Crossref work response is missing "message"',
        providerSlug: PROVIDER_SLUG,
      });
    }
    return { work: mapCrossrefWork(raw.message) };
  }

  protected async probeHealth(): Promise<unknown> {
    return this.http.requestJson({
      path: 'works',
      query: { 'query.bibliographic': 'health', rows: 1, mailto: this.mailto },
    });
  }
}
