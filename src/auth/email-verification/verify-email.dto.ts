import { IsEmail, Matches } from 'class-validator';

export class VerifyEmailOtpDto {
  @IsEmail({}, { message: 'Please enter a valid email address.' })
  email: string;

  @Matches(/^\d{6}$/, { message: 'otp must be exactly 6 digits' })
  otp: string;
}

export class VerifyEmailResponseDto {
  verified: boolean;
}
