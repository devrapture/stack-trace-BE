import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import { AccessTokenClaims } from './access-token.service.js';

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

  validate(payload: AccessTokenClaims): RequestUser {
    return { userId: payload.sub, sessionId: payload.sid };
  }
}
