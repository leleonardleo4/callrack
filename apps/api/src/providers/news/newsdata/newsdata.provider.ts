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
import { mapNewsDataSearchResponse } from './newsdata.mapper.js';
import type { NewsDataSearchResponse } from './newsdata.types.js';
import { FALLBACK_PROVIDER_RETRY, FALLBACK_PROVIDER_TIMEOUT_MS } from '../news.provider.constants.js';

const PROVIDER_SLUG = 'news.newsdata';

@Injectable()
export class NewsDataProvider extends BaseProviderAdapter implements NewsSearchProvider {
  readonly metadata: ProviderMetadata = defineProviderMetadata({
    slug: PROVIDER_SLUG,
    name: 'NewsData.io',
    description: 'Global news search, used as a fallback when news.gdelt is unavailable or rate-limited.',
    category: 'news',
    website: 'https://newsdata.io',
    attributionRequired: true,
    attributionText: 'News data provided by NewsData.io',
    license: 'Free-plan commercial-use/redistribution terms could not be confirmed from official documentation - treat as unverified',
    commercialUse: 'unknown',
  });

  private readonly apiKey: string | undefined;

  constructor(config: ProviderConfigService, @Optional() options?: ProviderAdapterOptions) {
    super(
      new ProviderHttpClient({
        providerSlug: PROVIDER_SLUG,
        baseUrl: 'https://newsdata.io/api/1/',
        timeoutMs: options?.timeoutMs ?? FALLBACK_PROVIDER_TIMEOUT_MS,
        retry: options?.retry ?? FALLBACK_PROVIDER_RETRY,
      }),
    );
    this.apiKey = config.newsDataApiKey;
  }

  get isConfigured(): boolean {
    return !!this.apiKey;
  }

  async search(input: NewsSearchInput): Promise<NewsSearchResult> {
    const raw = await this.http.requestJson<NewsDataSearchResponse>({
      path: 'latest',
      query: {
        q: input.query,
        apikey: this.apiKey,
      },
    });
    return mapNewsDataSearchResponse(raw);
  }

  protected async probeHealth(): Promise<unknown> {
    return this.http.requestJson({
      path: 'latest',
      query: { q: 'health', apikey: this.apiKey },
    });
  }
}
