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
import { mapGNewsSearchResponse } from './gnews.mapper.js';
import type { GNewsSearchResponse } from './gnews.types.js';
import { FALLBACK_PROVIDER_RETRY, FALLBACK_PROVIDER_TIMEOUT_MS } from '../news.provider.constants.js';

const PROVIDER_SLUG = 'news.gnews';

@Injectable()
export class GNewsProvider extends BaseProviderAdapter implements NewsSearchProvider {
  readonly metadata: ProviderMetadata = defineProviderMetadata({
    slug: PROVIDER_SLUG,
    name: 'GNews',
    description: 'Global news search, used as a fallback when news.gdelt is unavailable or rate-limited.',
    category: 'news',
    website: 'https://gnews.io',
    attributionRequired: true,
    attributionText: 'News data provided by GNews (gnews.io)',
    license:
      'GNews pricing FAQ: "The Free plan is for non-commercial projects, development and testing only. ' +
      'Commercial and published projects need a paid plan."',
    commercialUse: 'restricted',
  });

  private readonly apiKey: string | undefined;

  constructor(config: ProviderConfigService, @Optional() options?: ProviderAdapterOptions) {
    super(
      new ProviderHttpClient({
        providerSlug: PROVIDER_SLUG,
        baseUrl: 'https://gnews.io/api/v4/',
        timeoutMs: options?.timeoutMs ?? FALLBACK_PROVIDER_TIMEOUT_MS,
        retry: options?.retry ?? FALLBACK_PROVIDER_RETRY,
      }),
    );
    this.apiKey = config.gNewsApiKey;
  }

  get isConfigured(): boolean {
    return !!this.apiKey;
  }

  async search(input: NewsSearchInput): Promise<NewsSearchResult> {
    const raw = await this.http.requestJson<GNewsSearchResponse>({
      path: 'search',
      query: {
        q: input.query,
        max: Math.min(input.limit ?? 10, 10),
        apikey: this.apiKey,
      },
    });
    return mapGNewsSearchResponse(raw);
  }

  protected async probeHealth(): Promise<unknown> {
    return this.http.requestJson({
      path: 'search',
      query: { q: 'health', max: 1, apikey: this.apiKey },
    });
  }
}
