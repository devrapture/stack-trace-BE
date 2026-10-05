import { FastifyReply } from 'fastify';
import { CSRF_COOKIE_NAME } from './csrf.js';
import { ACCESS_TOKEN_TTL_SECONDS } from '../sessions/access-token.service.js';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

const baseCookieOptions = (isProduction: boolean) => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax' as const,
  path: '/',
});

export const setAuthCookies = (
  reply: FastifyReply,
  input: {
    accessToken: string;
    refreshToken: string;
    refreshTokenExpiresAt: Date;
    csrfToken: string;
    isProduction: boolean;
  },
) =>
  reply
    .setCookie(ACCESS_TOKEN_COOKIE, input.accessToken, {
      ...baseCookieOptions(input.isProduction),
      maxAge: ACCESS_TOKEN_TTL_SECONDS,
    })
    .setCookie(REFRESH_TOKEN_COOKIE, input.refreshToken, {
      ...baseCookieOptions(input.isProduction),
      expires: input.refreshTokenExpiresAt,
    })
    .setCookie(CSRF_COOKIE_NAME, input.csrfToken, {
      ...baseCookieOptions(input.isProduction),
      httpOnly: false,
      expires: input.refreshTokenExpiresAt,
    });

export const clearAuthCookies = (reply: FastifyReply) =>
  reply
    .clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' })
    .clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' })
    .clearCookie(CSRF_COOKIE_NAME, { path: '/' });
