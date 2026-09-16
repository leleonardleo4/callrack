import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const TIMESPAN_PATTERN = /^\d+(h|d|w|m|y)$/;

export class NewsTrendsRequestDto {
  @ApiProperty({
    description: 'Topic, entity, or event to retrieve trend volume for.',
    example: 'renewable energy',
    minLength: 1,
    maxLength: 500,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  query!: string;

  @ApiProperty({
    description: 'GDELT timespan window (e.g. "1d", "7d", "1m"). Defaults to "7d".',
    example: '7d',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(TIMESPAN_PATTERN, { message: 'timespan must look like "7d", "1w", "3m", etc.' })
  timespan?: string;
}
