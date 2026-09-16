import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { ApiSuccessResponse } from '../common/http/api-response.interface.js';
import { RequestContext } from '../common/request-context/request-context.js';
import { FxService } from './fx.service.js';
import { FxRatesRequestDto } from './dto/fx-rates-request.dto.js';
import type { FxRatesResponseData } from './fx-response.types.js';

@ApiTags('FX')
@Controller('fx')
export class FxController {
  constructor(private readonly fxService: FxService) {}

  @Post('rates')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get foreign exchange reference rates',
    description:
      'Returns current or historical foreign exchange reference rates via Frankfurter (European Central Bank data). ' +
      'These are official daily reference rates, not live trading prices, guaranteed execution prices, exchange ' +
      'quotes, or broker rates.',
  })
  @ApiBody({ type: FxRatesRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Reference rates retrieved successfully.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            base: { type: 'string', example: 'USD' },
            date: { type: 'string', example: '2026-09-15' },
            rates: {
              type: 'object',
              additionalProperties: { type: 'number' },
              example: { EUR: 0.85, GBP: 0.74, NGN: 1530.22 },
            },
          },
        },
        meta: { type: 'object', properties: { requestId: { type: 'string', example: 'req_1a2b3c...' } } },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'The request failed validation, or a requested currency is not supported.',
  })
  @ApiResponse({ status: 429, description: 'The upstream provider is rate-limiting requests.' })
  @ApiResponse({ status: 502, description: 'The upstream provider is unavailable.' })
  @ApiResponse({ status: 504, description: 'The upstream provider timed out.' })
  async getRates(@Body() dto: FxRatesRequestDto): Promise<ApiSuccessResponse<FxRatesResponseData>> {
    const requestId = RequestContext.requestId ?? 'unknown';
    const data = await this.fxService.getRates(dto, requestId);
    return { data, meta: { requestId } };
  }
}
