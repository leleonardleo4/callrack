import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ALLOWED_CENSUS_DATASETS, type AllowedCensusDataset } from '../../government/index.js';
import { SUPPORTED_RESEARCH_SOURCES, type ResearchSourceName } from '../research-sources.constants.js';

const VARIABLE_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,20}$/;
/** A single, unchained geography clause, e.g. "state:*", "state:06", "county:*". */
const GEOGRAPHY_PATTERN = /^[a-zA-Z ]+:(\*|[a-zA-Z0-9\s,]+)$/;
const MIN_YEAR = 2009;
const MAX_YEAR = 2035;
const MAX_VARIABLES = 10;
const MAX_SOURCES = SUPPORTED_RESEARCH_SOURCES.length;
const MAX_LIMIT = 10;

/**
 * Government/Census cannot be derived from free text — it requires the same
 * structured parameters as `POST /v1/government/census`. These are only
 * validated (and required) when "government" is listed in `sources`.
 */
export class ResearchGovernmentOptionsDto {
  @ApiProperty({ description: 'Which Census dataset to query.', enum: ALLOWED_CENSUS_DATASETS, example: 'acs/acs1' })
  @IsIn(ALLOWED_CENSUS_DATASETS)
  dataset!: AllowedCensusDataset;

  @ApiProperty({ description: 'Data year for the dataset vintage.', example: 2021, minimum: MIN_YEAR, maximum: MAX_YEAR })
  @IsInt()
  @Min(MIN_YEAR)
  @Max(MAX_YEAR)
  year!: number;

  @ApiProperty({
    description: 'Census variable codes to retrieve (e.g. "NAME", "B01001_001E").',
    example: ['NAME', 'B01001_001E'],
    minItems: 1,
    maxItems: MAX_VARIABLES,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_VARIABLES)
  @IsString({ each: true })
  @Matches(VARIABLE_PATTERN, { each: true, message: 'each variable must look like "NAME" or "B01001_001E"' })
  variables!: string[];

  @ApiProperty({
    description: 'A single Census geography clause (e.g. "state:*", "state:06").',
    example: 'state:*',
    minLength: 3,
    maxLength: 100,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @Matches(GEOGRAPHY_PATTERN, { message: 'government.forGeography must look like "state:*" or "state:06"' })
  forGeography!: string;
}

export class ResearchRequestDto {
  @ApiProperty({
    description: 'The research question or topic to gather information about.',
    example: 'renewable energy investment in Africa',
    minLength: 3,
    maxLength: 500,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  query!: string;

  @ApiProperty({
    description:
      'Which Callrack capabilities to consult. Defaults to academic + news + knowledge when omitted. ' +
      '"government" additionally requires the `government` options object.',
    enum: SUPPORTED_RESEARCH_SOURCES,
    isArray: true,
    example: ['academic', 'news', 'knowledge'],
    required: false,
    minItems: 1,
    maxItems: MAX_SOURCES,
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SOURCES)
  @IsIn(SUPPORTED_RESEARCH_SOURCES, { each: true })
  sources?: ResearchSourceName[];

  @ApiProperty({
    description: 'Maximum number of results requested from each search-based source.',
    example: 5,
    minimum: 1,
    maximum: MAX_LIMIT,
    default: 5,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit?: number;

  @ApiProperty({
    description: 'Required when `sources` includes "government"; ignored otherwise.',
    type: ResearchGovernmentOptionsDto,
    required: false,
  })
  @ValidateIf((dto: ResearchRequestDto) => Array.isArray(dto.sources) && dto.sources.includes('government'))
  @IsDefined({ message: 'government is required when "government" is included in sources' })
  @ValidateNested()
  @Type(() => ResearchGovernmentOptionsDto)
  government?: ResearchGovernmentOptionsDto;
}
