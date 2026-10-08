import { IsEmail, IsString, Length, Matches } from 'class-validator';
import { PASSWORD_POLICY } from './../password/password-policy.js';

export class ResetPasswordDto {
  @IsEmail({}, { message: 'Please enter a valid email address.' })
  email: string;

  @Matches(/^\d{6}$/, { message: 'otp must be exactly 6 digits' })
  otp: string;

  @IsString()
  @Length(PASSWORD_POLICY.minLength, PASSWORD_POLICY.maxLength)
  newPassword: string;
}

export interface ResetPasswordResponseDto {
  message: string;
}
