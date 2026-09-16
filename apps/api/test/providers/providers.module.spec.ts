import { describe, expect, it } from 'vitest';
import { ProviderRegistry } from '../../src/providers/provider-registry.service.js';
import { ProvidersModule } from '../../src/providers/providers.module.js';
import { OpenAlexProvider } from '../../src/providers/academic/openalex/openalex.provider.js';
import { CrossrefProvider } from '../../src/providers/academic/crossref/crossref.provider.js';
import { GdeltProvider } from '../../src/providers/news/gdelt/gdelt.provider.js';
import { CoinGeckoProvider } from '../../src/providers/crypto/coingecko/coingecko.provider.js';
import { FrankfurterProvider } from '../../src/providers/fx/frankfurter/frankfurter.provider.js';
import { OpenMeteoProvider } from '../../src/providers/weather/openmeteo/openmeteo.provider.js';
import { PhotonProvider } from '../../src/providers/geocode/photon/photon.provider.js';
import { NagerProvider } from '../../src/providers/holidays/nager/nager.provider.js';
import { WikimediaProvider } from '../../src/providers/knowledge/wikimedia/wikimedia.provider.js';
import { CensusProvider } from '../../src/providers/government/census/census.provider.js';
import { createTestProviderConfig, NO_RETRY_OPTIONS } from './test-provider-config.js';

const EXPECTED_SLUGS = [
  'academic.openalex',
  'academic.crossref',
  'news.gdelt',
  'crypto.coingecko',
  'fx.frankfurter',
  'weather.openmeteo',
  'geocode.photon',
  'holidays.nager',
  'knowledge.wikimedia',
  'government.census',
];

describe('ProvidersModule', () => {
  it('registers every implemented provider adapter under its slug', () => {
    const config = createTestProviderConfig();
    const registry = new ProviderRegistry();

    const module = new ProvidersModule(
      registry,
      new OpenAlexProvider(config, NO_RETRY_OPTIONS),
      new CrossrefProvider(config, NO_RETRY_OPTIONS),
      new GdeltProvider(NO_RETRY_OPTIONS),
      new CoinGeckoProvider(config, NO_RETRY_OPTIONS),
      new FrankfurterProvider(NO_RETRY_OPTIONS),
      new OpenMeteoProvider(config, NO_RETRY_OPTIONS),
      new PhotonProvider(config, NO_RETRY_OPTIONS),
      new NagerProvider(NO_RETRY_OPTIONS),
      new WikimediaProvider(config, NO_RETRY_OPTIONS),
      new CensusProvider(config, NO_RETRY_OPTIONS),
    );

    module.onModuleInit();

    expect(registry.list()).toHaveLength(EXPECTED_SLUGS.length);
    for (const slug of EXPECTED_SLUGS) {
      expect(registry.has(slug)).toBe(true);
      expect(registry.resolve(slug).metadata.slug).toBe(slug);
    }
  });
});
