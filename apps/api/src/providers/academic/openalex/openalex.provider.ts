import { Injectable, Optional } from '@nestjs/common';
import {
  BaseProviderAdapter,
  defineProviderMetadata,
  ProviderConfigService,
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
import { mapOpenAlexSearchResponse, mapOpenAlexWork } from './openalex.mapper.js';
import type { OpenAlexWork, OpenAlexWorksResponse } from './openalex.types.js';

const PROVIDER_SLUG = 'academic.openalex';

/**
 * Tighter than ProviderHttpClient's own 10s/2-retries default. OpenAlex is
 * the PRIMARY of a fallback chain (see AcademicService.search's
 * runWithFallback(openAlex, crossref)) - when it's slow/unreachable,
 * retrying it 3 times at 10s each (~30s worst case) before ever trying
 * Crossref was measured, via a real settled Testnet payment, to push
 * /v1/compare and /v1/evidence past the ~30-40s validity window of the
 * x402 payment transaction the client already signed - the capability
 * computes a correct result, but the payment can no longer settle
 * ("txn dead") by the time it's attempted. Failing OpenAlex fast and
 * falling through to Crossref keeps total academic-search latency low
 * enough to leave real headroom for payment settlement.
 *
 * No retry here (maxAttempts: 0): OpenAlex is either reachable and fast,
 * or - as observed repeatedly in real testing - reliably slow/unreachable
 * for the whole request, in which case retrying it just burns another 5s
 * before falling through to Crossref anyway. Crossref (the fallback, no
 * further fallback of its own) keeps one retry instead - see
 * crossref.provider.ts.
 */
const OPENALEX_TIMEOUT_MS = 5_000;
const OPENALEX_RETRY = { maxAttempts: 0 } as const;

@Injectable()
export class OpenAlexProvider extends BaseProviderAdapter implements AcademicProvider {
  readonly metadata: ProviderMetadata = defineProviderMetadata({
    slug: PROVIDER_SLUG,
    name: 'OpenAlex',
    description: 'Open catalog of scholarly works, authors, and venues.',
    category: 'academic',
    website: 'https://openalex.org',
    attributionRequired: false,
    license: 'CC0',
    commercialUse: 'allowed',
  });

  private readonly mailto: string | undefined;

  constructor(config: ProviderConfigService, @Optional() options?: ProviderAdapterOptions) {
    super(
      new ProviderHttpClient({
        providerSlug: PROVIDER_SLUG,
        baseUrl: 'https://api.openalex.org',
        timeoutMs: options?.timeoutMs ?? OPENALEX_TIMEOUT_MS,
        retry: options?.retry ?? OPENALEX_RETRY,
      }),
    );
    this.mailto = config.openAlexMailto;
  }

  async searchWorks(input: AcademicSearchInput): Promise<AcademicSearchResult> {
    const raw = await this.http.requestJson<OpenAlexWorksResponse>({
      path: 'works',
      query: {
        search: input.query,
        'per-page': input.limit ?? 10,
        mailto: this.mailto,
      },
    });
    return mapOpenAlexSearchResponse(raw);
  }

  async getWork(input: AcademicWorkInput): Promise<AcademicWorkResult> {
    const path = /^10\./.test(input.id) ? `works/doi:${input.id}` : `works/${input.id}`;
    const raw = await this.http.requestJson<OpenAlexWork>({
      path,
      query: { mailto: this.mailto },
    });
    return { work: mapOpenAlexWork(raw) };
  }

  protected async probeHealth(): Promise<unknown> {
    return this.http.requestJson({
      path: 'works',
      query: { search: 'health', 'per-page': 1, mailto: this.mailto },
    });
  }
}
