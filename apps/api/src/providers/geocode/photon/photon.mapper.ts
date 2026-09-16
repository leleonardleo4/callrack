import { ProviderError, ProviderErrorCode } from '../../common/index.js';
import type { ForwardGeocodeResult, GeoLocation } from '../geocode.types.js';
import type { PhotonFeature, PhotonResponse } from './photon.types.js';

const PROVIDER_SLUG = 'geocode.photon';

export function mapPhotonFeature(raw: PhotonFeature): GeoLocation {
  const coordinates = raw?.geometry?.coordinates;
  const name = raw?.properties?.name;

  if (!Array.isArray(coordinates) || coordinates.length !== 2 || typeof name !== 'string') {
    throw new ProviderError({
      code: ProviderErrorCode.PROVIDER_BAD_RESPONSE,
      message: 'Photon feature is missing required fields (geometry.coordinates, properties.name)',
      providerSlug: PROVIDER_SLUG,
    });
  }

  const [longitude, latitude] = coordinates;
  const labelParts = [name, raw.properties?.city, raw.properties?.country].filter(
    (part, index, all) => Boolean(part) && all.indexOf(part) === index,
  );

  return {
    latitude,
    longitude,
    label: labelParts.join(', '),
    city: raw.properties?.city,
    country: raw.properties?.country,
  };
}

export function mapPhotonResponse(raw: PhotonResponse): ForwardGeocodeResult {
  if (!raw || !Array.isArray(raw.features)) {
    throw new ProviderError({
      code: ProviderErrorCode.PROVIDER_BAD_RESPONSE,
      message: 'Photon response is missing a "features" array',
      providerSlug: PROVIDER_SLUG,
    });
  }

  return { locations: raw.features.map(mapPhotonFeature) };
}
