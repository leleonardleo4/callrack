import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class AcademicSearchRequestDto {
  @ApiProperty({
    description: 'Free-text search query.',
    example: 'large language models healthcare',
    minLength: 1,
    maxLength: 500,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  query!: string;

  @ApiProperty({
    description: 'Maximum number of results to return.',
    example: 10,
    minimum: 1,
    maximum: 50,
    default: 10,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
