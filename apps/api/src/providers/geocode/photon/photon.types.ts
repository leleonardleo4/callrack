export interface PhotonProperties {
  name?: string;
  country?: string;
  city?: string;
}

export interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: PhotonProperties;
}

export interface PhotonResponse {
  features?: PhotonFeature[];
}
