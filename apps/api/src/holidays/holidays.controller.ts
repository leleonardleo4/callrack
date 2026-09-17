import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { ApiSuccessResponse } from '../common/http/api-response.interface.js';
import { RequestContext } from '../common/request-context/request-context.js';
import { HolidaysService } from './holidays.service.js';
import { HolidaysRequestDto } from './dto/holidays-request.dto.js';
import type { HolidaysResponseData } from './holidays-response.types.js';

@ApiTags('Holidays')
@Controller('holidays')
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get public holidays for a country and year',
    description: 'Returns public holidays for a country/year via Nager.Date.',
  })
  @ApiBody({ type: HolidaysRequestDto })
  @ApiResponse({
    status: 200,
    description:
      'Holidays retrieved successfully. A recognized country/year with no public holidays on record ' +
      'returns an empty `holidays` array, which is not an error.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            country: { type: 'string', example: 'NG' },
            year: { type: 'number', example: 2026 },
            holidays: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string', example: '2026-10-01' },
                  name: { type: 'string', example: 'National Day' },
                  localName: { type: 'string', example: 'National Day' },
                  countryCode: { type: 'string', example: 'NG' },
                  global: { type: 'boolean', example: true },
                  counties: { type: 'array', items: { type: 'string' }, nullable: true },
                  types: { type: 'array', items: { type: 'string' }, nullable: true, example: ['Public'] },
                },
              },
            },
          },
        },
        meta: { type: 'object', properties: { requestId: { type: 'string', example: 'req_1a2b3c...' } } },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'The request failed validation, or the country code is well-formed but not recognized by Nager.Date.',
  })
  @ApiResponse({ status: 429, description: 'The upstream provider is rate-limiting requests.' })
  @ApiResponse({ status: 502, description: 'The upstream provider is unavailable.' })
  @ApiResponse({ status: 504, description: 'The upstream provider timed out.' })
  async getHolidays(@Body() dto: HolidaysRequestDto): Promise<ApiSuccessResponse<HolidaysResponseData>> {
    const requestId = RequestContext.requestId ?? 'unknown';
    const data = await this.holidaysService.getHolidays(dto, requestId);
    return { data, meta: { requestId } };
  }
}
