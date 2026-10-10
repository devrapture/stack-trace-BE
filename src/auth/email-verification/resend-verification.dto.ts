import { IsEmail } from 'class-validator';

export class ResendVerificationDto {
  @IsEmail(
    {},
    {
      message: 'Please enter a valid email address.',
    },
  )
  email: string;
}

export class ResendVerificationResponseDto {
  message: string;
}
