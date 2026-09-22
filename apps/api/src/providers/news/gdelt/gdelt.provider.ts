import { Injectable, Optional } from '@nestjs/common';
import {
  BaseProviderAdapter,
  defineProviderMetadata,
  ProviderHttpClient,
  type ProviderAdapterOptions,
  type ProviderMetadata,
} from '../../common/index.js';
import type { NewsProvider, NewsSearchInput, NewsSearchResult, NewsTrendsInput, NewsTrendsResult } from '../news.types.js';
import { mapGdeltSearchResponse, mapGdeltTrends } from './gdelt.mapper.js';
import type { GdeltArticleListResponse, GdeltTimelineResponse } from './gdelt.types.js';

const PROVIDER_SLUG = 'news.gdelt';

/**
 * Tighter than ProviderHttpClient's own 10s/2-retries default, for the
 * same reason as academic/openalex.provider.ts's OPENALEX_TIMEOUT_MS: a
 * single slow provider on the ProviderHttpClient default (up to ~30s
 * worst case across 3 attempts) can push /v1/compare, /v1/evidence, and
 * friends past the ~30-40s validity window of the x402 payment
 * transaction the client already signed, causing settlement to fail
 * ("txn dead") even though the capability computed a correct result.
 * GDELT has no fallback provider (unlike academic's OpenAlex->Crossref
 * chain), so it keeps one retry rather than zero - real-world testing
 * showed GDELT can be slow to respond even though DNS/TCP/TLS connect
 * fine (not a network-reachability failure, a genuinely slow response).
 */
const GDELT_TIMEOUT_MS = 6_000;
const GDELT_RETRY = { maxAttempts: 1 } as const;

@Injectable()
export class GdeltProvider extends BaseProviderAdapter implements NewsProvider {
  readonly metadata: ProviderMetadata = defineProviderMetadata({
    slug: PROVIDER_SLUG,
    name: 'GDELT',
    description: 'Global Database of Events, Language, and Tone - worldwide news monitoring.',
    category: 'news',
    website: 'https://www.gdeltproject.org',
    attributionRequired: true,
    attributionText: 'News data provided by the GDELT Project (gdeltproject.org)',
    license: 'Free for academic/research and most other uses; see GDELT terms',
    commercialUse: 'unknown',
  });

  constructor(@Optional() options?: ProviderAdapterOptions) {
    super(
      new ProviderHttpClient({
        providerSlug: PROVIDER_SLUG,
        baseUrl: 'https://api.gdeltproject.org/api/v2/doc/',
        timeoutMs: options?.timeoutMs ?? GDELT_TIMEOUT_MS,
        retry: options?.retry ?? GDELT_RETRY,
      }),
    );
  }

  async search(input: NewsSearchInput): Promise<NewsSearchResult> {
    const raw = await this.http.requestJson<GdeltArticleListResponse>({
      path: 'doc',
      query: {
        query: input.query,
        mode: 'artlist',
        format: 'json',
        maxrecords: input.limit ?? 20,
      },
    });
    return mapGdeltSearchResponse(raw);
  }

  async getTrends(input: NewsTrendsInput): Promise<NewsTrendsResult> {
    const raw = await this.http.requestJson<GdeltTimelineResponse>({
      path: 'doc',
      query: {
        query: input.query,
        mode: 'timelinevol',
        format: 'json',
        timespan: input.timespan ?? '7d',
      },
    });
    return mapGdeltTrends(raw, input.query);
  }

  protected async probeHealth(): Promise<unknown> {
    return this.http.requestJson({
      path: 'doc',
      query: { query: 'health', mode: 'artlist', format: 'json', maxrecords: 1 },
    });
  }
}
