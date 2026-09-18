import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { INFORMATION_SOURCE_NAMES, type InformationSourceName } from '../information-sources.constants.js';

const MAX_LIMIT = 10;
const DEFAULT_LIMIT = 5;

export class EvidenceRequestDto {
  @ApiProperty({
    description: 'The topic or question to gather a machine-readable evidence pack about.',
    example: 'renewable energy investment in Africa',
    minLength: 3,
    maxLength: 500,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  query!: string;

  @ApiProperty({
    description: 'Which Callrack capabilities to consult. Defaults to academic + news + knowledge.',
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
    description: 'Maximum number of results requested from each consulted source.',
    example: DEFAULT_LIMIT,
    minimum: 1,
    maximum: MAX_LIMIT,
    default: DEFAULT_LIMIT,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit?: number;
}
