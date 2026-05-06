import { IsEmail, IsNotEmpty } from 'class-validator';

export class CreateWaitlistDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
