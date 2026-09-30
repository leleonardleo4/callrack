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
import { mapTheNewsApiSearchResponse } from './thenewsapi.mapper.js';
import type { TheNewsApiSearchResponse } from './thenewsapi.types.js';
import { FALLBACK_PROVIDER_RETRY, FALLBACK_PROVIDER_TIMEOUT_MS } from '../news.provider.constants.js';

const PROVIDER_SLUG = 'news.thenewsapi';

@Injectable()
export class TheNewsApiProvider extends BaseProviderAdapter implements NewsSearchProvider {
  readonly metadata: ProviderMetadata = defineProviderMetadata({
    slug: PROVIDER_SLUG,
    name: 'TheNewsAPI',
    description: 'Global news search, used as a fallback when news.gdelt is unavailable or rate-limited.',
    category: 'news',
    website: 'https://thenewsapi.com',
    attributionRequired: true,
    attributionText: 'News data provided by TheNewsAPI (thenewsapi.com)',
    license:
      'General ToS: "may not be used in connection with any commercial endeavors except those specifically ' +
      'endorsed or approved by us" - commercial use appears to require their prior approval',
    commercialUse: 'restricted',
  });

  private readonly apiToken: string | undefined;

  constructor(config: ProviderConfigService, @Optional() options?: ProviderAdapterOptions) {
    super(
      new ProviderHttpClient({
        providerSlug: PROVIDER_SLUG,
        baseUrl: 'https://api.thenewsapi.com/v1/news/',
        timeoutMs: options?.timeoutMs ?? FALLBACK_PROVIDER_TIMEOUT_MS,
        retry: options?.retry ?? FALLBACK_PROVIDER_RETRY,
      }),
    );
    this.apiToken = config.theNewsApiToken;
  }

  get isConfigured(): boolean {
    return !!this.apiToken;
  }

  async search(input: NewsSearchInput): Promise<NewsSearchResult> {
    const raw = await this.http.requestJson<TheNewsApiSearchResponse>({
      path: 'all',
      query: {
        search: input.query,
        limit: Math.min(input.limit ?? 10, 25),
        api_token: this.apiToken,
      },
    });
    return mapTheNewsApiSearchResponse(raw);
  }

  protected async probeHealth(): Promise<unknown> {
    return this.http.requestJson({
      path: 'all',
      query: { search: 'health', limit: 1, api_token: this.apiToken },
    });
  }
}
