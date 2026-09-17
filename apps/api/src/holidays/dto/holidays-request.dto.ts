import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsString, Matches, Max, Min } from 'class-validator';

const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

function toUpperTrimmed(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

export class HolidaysRequestDto {
  @ApiProperty({
    description: 'ISO 3166-1 alpha-2 country code.',
    example: 'NG',
  })
  @Transform(({ value }) => toUpperTrimmed(value))
  @IsString()
  @Matches(COUNTRY_CODE_PATTERN, { message: 'country must be a 2-letter ISO 3166-1 country code, e.g. "NG"' })
  country!: string;

  @ApiProperty({
    description: 'Calendar year.',
    example: 2026,
    minimum: 1900,
    maximum: 2100,
  })
  @IsInt()
  @Min(1900)
  @Max(2100)
  year!: number;
}
