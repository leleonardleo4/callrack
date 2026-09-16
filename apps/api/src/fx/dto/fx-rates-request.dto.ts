import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsOptional, IsString, Matches } from 'class-validator';

const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;
const MAX_CURRENCIES = 20;

function toUpperTrimmed(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

function toUpperTrimmedArray(value: unknown): unknown {
  return Array.isArray(value) ? value.map(toUpperTrimmed) : value;
}

export class FxRatesRequestDto {
  @ApiProperty({
    description: 'Base currency (ISO-style 3-letter code).',
    example: 'USD',
  })
  @Transform(({ value }) => toUpperTrimmed(value))
  @IsString()
  @Matches(CURRENCY_CODE_PATTERN, { message: 'base must be a 3-letter currency code, e.g. "USD"' })
  base!: string;

  @ApiProperty({
    description: 'Target currencies to quote against the base currency.',
    example: ['EUR', 'GBP', 'NGN'],
    minItems: 1,
    maxItems: MAX_CURRENCIES,
  })
  @Transform(({ value }) => toUpperTrimmedArray(value))
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_CURRENCIES)
  @IsString({ each: true })
  @Matches(CURRENCY_CODE_PATTERN, { each: true, message: 'each currency must be a 3-letter code, e.g. "EUR"' })
  currencies!: string[];

  @ApiProperty({
    description:
      'Historical date (YYYY-MM-DD) for reference rates as of that day. Omit for the latest available reference rates.',
    example: '2026-09-15',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  date?: string;
}
