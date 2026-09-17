import type { HolidaysResult } from '../providers/holidays/holidays.types.js';
import type { HolidaysResponseData } from './holidays-response.types.js';

export function toHolidaysResponse(result: HolidaysResult, country: string, year: number): HolidaysResponseData {
  return {
    country,
    year,
    holidays: result.holidays.map((holiday) => ({
      date: holiday.date,
      name: holiday.name,
      localName: holiday.localName,
      countryCode: holiday.countryCode,
      global: holiday.global,
      counties: holiday.counties ?? null,
      types: holiday.types ?? null,
    })),
  };
}
