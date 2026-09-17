import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

const LANGUAGE_PATTERN = /^[a-z]{2,3}(-[a-zA-Z0-9]{2,8})?$/;

export class KnowledgeSearchRequestDto {
  @ApiProperty({
    description: 'Free-text entity/knowledge search query.',
    example: 'Lagos',
    minLength: 1,
    maxLength: 200,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  query!: string;

  @ApiProperty({
    description: 'Maximum number of results to return.',
    example: 10,
    minimum: 1,
    maximum: 20,
    default: 10,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;

  @ApiProperty({
    description: 'ISO-style language code for labels/descriptions (e.g. "en", "fr").',
    example: 'en',
    default: 'en',
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString()
  @Matches(LANGUAGE_PATTERN, { message: 'language must be an ISO-style code, e.g. "en" or "pt-br"' })
  language?: string;
}
