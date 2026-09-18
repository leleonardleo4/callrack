import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { ApiSuccessResponse } from '../common/http/api-response.interface.js';
import { RequestContext } from '../common/request-context/request-context.js';
import { EvidenceService } from './evidence.service.js';
import { EvidenceRequestDto } from './dto/evidence-request.dto.js';
import type { EvidenceResponseData } from './evidence-response.types.js';

const EVIDENCE_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    source: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        url: { type: 'string', nullable: true },
        provider: { type: 'string', example: 'academic.search' },
      },
    },
    excerpt: { type: 'string', nullable: true },
    retrievedAt: { type: 'string', format: 'date-time' },
    data: { type: 'object', nullable: true },
  },
};

@ApiTags('Information')
@Controller('evidence')
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Return a machine-readable evidence pack for a query',
    description:
      'Gathers real results from existing Callrack capabilities (academic, news, knowledge) and returns them ' +
      'with full provenance - never an AI-generated narrative answer. Every finding traces to a real capability ' +
      'result and carries its own source, retrieval timestamp, and (when the underlying capability returned ' +
      'one) an excerpt plus additional structured fields.',
  })
  @ApiBody({ type: EvidenceRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Evidence gathered. `findings` may be empty when no source returned a matching result - this is never padded with a fabricated finding.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            findings: { type: 'array', items: EVIDENCE_ITEM_SCHEMA },
            sources: {
              type: 'array',
              items: {
                type: 'object',
                properties: { title: { type: 'string' }, url: { type: 'string', nullable: true }, provider: { type: 'string' } },
              },
            },
            retrievedAt: { type: 'string', format: 'date-time' },
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
  async evidence(@Body() dto: EvidenceRequestDto): Promise<ApiSuccessResponse<EvidenceResponseData>> {
    const requestId = RequestContext.requestId ?? 'unknown';
    const data = await this.evidenceService.gather(dto, requestId);
    return { data, meta: { requestId } };
  }
}
