export interface NagerHoliday {
  date?: string;
  localName?: string;
  name?: string;
  countryCode?: string;
  global?: boolean;
}

export type NagerHolidaysResponse = NagerHoliday[];
