import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import { AccessTokenClaims } from './access-token.service.js';
import {
  AUTH_SESSIONS_REPOSITORY,
  type AuthSessionsRepository,
} from './auth-sessions.repository.js';

export interface RequestUser {
  userId: string;
  sessionId: string;
}

const cookieExtractor = (
  req: { cookies?: Record<string, string> } | undefined,
): string | null => {
  return req?.cookies?.access_token ?? null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(APP_CONFIG)
    private readonly config: AppConfig,
    @Inject(AUTH_SESSIONS_REPOSITORY)
    private readonly authSessionsRepository: AuthSessionsRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        cookieExtractor,
      ]),
      secretOrKey: config.jwtPublicKey.replace(/\\n/g, '\n'),
      algorithms: ['RS256'],
    });
  }

  async validate(payload: AccessTokenClaims): Promise<RequestUser> {
    if (!payload.sub || !payload.sid) {
      throw new UnauthorizedException();
    }

    const session = await this.authSessionsRepository.findById(payload.sid);

    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException();
    }

    return { userId: payload.sub, sessionId: payload.sid };
  }
}
