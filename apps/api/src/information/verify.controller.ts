import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { ApiSuccessResponse } from '../common/http/api-response.interface.js';
import { RequestContext } from '../common/request-context/request-context.js';
import { VerifyService } from './verify.service.js';
import { VerifyRequestDto } from './dto/verify-request.dto.js';
import type { VerifyResponseData } from './verify-response.types.js';

const EVIDENCE_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    source: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        url: { type: 'string', nullable: true },
        provider: { type: 'string', example: 'news.search' },
      },
    },
    excerpt: { type: 'string', nullable: true },
    retrievedAt: { type: 'string', format: 'date-time' },
    data: { type: 'object', nullable: true, description: 'Additional real fields from the source, when available.' },
  },
};

@ApiTags('Information')
@Controller('verify')
export class VerifyController {
  constructor(private readonly verifyService: VerifyService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify a claim against existing Callrack capabilities',
    description:
      'Gathers real evidence from academic, news, and knowledge search (deterministic composition, the same ' +
      'pattern research/evidence/compare use) and classifies each relevant item as affirming or denying the ' +
      'claim using explainable lexical term-overlap and negation-cue heuristics - never an LLM, never semantic ' +
      'entailment. `verdict`/`confidence` describe how the actually-returned evidence reads, not an independent ' +
      'fact-check; every evidence item traces to a real capability result, with a request ID.',
  })
  @ApiBody({ type: VerifyRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Verification executed. `sourcesChecked: 0` (verdict "insufficient") means no relevant evidence was found, not that the claim is false.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            claim: { type: 'string' },
            verdict: { type: 'string', enum: ['supported', 'contradicted', 'mixed', 'insufficient'] },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            evidence: { type: 'array', items: EVIDENCE_ITEM_SCHEMA },
            agreementCount: { type: 'integer' },
            contradictionCount: { type: 'integer' },
            sourcesChecked: { type: 'integer' },
          },
        },
        meta: {
          type: 'object',
          properties: { requestId: { type: 'string', example: 'req_1a2b3c...' } },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'The request failed validation (e.g. claim too short, unsupported sourceTypes value).' })
  async verify(@Body() dto: VerifyRequestDto): Promise<ApiSuccessResponse<VerifyResponseData>> {
    const requestId = RequestContext.requestId ?? 'unknown';
    const data = await this.verifyService.verify(dto, requestId);
    return { data, meta: { requestId } };
  }
}
