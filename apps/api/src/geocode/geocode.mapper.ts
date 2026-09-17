import type { ForwardGeocodeResult, GeoLocation, ReverseGeocodeResult } from '../providers/geocode/geocode.types.js';
import type { GeocodeResponseData } from './geocode-response.types.js';

function toLocationResponse(location: GeoLocation): GeocodeResponseData['results'][number] {
  return {
    id: location.id ?? null,
    name: location.name ?? null,
    street: location.street ?? null,
    houseNumber: location.houseNumber ?? null,
    city: location.city ?? null,
    state: location.state ?? null,
    country: location.country ?? null,
    countryCode: location.countryCode ?? null,
    postcode: location.postcode ?? null,
    latitude: location.latitude,
    longitude: location.longitude,
    type: location.type ?? null,
  };
}

export function toGeocodeResponse(result: ForwardGeocodeResult | ReverseGeocodeResult): GeocodeResponseData {
  return { results: result.locations.map(toLocationResponse) };
}
