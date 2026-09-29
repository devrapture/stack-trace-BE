import { IsEmail, Matches } from 'class-validator';

export class VerifyEmailOtpDto {
  @IsEmail({}, { message: 'email must be a valid email' })
  email: string;

  @Matches(/^\d{6}$/, { message: 'otp must be exactly 6 digits' })
  otp: string;
}

export class VerifyEmailResponseDto {
  verified: boolean;
}
