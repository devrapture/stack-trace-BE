import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import type { AuthResponseDto } from './auth-response.dto.js';

const CLIENT_TYPES = ['WEB', 'IOS', 'ANDROID', 'OTHER'] as const;

export class LoginDto {
  @IsEmail({}, { message: 'Please enter a valid email address.' })
  email: string;

  @IsString()
  password: string;

  @IsIn(CLIENT_TYPES)
  clientType: (typeof CLIENT_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceName: string;
}

export type LoginResponseDto = AuthResponseDto;
