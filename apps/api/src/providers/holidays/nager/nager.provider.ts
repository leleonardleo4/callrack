import { Injectable, Optional } from '@nestjs/common';
import {
  BaseProviderAdapter,
  defineProviderMetadata,
  ProviderHttpClient,
  type ProviderAdapterOptions,
  type ProviderMetadata,
} from '../../common/index.js';
import type { HolidaysInput, HolidaysProvider, HolidaysResult } from '../holidays.types.js';
import { mapNagerHolidaysResponse } from './nager.mapper.js';
import type { NagerHolidaysResponse } from './nager.types.js';

const PROVIDER_SLUG = 'holidays.nager';

@Injectable()
export class NagerProvider extends BaseProviderAdapter implements HolidaysProvider {
  readonly metadata: ProviderMetadata = defineProviderMetadata({
    slug: PROVIDER_SLUG,
    name: 'Nager.Date',
    description: 'Public holiday data by country and year.',
    category: 'holidays',
    website: 'https://date.nager.at',
    attributionRequired: false,
    license: 'MIT',
    commercialUse: 'allowed',
  });

  constructor(@Optional() options?: ProviderAdapterOptions) {
    super(
      new ProviderHttpClient({
        providerSlug: PROVIDER_SLUG,
        baseUrl: 'https://date.nager.at/api/v3/',
        timeoutMs: options?.timeoutMs,
        retry: options?.retry,
      }),
    );
  }

  async getPublicHolidays(input: HolidaysInput): Promise<HolidaysResult> {
    const raw = await this.http.requestJson<NagerHolidaysResponse>({
      path: `PublicHolidays/${input.year}/${input.countryCode}`,
    });
    return mapNagerHolidaysResponse(raw);
  }

  protected async probeHealth(): Promise<unknown> {
    return this.http.requestJson({ path: 'PublicHolidays/2024/US' });
  }
}
