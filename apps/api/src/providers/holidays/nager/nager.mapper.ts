import { ProviderError, ProviderErrorCode } from '../../common/index.js';
import type { Holiday, HolidaysResult } from '../holidays.types.js';
import type { NagerHoliday, NagerHolidaysResponse } from './nager.types.js';

const PROVIDER_SLUG = 'holidays.nager';

export function mapNagerHoliday(raw: NagerHoliday): Holiday {
  if (
    !raw ||
    typeof raw.date !== 'string' ||
    typeof raw.localName !== 'string' ||
    typeof raw.name !== 'string' ||
    typeof raw.countryCode !== 'string'
  ) {
    throw new ProviderError({
      code: ProviderErrorCode.PROVIDER_BAD_RESPONSE,
      message: 'Nager.Date holiday is missing required fields (date, localName, name, countryCode)',
      providerSlug: PROVIDER_SLUG,
    });
  }

  return {
    date: raw.date,
    localName: raw.localName,
    name: raw.name,
    countryCode: raw.countryCode,
    global: raw.global ?? false,
    counties: raw.counties,
    types: raw.types,
  };
}

export function mapNagerHolidaysResponse(raw: NagerHolidaysResponse): HolidaysResult {
  if (!Array.isArray(raw)) {
    throw new ProviderError({
      code: ProviderErrorCode.PROVIDER_BAD_RESPONSE,
      message: 'Nager.Date response was not an array',
      providerSlug: PROVIDER_SLUG,
    });
  }

  return { holidays: raw.map(mapNagerHoliday) };
}
