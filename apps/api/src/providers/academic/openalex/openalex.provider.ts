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
        timeoutMs: options?.timeoutMs,
        retry: options?.retry,
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
