import { Module } from '@nestjs/common';
import { AcademicModule } from '../academic/academic.module.js';
import { NewsModule } from '../news/news.module.js';
import { KnowledgeModule } from '../knowledge/knowledge.module.js';
import { GovernmentModule } from '../government/government.module.js';
import { CapabilitiesModule } from '../capabilities/capabilities.module.js';
import { ResearchController } from './research.controller.js';
import { ResearchService } from './research.service.js';

/**
 * Imports only capability modules (never ProvidersModule) — Research
 * composes existing capability services, it never talks to provider
 * adapters directly. `CapabilitiesModule` is the one exception: the
 * controller (the API boundary, not the service) reads research's own
 * registry price for its response `meta`, the same "registry is read at
 * the API boundary, never by a capability service" principle
 * `CapabilitiesModule`'s own doc comment already establishes.
 */
@Module({
  imports: [AcademicModule, NewsModule, KnowledgeModule, GovernmentModule, CapabilitiesModule],
  controllers: [ResearchController],
  providers: [ResearchService],
})
export class ResearchModule {}
