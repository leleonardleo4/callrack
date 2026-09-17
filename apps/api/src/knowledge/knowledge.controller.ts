import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { ApiSuccessResponse } from '../common/http/api-response.interface.js';
import { RequestContext } from '../common/request-context/request-context.js';
import { KnowledgeService } from './knowledge.service.js';
import { KnowledgeSearchRequestDto } from './dto/knowledge-search-request.dto.js';
import type { KnowledgeSearchResponseData } from './knowledge-response.types.js';

@ApiTags('Knowledge')
@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Post('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Search for a knowledge entity',
    description:
      'Searches Wikidata for entities matching a free-text query. This is a general entity/knowledge search, ' +
      'not an authoritative fact-checking system — results reflect whatever is currently in Wikidata and are ' +
      'not guaranteed to be complete, current, or correct for every topic.',
  })
  @ApiBody({ type: KnowledgeSearchRequestDto })
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
                  id: { type: 'string', example: 'Q8673' },
                  name: { type: 'string', example: 'Lagos' },
                  description: { type: 'string', nullable: true, example: 'city in Lagos State, Nigeria' },
                  url: { type: 'string', example: 'https://www.wikidata.org/wiki/Q8673' },
                  source: { type: 'string', example: 'wikimedia' },
                },
              },
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            requestId: { type: 'string', example: 'req_1a2b3c...' },
            attribution: { type: 'string', example: 'Data from Wikidata, available under CC0' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'The request failed validation.' })
  @ApiResponse({ status: 429, description: 'The upstream provider is rate-limiting requests.' })
  @ApiResponse({ status: 502, description: 'The upstream provider is unavailable.' })
  @ApiResponse({ status: 504, description: 'The upstream provider timed out.' })
  async search(
    @Body() dto: KnowledgeSearchRequestDto,
  ): Promise<ApiSuccessResponse<KnowledgeSearchResponseData>> {
    const requestId = RequestContext.requestId ?? 'unknown';
    const data = await this.knowledgeService.search(dto, requestId);
    const attribution = this.knowledgeService.getAttribution();
    return { data, meta: attribution ? { requestId, attribution } : { requestId } };
  }
}
