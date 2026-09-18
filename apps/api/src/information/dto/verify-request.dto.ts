import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { INFORMATION_SOURCE_NAMES, type InformationSourceName } from '../information-sources.constants.js';

const MIN_MAX_SOURCES = 3;
const MAX_MAX_SOURCES = 30;
const DEFAULT_MAX_SOURCES = 12;

export class VerifyRequestDto {
  @ApiProperty({
    description: 'The claim to verify.',
    example: 'Nigeria is the most populous country in Africa.',
    minLength: 5,
    maxLength: 500,
  })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  claim!: string;

  @ApiProperty({
    description: 'Which Callrack capabilities to check for relevant evidence. Defaults to academic + news + knowledge.',
    enum: INFORMATION_SOURCE_NAMES,
    isArray: true,
    example: ['academic', 'news', 'knowledge'],
    required: false,
    minItems: 1,
    maxItems: INFORMATION_SOURCE_NAMES.length,
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(INFORMATION_SOURCE_NAMES.length)
  @IsIn(INFORMATION_SOURCE_NAMES, { each: true })
  sourceTypes?: InformationSourceName[];

  @ApiProperty({
    description: 'Maximum total evidence items to consider across every checked source.',
    example: DEFAULT_MAX_SOURCES,
    minimum: MIN_MAX_SOURCES,
    maximum: MAX_MAX_SOURCES,
    default: DEFAULT_MAX_SOURCES,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(MIN_MAX_SOURCES)
  @Max(MAX_MAX_SOURCES)
  maxSources?: number;
}
