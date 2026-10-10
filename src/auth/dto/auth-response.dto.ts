export interface AuthResponseDto {
  readonly authenticated: true;
  readonly accessToken?: string;
  readonly refreshToken?: string;
}
