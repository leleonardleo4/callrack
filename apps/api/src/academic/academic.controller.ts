import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { ApiSuccessResponse } from '../common/http/api-response.interface.js';
import { RequestContext } from '../common/request-context/request-context.js';
import { AcademicService } from './academic.service.js';
import { AcademicSearchRequestDto } from './dto/academic-search-request.dto.js';
import { AcademicWorkRequestDto } from './dto/academic-work-request.dto.js';
import type { AcademicSearchResponseData, AcademicWorkResponse } from './academic-response.types.js';

const ACADEMIC_WORK_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', example: 'openalex:W2741809807' },
    title: { type: 'string', example: 'The state of OA' },
    authors: { type: 'array', items: { type: 'string' }, example: ['Heather Piwowar'] },
    publicationYear: { type: 'number', nullable: true, example: 2018 },
    doi: { type: 'string', nullable: true, example: '10.7717/peerj.4375' },
    url: { type: 'string', nullable: true, example: 'https://doi.org/10.7717/peerj.4375' },
    journal: { type: 'string', nullable: true, example: 'PeerJ' },
    citations: { type: 'number', nullable: true, example: 391 },
    openAccess: { type: 'boolean', example: true },
    source: { type: 'string', example: 'openalex' },
  },
} as const;

@ApiTags('Academic')
@Controller('academic')
export class AcademicController {
  constructor(private readonly academicService: AcademicService) {}

  @Post('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Search scholarly literature',
    description:
      'Searches academic works via OpenAlex, falling back to Crossref if OpenAlex cannot fulfil the request.',
  })
  @ApiBody({ type: AcademicSearchRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Search completed successfully. An empty `results` array is not an error.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            results: { type: 'array', items: ACADEMIC_WORK_SCHEMA },
            meta: {
              type: 'object',
              properties: { count: { type: 'number', example: 10 } },
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
  @ApiResponse({ status: 400, description: 'The request failed validation.' })
  @ApiResponse({ status: 429, description: 'The upstream provider is rate-limiting requests.' })
  @ApiResponse({ status: 502, description: 'The upstream provider is unavailable.' })
  @ApiResponse({ status: 504, description: 'The upstream provider timed out.' })
  async search(
    @Body() dto: AcademicSearchRequestDto,
  ): Promise<ApiSuccessResponse<AcademicSearchResponseData>> {
    const requestId = RequestContext.requestId ?? 'unknown';
    const data = await this.academicService.search(dto, requestId);
    return { data, meta: { requestId } };
  }

  @Post('work')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Retrieve a scholarly work by DOI',
    description: 'Looks up a single academic work via OpenAlex, falling back to Crossref if needed.',
  })
  @ApiBody({ type: AcademicWorkRequestDto })
  @ApiResponse({
    status: 200,
    description: 'The work was found.',
    schema: {
      type: 'object',
      properties: {
        data: ACADEMIC_WORK_SCHEMA,
        meta: {
          type: 'object',
          properties: { requestId: { type: 'string', example: 'req_1a2b3c...' } },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'The request failed validation (e.g. malformed DOI).' })
  @ApiResponse({ status: 404, description: 'No work exists for the given DOI.' })
  @ApiResponse({ status: 502, description: 'The upstream provider is unavailable.' })
  @ApiResponse({ status: 504, description: 'The upstream provider timed out.' })
  async getWork(
    @Body() dto: AcademicWorkRequestDto,
  ): Promise<ApiSuccessResponse<AcademicWorkResponse>> {
    const requestId = RequestContext.requestId ?? 'unknown';
    const data = await this.academicService.getWork(dto, requestId);
    return { data, meta: { requestId } };
  }
}
