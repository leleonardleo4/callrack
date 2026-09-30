import { Injectable, Optional } from '@nestjs/common';
import {
  BaseProviderAdapter,
  defineProviderMetadata,
  ProviderConfigService,
  ProviderHttpClient,
  type ProviderAdapterOptions,
  type ProviderMetadata,
} from '../../common/index.js';
import type { NewsSearchInput, NewsSearchProvider, NewsSearchResult } from '../news.types.js';
import { mapCurrentsSearchResponse } from './currents.mapper.js';
import type { CurrentsSearchResponse } from './currents.types.js';
import { FALLBACK_PROVIDER_RETRY, FALLBACK_PROVIDER_TIMEOUT_MS } from '../news.provider.constants.js';

const PROVIDER_SLUG = 'news.currents';

@Injectable()
export class CurrentsProvider extends BaseProviderAdapter implements NewsSearchProvider {
  readonly metadata: ProviderMetadata = defineProviderMetadata({
    slug: PROVIDER_SLUG,
    name: 'Currents API',
    description: 'Global news search, used as a fallback when news.gdelt is unavailable or rate-limited.',
    category: 'news',
    website: 'https://currentsapi.services',
    attributionRequired: true,
    attributionText: 'News data provided by Currents API (currentsapi.services)',
    license:
      'Free plan is for technical API access, processing, attribution, and link-out only - long-term caching, ' +
      'resale, or republication requires a separate agreement (currentsapi.services/en/pricing)',
    commercialUse: 'restricted',
  });

  private readonly apiKey: string | undefined;

  constructor(config: ProviderConfigService, @Optional() options?: ProviderAdapterOptions) {
    super(
      new ProviderHttpClient({
        providerSlug: PROVIDER_SLUG,
        baseUrl: 'https://api.currentsapi.services/v1/',
        timeoutMs: options?.timeoutMs ?? FALLBACK_PROVIDER_TIMEOUT_MS,
        retry: options?.retry ?? FALLBACK_PROVIDER_RETRY,
      }),
    );
    this.apiKey = config.currentsApiKey;
  }

  /** NewsService excludes an unconfigured provider from the fallback chain entirely - there is no anonymous tier to fall back to. */
  get isConfigured(): boolean {
    return !!this.apiKey;
  }

  async search(input: NewsSearchInput): Promise<NewsSearchResult> {
    const raw = await this.http.requestJson<CurrentsSearchResponse>({
      path: 'search',
      query: {
        keywords: input.query,
        page_size: Math.min(input.limit ?? 20, 20),
        apiKey: this.apiKey,
      },
    });
    return mapCurrentsSearchResponse(raw);
  }

  protected async probeHealth(): Promise<unknown> {
    return this.http.requestJson({
      path: 'search',
      query: { keywords: 'health', page_size: 1, apiKey: this.apiKey },
    });
  }
}
