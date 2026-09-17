export interface NagerHoliday {
  date?: string;
  localName?: string;
  name?: string;
  countryCode?: string;
  global?: boolean;
  counties?: string[] | null;
  types?: string[];
}

export type NagerHolidaysResponse = NagerHoliday[];
