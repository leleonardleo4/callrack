import { Injectable, Optional } from '@nestjs/common';
import {
  BaseProviderAdapter,
  defineProviderMetadata,
  ProviderConfigService,
  ProviderHttpClient,
  type ProviderAdapterOptions,
  type ProviderMetadata,
} from '../../common/index.js';
import type { GovernmentDatasetResult, GovernmentProvider, GovernmentQueryInput } from '../government.types.js';
import { mapCensusResponse } from './census.mapper.js';
import type { CensusRawResponse } from './census.types.js';

const PROVIDER_SLUG = 'government.census';

@Injectable()
export class CensusProvider extends BaseProviderAdapter implements GovernmentProvider {
  readonly metadata: ProviderMetadata = defineProviderMetadata({
    slug: PROVIDER_SLUG,
    name: 'US Census Bureau',
    description: 'US Census Bureau statistical datasets (e.g. American Community Survey).',
    category: 'government',
    website: 'https://www.census.gov/data/developers.html',
    attributionRequired: true,
    attributionText: 'Data from the U.S. Census Bureau',
    license: 'Public domain (US government work)',
    commercialUse: 'allowed',
  });

  private readonly apiKey: string | undefined;

  constructor(config: ProviderConfigService, @Optional() options?: ProviderAdapterOptions) {
    super(
      new ProviderHttpClient({
        providerSlug: PROVIDER_SLUG,
        baseUrl: 'https://api.census.gov/data/',
        timeoutMs: options?.timeoutMs,
        retry: options?.retry,
      }),
    );
    this.apiKey = config.censusApiKey;
  }

  async query(input: GovernmentQueryInput): Promise<GovernmentDatasetResult> {
    const raw = await this.http.requestJson<CensusRawResponse>({
      path: `${input.year}/${input.dataset}`,
      query: {
        get: input.variables.join(','),
        for: input.forGeography,
        key: this.apiKey,
      },
    });
    return mapCensusResponse(raw, input.dataset);
  }

  protected async probeHealth(): Promise<unknown> {
    return this.http.requestJson({
      path: '2021/acs/acs1',
      query: { get: 'NAME', for: 'state:01', key: this.apiKey },
    });
  }
}
