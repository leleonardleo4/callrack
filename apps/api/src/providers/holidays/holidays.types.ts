import type { ProviderAdapter } from '../common/index.js';

export interface Holiday {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
  global: boolean;
}

export interface HolidaysInput {
  year: number;
  countryCode: string;
}

export interface HolidaysResult {
  holidays: Holiday[];
}

export interface HolidaysProvider extends ProviderAdapter {
  getPublicHolidays(input: HolidaysInput): Promise<HolidaysResult>;
}
