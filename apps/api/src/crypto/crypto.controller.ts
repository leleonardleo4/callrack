import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { ApiSuccessResponse } from '../common/http/api-response.interface.js';
import { RequestContext } from '../common/request-context/request-context.js';
import { CryptoService } from './crypto.service.js';
import { CryptoAssetsRequestDto } from './dto/crypto-assets-request.dto.js';
import type { CryptoMarketResponseData, CryptoPriceResponseData } from './crypto-response.types.js';

const PRICE_SCHEMA = {
  type: 'object',
  properties: {
    assets: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'bitcoin' },
          symbol: { type: 'string', example: 'btc' },
          price: { type: 'number', nullable: true, example: 104523.42 },
          currency: { type: 'string', example: 'usd' },
          change24h: { type: 'number', nullable: true, example: 2.31 },
        },
      },
    },
    missing: { type: 'array', items: { type: 'string' }, example: [] },
  },
} as const;

const MARKET_SCHEMA = {
  type: 'object',
  properties: {
    markets: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'bitcoin' },
          symbol: { type: 'string', example: 'btc' },
          name: { type: 'string', example: 'Bitcoin' },
          price: { type: 'number', nullable: true, example: 104523.42 },
          currency: { type: 'string', example: 'usd' },
          marketCap: { type: 'number', nullable: true, example: 2080000000000 },
          marketCapRank: { type: 'number', nullable: true, example: 1 },
          volume24h: { type: 'number', nullable: true, example: 42000000000 },
          change24h: { type: 'number', nullable: true, example: 2.31 },
          circulatingSupply: { type: 'number', nullable: true, example: 19800000 },
          totalSupply: { type: 'number', nullable: true, example: 21000000 },
          maxSupply: { type: 'number', nullable: true, example: 21000000 },
        },
      },
    },
    missing: { type: 'array', items: { type: 'string' }, example: [] },
  },
} as const;

@ApiTags('Crypto')
@Controller('crypto')
export class CryptoController {
  constructor(private readonly cryptoService: CryptoService) {}

  @Post('price')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get current cryptocurrency prices',
    description: 'Returns current price and 24h change for one or more assets via CoinGecko.',
  })
  @ApiBody({ type: CryptoAssetsRequestDto })
  @ApiResponse({
    status: 200,
    description:
      'Prices retrieved. Any requested asset CoinGecko did not recognize is listed in `missing`, never silently dropped.',
    schema: {
      type: 'object',
      properties: {
        data: PRICE_SCHEMA,
        meta: { type: 'object', properties: { requestId: { type: 'string', example: 'req_1a2b3c...' } } },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'The request failed validation.' })
  @ApiResponse({ status: 429, description: 'The upstream provider is rate-limiting requests.' })
  @ApiResponse({ status: 502, description: 'The upstream provider is unavailable.' })
  @ApiResponse({ status: 504, description: 'The upstream provider timed out.' })
  async getPrices(
    @Body() dto: CryptoAssetsRequestDto,
  ): Promise<ApiSuccessResponse<CryptoPriceResponseData>> {
    const requestId = RequestContext.requestId ?? 'unknown';
    const data = await this.cryptoService.getPrices(dto, requestId);
    return { data, meta: { requestId } };
  }

  @Post('market')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get cryptocurrency market data',
    description:
      'Returns broader market data (market cap, rank, volume, supply) for one or more assets via CoinGecko.',
  })
  @ApiBody({ type: CryptoAssetsRequestDto })
  @ApiResponse({
    status: 200,
    description:
      'Market data retrieved. Any requested asset CoinGecko did not recognize is listed in `missing`, never silently dropped.',
    schema: {
      type: 'object',
      properties: {
        data: MARKET_SCHEMA,
        meta: { type: 'object', properties: { requestId: { type: 'string', example: 'req_1a2b3c...' } } },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'The request failed validation.' })
  @ApiResponse({ status: 429, description: 'The upstream provider is rate-limiting requests.' })
  @ApiResponse({ status: 502, description: 'The upstream provider is unavailable.' })
  @ApiResponse({ status: 504, description: 'The upstream provider timed out.' })
  async getMarketData(
    @Body() dto: CryptoAssetsRequestDto,
  ): Promise<ApiSuccessResponse<CryptoMarketResponseData>> {
    const requestId = RequestContext.requestId ?? 'unknown';
    const data = await this.cryptoService.getMarketData(dto, requestId);
    return { data, meta: { requestId } };
  }
}
