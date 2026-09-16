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
        timeoutMs: options?.timeoutMs,
        retry: options?.retry,
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
