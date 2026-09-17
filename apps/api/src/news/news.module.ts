import { Module } from '@nestjs/common';
import { ProvidersModule } from '../providers/providers.module.js';
import { NewsController } from './news.controller.js';
import { NewsService } from './news.service.js';

@Module({
  imports: [ProvidersModule],
  controllers: [NewsController],
  providers: [NewsService],
  exports: [NewsService],
})
export class NewsModule {}
