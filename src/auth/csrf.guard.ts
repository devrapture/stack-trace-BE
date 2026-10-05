import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { Observable } from 'rxjs';
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, csrfTokenMatch } from './csrf.js';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    if (request.headers.authorization) return true;

    const csrfCookieToken = request.cookies?.[CSRF_COOKIE_NAME];
    const csrfHeaderToken = request.headers?.[CSRF_HEADER_NAME];

    if (!csrfTokenMatch(csrfCookieToken, csrfHeaderToken)) {
      throw new ForbiddenException('CSRF token missing or invalid.');
    }

    return true;
  }
}
