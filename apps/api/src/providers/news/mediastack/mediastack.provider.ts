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
import { mapMediastackSearchResponse } from './mediastack.mapper.js';
import type { MediastackSearchResponse } from './mediastack.types.js';
import { FALLBACK_PROVIDER_RETRY, FALLBACK_PROVIDER_TIMEOUT_MS } from '../news.provider.constants.js';

const PROVIDER_SLUG = 'news.mediastack';

@Injectable()
export class MediastackProvider extends BaseProviderAdapter implements NewsSearchProvider {
  readonly metadata: ProviderMetadata = defineProviderMetadata({
    slug: PROVIDER_SLUG,
    name: 'Mediastack',
    description: 'Global news search, used as a fallback when news.gdelt is unavailable or rate-limited.',
    category: 'news',
    website: 'https://mediastack.com',
    attributionRequired: true,
    attributionText: 'News data provided by mediastack (mediastack.com)',
    license:
      'mediastack ToS (mediastack.com/terms) bars reproducing, distributing, reselling, or sublicensing API ' +
      'data, and limits display to end users\' own personal use - the strictest of Callrack\'s news providers',
    commercialUse: 'restricted',
  });

  private readonly apiKey: string | undefined;

  constructor(config: ProviderConfigService, @Optional() options?: ProviderAdapterOptions) {
    super(
      new ProviderHttpClient({
        providerSlug: PROVIDER_SLUG,
        baseUrl: 'https://api.mediastack.com/v1/',
        timeoutMs: options?.timeoutMs ?? FALLBACK_PROVIDER_TIMEOUT_MS,
        retry: options?.retry ?? FALLBACK_PROVIDER_RETRY,
      }),
    );
    this.apiKey = config.mediastackApiKey;
  }

  get isConfigured(): boolean {
    return !!this.apiKey;
  }

  async search(input: NewsSearchInput): Promise<NewsSearchResult> {
    const raw = await this.http.requestJson<MediastackSearchResponse>({
      path: 'news',
      query: {
        keywords: input.query,
        limit: Math.min(input.limit ?? 25, 100),
        access_key: this.apiKey,
      },
    });
    return mapMediastackSearchResponse(raw);
  }

  protected async probeHealth(): Promise<unknown> {
    return this.http.requestJson({
      path: 'news',
      query: { keywords: 'health', limit: 1, access_key: this.apiKey },
    });
  }
}
