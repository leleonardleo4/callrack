import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class WeatherRequestDto {
  @ApiProperty({ description: 'Latitude in decimal degrees.', example: 6.5244, minimum: -90, maximum: 90 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty({ description: 'Longitude in decimal degrees.', example: 3.3792, minimum: -180, maximum: 180 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @ApiProperty({
    description: 'Number of days of daily forecast to include.',
    example: 3,
    minimum: 1,
    maximum: 16,
    default: 3,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(16)
  days?: number;
}
