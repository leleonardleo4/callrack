import { Injectable } from '@nestjs/common';
import { ApiConfigService } from '../../config/api-config.service.js';

/**
 * Typed access to provider settings sourced from the existing configuration
 * system. Adapters must read credentials/base URLs through this service
 * rather than `process.env` directly.
 */
@Injectable()
export class ProviderConfigService {
  constructor(private readonly configService: ApiConfigService) {}

  get openAlexMailto(): string | undefined {
    return this.configService.raw.OPENALEX_MAILTO;
  }

  get crossrefMailto(): string | undefined {
    return this.configService.raw.CROSSREF_MAILTO;
  }

  get coinGeckoApiKey(): string | undefined {
    return this.configService.raw.COINGECKO_API_KEY;
  }

  get censusApiKey(): string | undefined {
    return this.configService.raw.CENSUS_API_KEY;
  }

  get openMeteoBaseUrl(): string {
    return this.configService.raw.OPEN_METEO_BASE_URL;
  }

  get photonBaseUrl(): string {
    return this.configService.raw.PHOTON_BASE_URL;
  }

  get wikimediaBaseUrl(): string {
    return this.configService.raw.WIKIMEDIA_BASE_URL;
  }

  get wikimediaUserAgent(): string {
    return this.configService.raw.WIKIMEDIA_USER_AGENT;
  }
}
