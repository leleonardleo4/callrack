import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export type GeocodeMode = 'forward' | 'reverse';

export class GeocodeRequestDto {
  @ApiProperty({
    description: 'Which geocoding operation to perform.',
    enum: ['forward', 'reverse'],
    example: 'forward',
  })
  @IsIn(['forward', 'reverse'])
  mode!: GeocodeMode;

  @ApiProperty({
    description: 'Free-text place query. Required when mode is "forward".',
    example: 'Lagos, Nigeria',
    required: false,
    minLength: 1,
    maxLength: 200,
  })
  @ValidateIf((dto: GeocodeRequestDto) => dto.mode === 'forward')
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  query?: string;

  @ApiProperty({
    description: 'Maximum number of results to return. Only used when mode is "forward".',
    example: 5,
    minimum: 1,
    maximum: 20,
    default: 5,
    required: false,
  })
  @ValidateIf((dto: GeocodeRequestDto) => dto.mode === 'forward')
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;

  @ApiProperty({
    description: 'Latitude in decimal degrees. Required when mode is "reverse".',
    example: 6.5244,
    minimum: -90,
    maximum: 90,
    required: false,
  })
  @ValidateIf((dto: GeocodeRequestDto) => dto.mode === 'reverse')
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiProperty({
    description: 'Longitude in decimal degrees. Required when mode is "reverse".',
    example: 3.3792,
    minimum: -180,
    maximum: 180,
    required: false,
  })
  @ValidateIf((dto: GeocodeRequestDto) => dto.mode === 'reverse')
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}
