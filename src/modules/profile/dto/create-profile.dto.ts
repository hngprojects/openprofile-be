import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateProfileDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'username can only contain lowercase letters, numbers and hyphens',
  })
  username: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  fullName: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  bio: string;

  @IsOptional()
  @IsUrl()
  photoUrl: string;
}