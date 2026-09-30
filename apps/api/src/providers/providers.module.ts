import { Module, type OnModuleInit } from '@nestjs/common';
import { ProviderConfigService, ProviderCooldownService } from './common/index.js';
import { ProviderRegistry } from './provider-registry.service.js';
import { OpenAlexProvider } from './academic/openalex/openalex.provider.js';
import { CrossrefProvider } from './academic/crossref/crossref.provider.js';
import { GdeltProvider } from './news/gdelt/gdelt.provider.js';
import { CurrentsProvider } from './news/currents/currents.provider.js';
import { NewsDataProvider } from './news/newsdata/newsdata.provider.js';
import { TheNewsApiProvider } from './news/thenewsapi/thenewsapi.provider.js';
import { GNewsProvider } from './news/gnews/gnews.provider.js';
import { MediastackProvider } from './news/mediastack/mediastack.provider.js';
import { CoinGeckoProvider } from './crypto/coingecko/coingecko.provider.js';
import { FrankfurterProvider } from './fx/frankfurter/frankfurter.provider.js';
import { OpenMeteoProvider } from './weather/openmeteo/openmeteo.provider.js';
import { PhotonProvider } from './geocode/photon/photon.provider.js';
import { NagerProvider } from './holidays/nager/nager.provider.js';
import { WikimediaProvider } from './knowledge/wikimedia/wikimedia.provider.js';
import { CensusProvider } from './government/census/census.provider.js';

/**
 * Wires every implemented provider adapter into the DI container and
 * registers it with the ProviderRegistry under its slug. This module
 * deliberately declares no controllers - providers are internal services
 * for Phase 4 capability services to consume.
 */
@Module({
  providers: [
    ProviderConfigService,
    ProviderCooldownService,
    ProviderRegistry,
    OpenAlexProvider,
    CrossrefProvider,
    GdeltProvider,
    CurrentsProvider,
    NewsDataProvider,
    TheNewsApiProvider,
    GNewsProvider,
    MediastackProvider,
    CoinGeckoProvider,
    FrankfurterProvider,
    OpenMeteoProvider,
    PhotonProvider,
    NagerProvider,
    WikimediaProvider,
    CensusProvider,
  ],
  exports: [
    ProviderConfigService,
    ProviderCooldownService,
    ProviderRegistry,
    OpenAlexProvider,
    CrossrefProvider,
    GdeltProvider,
    CurrentsProvider,
    NewsDataProvider,
    TheNewsApiProvider,
    GNewsProvider,
    MediastackProvider,
    CoinGeckoProvider,
    FrankfurterProvider,
    OpenMeteoProvider,
    PhotonProvider,
    NagerProvider,
    WikimediaProvider,
    CensusProvider,
  ],
})
export class ProvidersModule implements OnModuleInit {
  constructor(
    private readonly registry: ProviderRegistry,
    private readonly openAlex: OpenAlexProvider,
    private readonly crossref: CrossrefProvider,
    private readonly gdelt: GdeltProvider,
    private readonly currents: CurrentsProvider,
    private readonly newsData: NewsDataProvider,
    private readonly theNewsApi: TheNewsApiProvider,
    private readonly gNews: GNewsProvider,
    private readonly mediastack: MediastackProvider,
    private readonly coinGecko: CoinGeckoProvider,
    private readonly frankfurter: FrankfurterProvider,
    private readonly openMeteo: OpenMeteoProvider,
    private readonly photon: PhotonProvider,
    private readonly nager: NagerProvider,
    private readonly wikimedia: WikimediaProvider,
    private readonly census: CensusProvider,
  ) {}

  onModuleInit(): void {
    for (const provider of [
      this.openAlex,
      this.crossref,
      this.gdelt,
      this.currents,
      this.newsData,
      this.theNewsApi,
      this.gNews,
      this.mediastack,
      this.coinGecko,
      this.frankfurter,
      this.openMeteo,
      this.photon,
      this.nager,
      this.wikimedia,
      this.census,
    ]) {
      this.registry.register(provider.metadata.slug, provider);
    }
  }
}
