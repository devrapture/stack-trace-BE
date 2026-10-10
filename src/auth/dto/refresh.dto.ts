import { IsOptional, IsString } from 'class-validator';
import type { AuthResponseDto } from './auth-response.dto.js';

export class RefreshDto {
  @IsString()
  @IsOptional()
  refreshToken?: string;
}

export type RefreshResponseDto = AuthResponseDto;
