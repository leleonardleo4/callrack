import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { ApiSuccessResponse } from '../common/http/api-response.interface.js';
import { RequestContext } from '../common/request-context/request-context.js';
import { GeocodeService } from './geocode.service.js';
import { GeocodeRequestDto } from './dto/geocode-request.dto.js';
import type { GeocodeResponseData } from './geocode-response.types.js';

const LOCATION_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', nullable: true, example: '27565124' },
    name: { type: 'string', nullable: true, example: 'Lagos' },
    street: { type: 'string', nullable: true },
    houseNumber: { type: 'string', nullable: true },
    city: { type: 'string', nullable: true, example: 'Lagos' },
    state: { type: 'string', nullable: true, example: 'Lagos' },
    country: { type: 'string', nullable: true, example: 'Nigeria' },
    countryCode: { type: 'string', nullable: true, example: 'NG' },
    postcode: { type: 'string', nullable: true },
    latitude: { type: 'number', example: 6.5244 },
    longitude: { type: 'number', example: 3.3792 },
    type: { type: 'string', nullable: true, example: 'city' },
  },
} as const;

@ApiTags('Geocode')
@Controller('geocode')
export class GeocodeController {
  constructor(private readonly geocodeService: GeocodeService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Forward or reverse geocode',
    description:
      'Resolves a place name to coordinates (mode "forward") or coordinates to a place (mode "reverse") via Photon.',
  })
  @ApiBody({ type: GeocodeRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Geocoding completed successfully. An empty `results` array is not an error.',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'object', properties: { results: { type: 'array', items: LOCATION_SCHEMA } } },
        meta: { type: 'object', properties: { requestId: { type: 'string', example: 'req_1a2b3c...' } } },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'The request failed validation.' })
  @ApiResponse({ status: 429, description: 'The upstream provider is rate-limiting requests.' })
  @ApiResponse({ status: 502, description: 'The upstream provider is unavailable.' })
  @ApiResponse({ status: 504, description: 'The upstream provider timed out.' })
  async geocode(@Body() dto: GeocodeRequestDto): Promise<ApiSuccessResponse<GeocodeResponseData>> {
    const requestId = RequestContext.requestId ?? 'unknown';
    const data = await this.geocodeService.geocode(dto, requestId);
    return { data, meta: { requestId } };
  }
}
