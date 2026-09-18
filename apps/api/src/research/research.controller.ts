import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { ApiSuccessResponse } from '../common/http/api-response.interface.js';
import { RequestContext } from '../common/request-context/request-context.js';
import { CapabilityRegistryService } from '../capabilities/capability-registry.service.js';
import { ResearchService } from './research.service.js';
import { ResearchRequestDto } from './dto/research-request.dto.js';
import { SUPPORTED_RESEARCH_SOURCES } from './research-sources.constants.js';
import type { ResearchResponseData } from './research-response.types.js';

const SOURCE_ENTRY_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['success', 'empty', 'failed'], example: 'success' },
    data: { type: 'object', nullable: true, description: 'The underlying capability response — shape varies by source.' },
    error: {
      type: 'object',
      nullable: true,
      properties: {
        code: { type: 'string', example: 'PROVIDER_UNAVAILABLE' },
        message: { type: 'string', example: 'The upstream provider is currently unavailable. Please try again later.' },
      },
    },
  },
};

@ApiTags('Research')
@Controller('research')
export class ResearchController {
  constructor(
    private readonly researchService: ResearchService,
    private readonly registry: CapabilityRegistryService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Aggregate research data across Callrack capabilities',
    description:
      'Composes existing Callrack capabilities (academic, news, knowledge, and optionally government) into a ' +
      `single research result for a given query. Supported sources: ${SUPPORTED_RESEARCH_SOURCES.join(', ')}. ` +
      'This endpoint gathers and structures evidence — it does not generate an AI-written narrative answer. ' +
      'One source failing does not fail the whole request: check each source\'s own `status`, and the ' +
      'top-level `status` ("complete" | "partial" | "failed") for the overall outcome. The HTTP status is ' +
      'always 200 for a successfully *executed* research request, even when some or all sources failed — the ' +
      'response body always carries the true per-source and overall outcome.',
  })
  @ApiBody({ type: ResearchRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Research executed. Check `data.status` and each source\'s `status` for the actual outcome.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            query: { type: 'string', example: 'renewable energy investment in Africa' },
            status: { type: 'string', enum: ['complete', 'partial', 'failed'], example: 'complete' },
            sources: {
              type: 'object',
              properties: {
                academic: SOURCE_ENTRY_SCHEMA,
                news: SOURCE_ENTRY_SCHEMA,
                knowledge: SOURCE_ENTRY_SCHEMA,
                government: SOURCE_ENTRY_SCHEMA,
              },
            },
            findings: {
              type: 'array',
              description: 'academic/news/knowledge results normalized into provenance-preserving evidence items (government is excluded — see composition.sourcesRequested for whether it ran).',
              items: { type: 'object' },
            },
            disagreements: { type: 'array', items: { type: 'object' } },
            composition: {
              type: 'object',
              properties: {
                sourcesRequested: { type: 'array', items: { type: 'string' } },
                sourcesSucceeded: { type: 'array', items: { type: 'string' } },
                sourcesEmpty: { type: 'array', items: { type: 'string' } },
                sourcesFailed: { type: 'array', items: { type: 'string' } },
                retrievedAt: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            requestId: { type: 'string', example: 'req_1a2b3c...' },
            sourcesUsed: { type: 'array', items: { type: 'string' }, example: ['academic', 'news', 'knowledge'] },
            price: {
              type: 'object',
              nullable: true,
              properties: { amount: { type: 'string' }, currency: { type: 'string', example: 'USDC' } },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'The request failed validation (e.g. unsupported source name, too many sources, or "government" ' +
      'selected without its required dataset/year/variables/forGeography options).',
  })
  async research(@Body() dto: ResearchRequestDto): Promise<ApiSuccessResponse<ResearchResponseData>> {
    const requestId = RequestContext.requestId ?? 'unknown';
    const data = await this.researchService.research(dto, requestId);
    const price = this.registry.getById('research')?.price;
    return { data, meta: { requestId, sourcesUsed: Object.keys(data.sources), ...(price ? { price } : {}) } };
  }
}
