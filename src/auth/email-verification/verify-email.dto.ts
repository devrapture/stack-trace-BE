import { IsEmail, Matches } from 'class-validator';

export class VerifyEmailOtp {
  @IsEmail()
  email: string;

  @Matches(/^\d{6}$/, { message: 'otp must be exactly 6 digits' })
  otp: string;
}
