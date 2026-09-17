import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { ApiSuccessResponse } from '../common/http/api-response.interface.js';
import { RequestContext } from '../common/request-context/request-context.js';
import { WeatherService } from './weather.service.js';
import { WeatherRequestDto } from './dto/weather-request.dto.js';
import type { WeatherResponseData } from './weather-response.types.js';

@ApiTags('Weather')
@Controller('weather')
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get a weather forecast for a coordinate',
    description:
      'Returns current conditions and a daily forecast via Open-Meteo. This is forecast/reference weather ' +
      'information, not a guaranteed real-time observation — precision depends entirely on the underlying ' +
      'Open-Meteo model data. Hourly forecasts are not currently supported.',
  })
  @ApiBody({ type: WeatherRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Forecast retrieved successfully.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            location: {
              type: 'object',
              properties: {
                latitude: { type: 'number', example: 6.5244 },
                longitude: { type: 'number', example: 3.3792 },
                timezone: { type: 'string', nullable: true, example: 'Africa/Lagos' },
              },
            },
            current: {
              type: 'object',
              nullable: true,
              properties: {
                time: { type: 'string', example: '2026-09-16T12:00' },
                temperature: { type: 'number', nullable: true, example: 27.4 },
                humidity: { type: 'number', nullable: true, example: 80 },
                windSpeed: { type: 'number', nullable: true, example: 12.4 },
                precipitation: { type: 'number', nullable: true, example: 0 },
                weatherCode: { type: 'number', nullable: true, example: 3 },
              },
            },
            daily: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string', example: '2026-09-16' },
                  temperatureMax: { type: 'number', nullable: true, example: 30.1 },
                  temperatureMin: { type: 'number', nullable: true, example: 24.0 },
                  weatherCode: { type: 'number', nullable: true, example: 3 },
                },
              },
            },
          },
        },
        meta: { type: 'object', properties: { requestId: { type: 'string', example: 'req_1a2b3c...' } } },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'The request failed validation.' })
  @ApiResponse({ status: 429, description: 'The upstream provider is rate-limiting requests.' })
  @ApiResponse({ status: 502, description: 'The upstream provider is unavailable.' })
  @ApiResponse({ status: 504, description: 'The upstream provider timed out.' })
  async getForecast(@Body() dto: WeatherRequestDto): Promise<ApiSuccessResponse<WeatherResponseData>> {
    const requestId = RequestContext.requestId ?? 'unknown';
    const data = await this.weatherService.getForecast(dto, requestId);
    return { data, meta: { requestId } };
  }
}
