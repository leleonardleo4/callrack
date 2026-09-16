import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

const DOI_PATTERN = /^10\.\d{4,9}\/\S+$/;

export class AcademicWorkRequestDto {
  @ApiProperty({
    description: 'Digital Object Identifier (DOI) of the work.',
    example: '10.7717/peerj.4375',
  })
  @IsString()
  @Matches(DOI_PATTERN, { message: 'doi must be a valid DOI, e.g. "10.7717/peerj.4375"' })
  doi!: string;
}
