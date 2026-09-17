import type { ProviderAdapter } from '../common/index.js';

export interface GeoLocation {
  id?: string;
  latitude: number;
  longitude: number;
  label: string;
  name?: string;
  street?: string;
  houseNumber?: string;
  city?: string;
  state?: string;
  country?: string;
  countryCode?: string;
  postcode?: string;
  type?: string;
}

export interface ForwardGeocodeInput {
  query: string;
  limit?: number;
}

export interface ForwardGeocodeResult {
  locations: GeoLocation[];
}

export interface ReverseGeocodeInput {
  latitude: number;
  longitude: number;
}

export interface ReverseGeocodeResult {
  locations: GeoLocation[];
}

export interface GeocodeProvider extends ProviderAdapter {
  forward(input: ForwardGeocodeInput): Promise<ForwardGeocodeResult>;
  reverse(input: ReverseGeocodeInput): Promise<ReverseGeocodeResult>;
}
