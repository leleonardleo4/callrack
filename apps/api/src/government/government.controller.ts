import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { ApiSuccessResponse } from '../common/http/api-response.interface.js';
import { RequestContext } from '../common/request-context/request-context.js';
import { CensusService, CENSUS_SOURCE } from './census.service.js';
import { CensusQueryRequestDto } from './dto/census-query-request.dto.js';
import { ALLOWED_CENSUS_DATASETS } from './census-datasets.constants.js';
import type { CensusQueryResponseData } from './government-response.types.js';

@ApiTags('Government')
@Controller('government')
export class GovernmentController {
  constructor(private readonly censusService: CensusService) {}

  @Post('census')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Query US Census Bureau statistical data',
    description:
      'Queries a constrained subset of US Census Bureau datasets (currently: ' +
      `${ALLOWED_CENSUS_DATASETS.join(', ')}). This capability targets US Census data specifically — it is ` +
      'not a general worldwide government-data API, and it is not an unrestricted proxy to the full Census ' +
      'API (allowed datasets, variable count, and geography syntax are all constrained). Data is public domain ' +
      '(US government work), but Callrack does not own or guarantee the underlying figures.',
  })
  @ApiBody({ type: CensusQueryRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Query completed successfully. A valid query matching no rows returns an empty `rows` array.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            dataset: { type: 'string', example: 'acs/acs1' },
            year: { type: 'number', example: 2021 },
            columns: { type: 'array', items: { type: 'string' }, example: ['NAME', 'B01001_001E'] },
            rows: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: { type: 'string' },
                example: { NAME: 'California', B01001_001E: '39029342' },
              },
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            requestId: { type: 'string', example: 'req_1a2b3c...' },
            source: { type: 'string', example: CENSUS_SOURCE },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'The request failed validation (e.g. unsupported dataset, malformed geography, or too many variables).' })
  @ApiResponse({ status: 429, description: 'The upstream provider is rate-limiting requests.' })
  @ApiResponse({ status: 502, description: 'The upstream provider is unavailable.' })
  @ApiResponse({ status: 504, description: 'The upstream provider timed out.' })
  async query(
    @Body() dto: CensusQueryRequestDto,
  ): Promise<ApiSuccessResponse<CensusQueryResponseData>> {
    const requestId = RequestContext.requestId ?? 'unknown';
    const data = await this.censusService.query(dto, requestId);
    return { data, meta: { requestId, source: CENSUS_SOURCE } };
  }
}
