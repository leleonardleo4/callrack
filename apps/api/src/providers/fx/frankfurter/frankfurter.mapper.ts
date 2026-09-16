import { ProviderError, ProviderErrorCode } from '../../common/index.js';
import type { FxRates } from '../fx.types.js';
import type { FrankfurterRatesResponse } from './frankfurter.types.js';

const PROVIDER_SLUG = 'fx.frankfurter';

export function mapFrankfurterRates(raw: FrankfurterRatesResponse): FxRates {
  if (
    !raw ||
    typeof raw.base !== 'string' ||
    typeof raw.date !== 'string' ||
    typeof raw.rates !== 'object' ||
    raw.rates === null
  ) {
    throw new ProviderError({
      code: ProviderErrorCode.PROVIDER_BAD_RESPONSE,
      message: 'Frankfurter response is missing required fields (base, date, rates)',
      providerSlug: PROVIDER_SLUG,
    });
  }

  return { base: raw.base, date: raw.date, rates: raw.rates };
}
