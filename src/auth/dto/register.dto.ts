import { IsEmail, IsString, Length } from 'class-validator';
import { PASSWORD_POLICY } from '../password/password-policy.js';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(PASSWORD_POLICY.minLength, PASSWORD_POLICY.maxLength)
  password: string;
}

export class RegisterResponseDto {
  message: string;
}
