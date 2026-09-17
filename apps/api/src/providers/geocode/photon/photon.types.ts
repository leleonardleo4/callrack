export interface PhotonProperties {
  osm_id?: number;
  type?: string;
  name?: string;
  street?: string;
  housenumber?: string;
  postcode?: string;
  city?: string;
  state?: string;
  country?: string;
  countrycode?: string;
}

export interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: PhotonProperties;
}

export interface PhotonResponse {
  features?: PhotonFeature[];
}
