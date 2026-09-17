import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ALLOWED_CENSUS_DATASETS, type AllowedCensusDataset } from '../census-datasets.constants.js';

const VARIABLE_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,20}$/;
/** A single, unchained geography clause, e.g. "state:*", "state:06", "county:*". */
const GEOGRAPHY_PATTERN = /^[a-zA-Z ]+:(\*|[a-zA-Z0-9\s,]+)$/;

const MIN_YEAR = 2009;
const MAX_YEAR = 2035;
const MAX_VARIABLES = 10;

export class CensusQueryRequestDto {
  @ApiProperty({
    description: 'Which Census dataset to query.',
    enum: ALLOWED_CENSUS_DATASETS,
    example: 'acs/acs1',
  })
  @IsIn(ALLOWED_CENSUS_DATASETS)
  dataset!: AllowedCensusDataset;

  @ApiProperty({
    description: 'Data year for the dataset vintage.',
    example: 2021,
    minimum: MIN_YEAR,
    maximum: MAX_YEAR,
  })
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
    description:
      'A single Census geography clause (e.g. "state:*", "state:06", "county:*"). Chained clauses ' +
      '("&in=...") are not supported in this initial capability.',
    example: 'state:*',
    minLength: 3,
    maxLength: 100,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @Matches(GEOGRAPHY_PATTERN, { message: 'forGeography must look like "state:*" or "state:06"' })
  forGeography!: string;
}
