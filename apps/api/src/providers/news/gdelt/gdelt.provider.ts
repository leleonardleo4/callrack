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
        timeoutMs: options?.timeoutMs,
        retry: options?.retry,
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
