import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { ApiSuccessMeta, ApiSuccessResponse } from '../common/http/api-response.interface.js';
import { RequestContext } from '../common/request-context/request-context.js';
import { NewsService, type NewsCapabilityOutcome } from './news.service.js';
import { NewsSearchRequestDto } from './dto/news-search-request.dto.js';
import { NewsTrendsRequestDto } from './dto/news-trends-request.dto.js';
import type { NewsSearchResponseData, NewsTrendsResponseData } from './news-response.types.js';

@ApiTags('News')
@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Post('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Search news articles',
    description:
      'Searches recent news coverage via GDELT, automatically falling back to Currents API, NewsData.io, ' +
      'TheNewsAPI, GNews, or mediastack (whichever have a configured key) if GDELT is unavailable or rate-limited.',
  })
  @ApiBody({ type: NewsSearchRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Search completed successfully. An empty `results` array is not an error.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string', example: 'Example headline' },
                  url: { type: 'string', example: 'https://example.com/article' },
                  source: { type: 'string', nullable: true, example: 'example.com' },
                  publishedAt: { type: 'string', nullable: true, example: '2023-01-15T12:00:00Z' },
                  language: { type: 'string', nullable: true, example: 'English' },
                  country: { type: 'string', nullable: true, example: 'United States' },
                },
              },
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            requestId: { type: 'string', example: 'req_1a2b3c...' },
            source: { type: 'string', example: 'news.gdelt', description: 'Slug of whichever provider actually served this result.' },
            attribution: { type: 'string', example: 'News data provided by the GDELT Project (gdeltproject.org)' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'The request failed validation.' })
  @ApiResponse({ status: 429, description: 'The upstream provider is rate-limiting requests.' })
  @ApiResponse({ status: 502, description: 'The upstream provider is unavailable.' })
  @ApiResponse({ status: 504, description: 'The upstream provider timed out.' })
  async search(@Body() dto: NewsSearchRequestDto): Promise<ApiSuccessResponse<NewsSearchResponseData>> {
    const requestId = RequestContext.requestId ?? 'unknown';
    const outcome = await this.newsService.search(dto, requestId);
    return { data: outcome.data, meta: this.buildMeta(requestId, outcome) };
  }

  @Post('trends')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get news trend volume for a topic',
    description: 'Returns normalized trend volume data for a topic/entity/event via GDELT.',
  })
  @ApiBody({ type: NewsTrendsRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Trend data retrieved successfully. An empty `points` array is not an error.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            term: { type: 'string', example: 'renewable energy' },
            points: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string', example: '20230101' },
                  volume: { type: 'number', example: 12.3 },
                },
              },
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            requestId: { type: 'string', example: 'req_1a2b3c...' },
            source: { type: 'string', example: 'news.gdelt', description: 'Slug of whichever provider actually served this result.' },
            attribution: { type: 'string', example: 'News data provided by the GDELT Project (gdeltproject.org)' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'The request failed validation.' })
  @ApiResponse({ status: 429, description: 'The upstream provider is rate-limiting requests.' })
  @ApiResponse({ status: 502, description: 'The upstream provider is unavailable.' })
  @ApiResponse({ status: 504, description: 'The upstream provider timed out.' })
  async getTrends(
    @Body() dto: NewsTrendsRequestDto,
  ): Promise<ApiSuccessResponse<NewsTrendsResponseData>> {
    const requestId = RequestContext.requestId ?? 'unknown';
    const outcome = await this.newsService.getTrends(dto, requestId);
    return { data: outcome.data, meta: this.buildMeta(requestId, outcome) };
  }

  private buildMeta(requestId: string, outcome: Pick<NewsCapabilityOutcome<unknown>, 'providerSlug' | 'attribution'>): ApiSuccessMeta {
    return {
      requestId,
      source: outcome.providerSlug,
      ...(outcome.attribution ? { attribution: outcome.attribution } : {}),
    };
  }
}
