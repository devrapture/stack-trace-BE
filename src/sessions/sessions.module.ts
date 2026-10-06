import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { APP_CONFIG, AppConfig } from '../config/app-config.js';
import { PlatformConfigModule } from '../config/platform-config.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { UsersModule } from '../users/users.module.js';
import { AccessTokenService } from './access-token.service.js';
import { AUTH_SESSIONS_REPOSITORY } from './auth-sessions.repository.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { PrismaAuthSessionsRepository } from './prisma-auth-sessions.repository.js';
import { SessionService } from './session.service.js';
import { JwtStrategy } from './jwt.strategy.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [PlatformConfigModule],
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        privateKey: config.jwtPrivateKey.replace(/\\n/g, '\n'),
        publicKey: config.jwtPublicKey.replace(/\\n/g, '\n'),
        signOptions: {
          algorithm: 'RS256',
          keyid: config.jwtKid,
        },
        verifyOptions: {
          algorithms: ['RS256'],
        },
      }),
    }),
    PlatformConfigModule,
    PrismaModule,
    UsersModule,
  ],
  providers: [
    AccessTokenService,
    SessionService,
    JwtStrategy,
    JwtAuthGuard,
    {
      provide: AUTH_SESSIONS_REPOSITORY,
      useClass: PrismaAuthSessionsRepository,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
  exports: [SessionService, JwtAuthGuard, AUTH_SESSIONS_REPOSITORY],
})
export class SessionsModule {}
