import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ApiConfigModule } from '../config/api-config.module.js';
import { X402ConfigModule } from '../config/x402-config.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { RedisModule } from '../redis/redis.module.js';
import { CacheModule } from '../common/cache/index.js';
import { RequestTrackingModule } from '../common/tracking/index.js';
import { HealthModule } from '../health/health.module.js';
import { ProvidersModule } from '../providers/providers.module.js';
import { AcademicModule } from '../academic/academic.module.js';
import { NewsModule } from '../news/news.module.js';
import { CryptoModule } from '../crypto/crypto.module.js';
import { FxModule } from '../fx/fx.module.js';
import { WeatherModule } from '../weather/weather.module.js';
import { GeocodeModule } from '../geocode/geocode.module.js';
import { HolidaysModule } from '../holidays/holidays.module.js';
import { KnowledgeModule } from '../knowledge/knowledge.module.js';
import { GovernmentModule } from '../government/government.module.js';
import { ResearchModule } from '../research/research.module.js';
import { InformationModule } from '../information/information.module.js';
import { CapabilitiesModule } from '../capabilities/capabilities.module.js';
import { DiscoveryModule } from '../discovery/discovery.module.js';
import { RefundsModule } from '../refunds/refunds.module.js';
import { RequestContextMiddleware } from '../common/request-context/request-context.middleware.js';

import { AppLoggerService } from '../common/logging/app-logger.service.js';

@Module({
  imports: [
    ApiConfigModule,
    X402ConfigModule,
    DatabaseModule,
    RedisModule,
    CacheModule,
    RequestTrackingModule,
    ProvidersModule,
    AcademicModule,
    NewsModule,
    CryptoModule,
    FxModule,
    WeatherModule,
    GeocodeModule,
    HolidaysModule,
    KnowledgeModule,
    GovernmentModule,
    ResearchModule,
    InformationModule,
    CapabilitiesModule,
    DiscoveryModule,
    HealthModule,
    RefundsModule,
  ],
  providers: [AppLoggerService],
  exports: [AppLoggerService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
