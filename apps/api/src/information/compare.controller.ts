import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { ApiSuccessResponse } from '../common/http/api-response.interface.js';
import { RequestContext } from '../common/request-context/request-context.js';
import { CompareService } from './compare.service.js';
import { CompareRequestDto } from './dto/compare-request.dto.js';
import type { CompareResponseData } from './compare-response.types.js';

@ApiTags('Information')
@Controller('compare')
export class CompareController {
  constructor(private readonly compareService: CompareService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Compare information gathered from multiple Callrack capabilities',
    description:
      'Runs a query across academic, news, and knowledge search and returns the distinct subjects found, a ' +
      'flattened table of real attribute values per subject, the deduplicated source list, and any detected ' +
      'disagreements (the same-titled subject described differently by two results). Never fabricates a value a ' +
      'provider did not return — an empty `attributes`/`disagreements` array for a subject is a correct result.',
  })
  @ApiBody({ type: CompareRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Comparison executed.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            subjects: {
              type: 'array',
              items: {
                type: 'object',
                properties: { name: { type: 'string' }, sources: { type: 'array', items: { type: 'string' } } },
              },
            },
            attributes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  subject: { type: 'string' },
                  key: { type: 'string' },
                  value: { type: 'string' },
                  provider: { type: 'string' },
                },
              },
            },
            sources: {
              type: 'array',
              items: {
                type: 'object',
                properties: { title: { type: 'string' }, url: { type: 'string', nullable: true }, provider: { type: 'string' } },
              },
            },
            disagreements: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  subject: { type: 'string' },
                  attribute: { type: 'string' },
                  values: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: { value: { type: 'string' }, source: { type: 'object' } },
                    },
                  },
                },
              },
            },
          },
        },
        meta: {
          type: 'object',
          properties: { requestId: { type: 'string', example: 'req_1a2b3c...' } },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'The request failed validation (e.g. query too short, unsupported sourceTypes value).' })
  async compare(@Body() dto: CompareRequestDto): Promise<ApiSuccessResponse<CompareResponseData>> {
    const requestId = RequestContext.requestId ?? 'unknown';
    const data = await this.compareService.compare(dto, requestId);
    return { data, meta: { requestId } };
  }
}
