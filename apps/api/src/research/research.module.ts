import { Module } from '@nestjs/common';
import { AcademicModule } from '../academic/academic.module.js';
import { NewsModule } from '../news/news.module.js';
import { KnowledgeModule } from '../knowledge/knowledge.module.js';
import { GovernmentModule } from '../government/government.module.js';
import { ResearchController } from './research.controller.js';
import { ResearchService } from './research.service.js';

/**
 * Deliberately imports only capability modules (never ProvidersModule) —
 * Research composes existing capability services, it never talks to
 * provider adapters directly.
 */
@Module({
  imports: [AcademicModule, NewsModule, KnowledgeModule, GovernmentModule],
  controllers: [ResearchController],
  providers: [ResearchService],
})
export class ResearchModule {}
