import { describe, expect, it } from 'vitest';
import { toHolidaysResponse } from '../../src/holidays/holidays.mapper.js';
import type { Holiday, HolidaysResult } from '../../src/providers/holidays/holidays.types.js';

const FULL_HOLIDAY: Holiday = {
  date: '2026-10-01',
  name: 'National Day',
  localName: 'National Day',
  countryCode: 'NG',
  global: true,
  counties: null,
  types: ['Public'],
};

describe('holidays.mapper', () => {
  it('maps a fully-populated holiday to the public contract', () => {
    const result: HolidaysResult = { holidays: [FULL_HOLIDAY] };
    expect(toHolidaysResponse(result, 'NG', 2026)).toEqual({
      country: 'NG',
      year: 2026,
      holidays: [
        {
          date: '2026-10-01',
          name: 'National Day',
          localName: 'National Day',
          countryCode: 'NG',
          global: true,
          counties: null,
          types: ['Public'],
        },
      ],
    });
  });

  it('uses null for counties/types the provider did not supply', () => {
    const minimal: Holiday = {
      date: '2026-01-01',
      name: "New Year's Day",
      localName: "New Year's Day",
      countryCode: 'DE',
      global: true,
    };
    const result = toHolidaysResponse({ holidays: [minimal] }, 'DE', 2026);
    expect(result.holidays[0]).toEqual({
      date: '2026-01-01',
      name: "New Year's Day",
      localName: "New Year's Day",
      countryCode: 'DE',
      global: true,
      counties: null,
      types: null,
    });
  });

  it('normalizes an empty holiday list without inventing entries', () => {
    expect(toHolidaysResponse({ holidays: [] }, 'ZZ', 2026)).toEqual({ country: 'ZZ', year: 2026, holidays: [] });
  });
});
