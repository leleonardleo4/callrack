import { Module } from '@nestjs/common';
import { AcademicModule } from '../academic/academic.module.js';
import { NewsModule } from '../news/news.module.js';
import { KnowledgeModule } from '../knowledge/knowledge.module.js';
import { InformationSourceRunnerService } from './information-source-runner.service.js';
import { VerifyController } from './verify.controller.js';
import { VerifyService } from './verify.service.js';
import { EvidenceController } from './evidence.controller.js';
import { EvidenceService } from './evidence.service.js';
import { CompareController } from './compare.controller.js';
import { CompareService } from './compare.service.js';

/**
 * Deliberately imports only capability modules (never ProvidersModule) -
 * verify/evidence/compare compose existing capability services, exactly
 * like `ResearchModule`, and never talk to provider adapters directly.
 */
@Module({
  imports: [AcademicModule, NewsModule, KnowledgeModule],
  controllers: [VerifyController, EvidenceController, CompareController],
  providers: [InformationSourceRunnerService, VerifyService, EvidenceService, CompareService],
})
export class InformationModule {}
