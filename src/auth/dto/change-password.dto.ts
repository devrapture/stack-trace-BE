import { IsString, Length } from 'class-validator';
import { PASSWORD_POLICY } from '../password/password-policy.js';

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @Length(PASSWORD_POLICY.minLength, PASSWORD_POLICY.maxLength)
  newPassword: string;
}

export interface ChangePasswordResponseDto {
  message: string;
}
