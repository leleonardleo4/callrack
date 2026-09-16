import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const ASSET_ID_PATTERN = /^[a-z0-9-]+$/;
const CURRENCY_CODE_PATTERN = /^[a-z]{3}$/;
const MAX_ASSETS = 20;

function toLowerTrimmed(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

function toLowerTrimmedArray(value: unknown): unknown {
  return Array.isArray(value) ? value.map(toLowerTrimmed) : value;
}

/** Shared request contract for both /crypto/price and /crypto/market. */
export class CryptoAssetsRequestDto {
  @ApiProperty({
    description: 'CoinGecko asset identifiers (lowercase slugs, e.g. "bitcoin").',
    example: ['bitcoin', 'ethereum'],
    minItems: 1,
    maxItems: MAX_ASSETS,
  })
  @Transform(({ value }) => toLowerTrimmedArray(value))
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ASSETS)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(64, { each: true })
  @Matches(ASSET_ID_PATTERN, { each: true, message: 'each asset must be a lowercase id, e.g. "bitcoin"' })
  assets!: string[];

  @ApiProperty({
    description: 'Quote currency (ISO-style 3-letter code, lowercase).',
    example: 'usd',
    default: 'usd',
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => toLowerTrimmed(value))
  @IsString()
  @Matches(CURRENCY_CODE_PATTERN, { message: 'currency must be a 3-letter code, e.g. "usd"' })
  currency?: string;
}
