export interface HolidayResponse {
  date: string;
  name: string;
  localName: string;
  countryCode: string;
  global: boolean;
  counties: string[] | null;
  types: string[] | null;
}

export interface HolidaysResponseData {
  country: string;
  year: number;
  holidays: HolidayResponse[];
}
