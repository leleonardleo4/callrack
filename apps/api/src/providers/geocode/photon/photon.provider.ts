import { Injectable, Optional } from '@nestjs/common';
import {
  BaseProviderAdapter,
  defineProviderMetadata,
  ProviderConfigService,
  ProviderHttpClient,
  type ProviderAdapterOptions,
  type ProviderMetadata,
} from '../../common/index.js';
import type {
  ForwardGeocodeInput,
  ForwardGeocodeResult,
  GeocodeProvider,
  ReverseGeocodeInput,
  ReverseGeocodeResult,
} from '../geocode.types.js';
import { mapPhotonResponse } from './photon.mapper.js';
import type { PhotonResponse } from './photon.types.js';

const PROVIDER_SLUG = 'geocode.photon';

/**
 * Photon adapter. The base URL is configurable (`PHOTON_BASE_URL`) because
 * Callrack's production deployment is intended to run against self-hosted
 * Photon infrastructure rather than the public demo instance.
 */
@Injectable()
export class PhotonProvider extends BaseProviderAdapter implements GeocodeProvider {
  readonly metadata: ProviderMetadata = defineProviderMetadata({
    slug: PROVIDER_SLUG,
    name: 'Photon',
    description: 'OpenStreetMap-based geocoder (forward and reverse).',
    category: 'geocode',
    website: 'https://photon.komoot.io',
    attributionRequired: true,
    attributionText: 'Geocoding by Photon (photon.komoot.io), data © OpenStreetMap contributors',
    license: 'ODbL (OpenStreetMap data)',
    commercialUse: 'allowed',
  });

  constructor(config: ProviderConfigService, @Optional() options?: ProviderAdapterOptions) {
    super(
      new ProviderHttpClient({
        providerSlug: PROVIDER_SLUG,
        baseUrl: config.photonBaseUrl,
        timeoutMs: options?.timeoutMs,
        retry: options?.retry,
      }),
    );
  }

  async forward(input: ForwardGeocodeInput): Promise<ForwardGeocodeResult> {
    const raw = await this.http.requestJson<PhotonResponse>({
      path: 'api',
      query: { q: input.query, limit: input.limit ?? 5 },
    });
    return mapPhotonResponse(raw);
  }

  async reverse(input: ReverseGeocodeInput): Promise<ReverseGeocodeResult> {
    const raw = await this.http.requestJson<PhotonResponse>({
      path: 'reverse',
      query: { lon: input.longitude, lat: input.latitude },
    });
    return mapPhotonResponse(raw);
  }

  protected async probeHealth(): Promise<unknown> {
    return this.http.requestJson({ path: 'api', query: { q: 'health', limit: 1 } });
  }
}
