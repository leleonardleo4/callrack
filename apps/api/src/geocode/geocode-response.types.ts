export interface GeocodeLocationResponse {
  id: string | null;
  name: string | null;
  street: string | null;
  houseNumber: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  countryCode: string | null;
  postcode: string | null;
  latitude: number;
  longitude: number;
  type: string | null;
}

export interface GeocodeResponseData {
  results: GeocodeLocationResponse[];
}
