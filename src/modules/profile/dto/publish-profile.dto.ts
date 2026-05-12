import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class PublishProfileDto {
  @ApiProperty({
    description: 'Profile visibility action',
    example: 'publish',
    enum: ['publish', 'unpublish'],
  })
  @IsNotEmpty({
    message: 'Please specify an action: publish or unpublish',
  })
  @IsString()
  @IsIn(['publish', 'unpublish'], {
    message: 'Action must be either publish or unpublish.',
  })
  action: 'publish' | 'unpublish';
}