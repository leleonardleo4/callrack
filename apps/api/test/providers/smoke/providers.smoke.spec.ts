import { describe, expect, it } from 'vitest';
import { ApiConfigService } from '../../../src/config/api-config.service.js';
import { ProviderConfigService } from '../../../src/providers/common/index.js';
import { OpenAlexProvider } from '../../../src/providers/academic/openalex/openalex.provider.js';
import { CrossrefProvider } from '../../../src/providers/academic/crossref/crossref.provider.js';
import { GdeltProvider } from '../../../src/providers/news/gdelt/gdelt.provider.js';
import { CoinGeckoProvider } from '../../../src/providers/crypto/coingecko/coingecko.provider.js';
import { FrankfurterProvider } from '../../../src/providers/fx/frankfurter/frankfurter.provider.js';
import { OpenMeteoProvider } from '../../../src/providers/weather/openmeteo/openmeteo.provider.js';
import { PhotonProvider } from '../../../src/providers/geocode/photon/photon.provider.js';
import { NagerProvider } from '../../../src/providers/holidays/nager/nager.provider.js';
import { WikimediaProvider } from '../../../src/providers/knowledge/wikimedia/wikimedia.provider.js';
import { CensusProvider } from '../../../src/providers/government/census/census.provider.js';

/**
 * Live smoke tests. NOT part of `pnpm test` - run explicitly via
 * `pnpm test:providers` and require real internet connectivity. They only
 * call each provider's lightweight health-check request, never anything
 * destructive, and never log credential values (only whether a provider is
 * configured with one).
 */

// Reads real process.env (via ApiConfigService's default `?? process.env`)
// so this exercises whatever OPENALEX_MAILTO / COINGECKO_API_KEY / etc. the
// developer has configured locally, without ever printing their values.
const apiConfig = new ApiConfigService();
const providerConfig = new ProviderConfigService(apiConfig);

const providers = [
  new OpenAlexProvider(providerConfig),
  new CrossrefProvider(providerConfig),
  new GdeltProvider(),
  new CoinGeckoProvider(providerConfig),
  new FrankfurterProvider(),
  new OpenMeteoProvider(providerConfig),
  new PhotonProvider(providerConfig),
  new NagerProvider(),
  new WikimediaProvider(providerConfig),
  new CensusProvider(providerConfig),
];

describe('Live provider smoke tests', () => {
  console.log(`[smoke] checking ${providers.length} providers: ${providers.map((p) => p.metadata.slug).join(', ')}`);

  for (const provider of providers) {
    it(
      `${provider.metadata.slug} is reachable`,
      async () => {
        const health = await provider.checkHealth();
        const status = health.healthy ? 'OK' : 'FAILED';
        console.log(`[smoke] ${provider.metadata.slug}: ${status} (${health.latencyMs}ms)${health.error ? ` - ${health.error}` : ''}`);
        expect(health.healthy, `${provider.metadata.slug} health check failed: ${health.error}`).toBe(true);
      },
      30_000,
    );
  }
});
