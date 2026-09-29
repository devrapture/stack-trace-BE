import { IsEmail } from 'class-validator';

export class ResendVerificationDto {
  @IsEmail()
  email: string;
}

export class ResendVerificationResponseDto {
  message: string;
}
