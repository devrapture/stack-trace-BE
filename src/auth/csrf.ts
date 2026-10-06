import { randomBytes, timingSafeEqual } from 'crypto';

export const CSRF_COOKIE_NAME = 'csrf_token';
export const CSRF_HEADER_NAME = 'x-csrf-token';

export const generateCsrfToken = (): string =>
  randomBytes(32).toString('base64url');

export const csrfTokenMatch = (
  cookieToken: unknown,
  headerToken: unknown,
): boolean => {
  if (typeof cookieToken !== 'string' || typeof headerToken !== 'string')
    return false;

  const cookieTokenByte = Buffer.from(cookieToken);
  const headerTokenByte = Buffer.from(headerToken);

  return (
    cookieTokenByte.length === headerTokenByte.length &&
    timingSafeEqual(cookieTokenByte, headerTokenByte)
  );
};
