import { Injectable, Optional } from '@nestjs/common';
import {
  BaseProviderAdapter,
  defineProviderMetadata,
  ProviderError,
  ProviderErrorCode,
  ProviderHttpClient,
  type ProviderAdapterOptions,
  type ProviderMetadata,
} from '../../common/index.js';
import type {
  FxConversionInput,
  FxConversionResult,
  FxHistoricalRatesInput,
  FxProvider,
  FxRates,
  FxRatesInput,
} from '../fx.types.js';
import { mapFrankfurterRates } from './frankfurter.mapper.js';
import type { FrankfurterRatesResponse } from './frankfurter.types.js';

const PROVIDER_SLUG = 'fx.frankfurter';

@Injectable()
export class FrankfurterProvider extends BaseProviderAdapter implements FxProvider {
  readonly metadata: ProviderMetadata = defineProviderMetadata({
    slug: PROVIDER_SLUG,
    name: 'Frankfurter',
    description: 'Foreign exchange rates sourced from the European Central Bank.',
    category: 'fx',
    website: 'https://frankfurter.dev',
    attributionRequired: true,
    attributionText: 'Exchange rates from the European Central Bank via Frankfurter.dev',
    license: 'MIT (Frankfurter); underlying data from the ECB',
    commercialUse: 'allowed',
  });

  constructor(@Optional() options?: ProviderAdapterOptions) {
    super(
      new ProviderHttpClient({
        providerSlug: PROVIDER_SLUG,
        baseUrl: 'https://api.frankfurter.dev/v1/',
        timeoutMs: options?.timeoutMs,
        retry: options?.retry,
      }),
    );
  }

  async getCurrentRates(input: FxRatesInput): Promise<FxRates> {
    const raw = await this.http.requestJson<FrankfurterRatesResponse>({
      path: 'latest',
      query: { base: input.base, symbols: input.symbols?.join(',') },
    });
    return mapFrankfurterRates(raw);
  }

  async getHistoricalRates(input: FxHistoricalRatesInput): Promise<FxRates> {
    const raw = await this.http.requestJson<FrankfurterRatesResponse>({
      path: input.date,
      query: { base: input.base, symbols: input.symbols?.join(',') },
    });
    return mapFrankfurterRates(raw);
  }

  async convert(input: FxConversionInput): Promise<FxConversionResult> {
    if (input.from === input.to) {
      return {
        from: input.from,
        to: input.to,
        amount: input.amount,
        convertedAmount: input.amount,
        rate: 1,
        date: input.date ?? new Date().toISOString().slice(0, 10),
      };
    }

    const rates = input.date
      ? await this.getHistoricalRates({ base: input.from, symbols: [input.to], date: input.date })
      : await this.getCurrentRates({ base: input.from, symbols: [input.to] });

    const rate = rates.rates[input.to];
    if (typeof rate !== 'number') {
      throw new ProviderError({
        code: ProviderErrorCode.PROVIDER_BAD_RESPONSE,
        message: `Frankfurter did not return a rate for ${input.to}`,
        providerSlug: PROVIDER_SLUG,
      });
    }

    return {
      from: input.from,
      to: input.to,
      amount: input.amount,
      convertedAmount: input.amount * rate,
      rate,
      date: rates.date,
    };
  }

  protected async probeHealth(): Promise<unknown> {
    return this.http.requestJson({ path: 'latest', query: { base: 'USD', symbols: 'EUR' } });
  }
}
