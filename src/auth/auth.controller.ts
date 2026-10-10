import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { type FastifyReply, type FastifyRequest } from 'fastify';
import { AppError } from '../common/error/app-error.js';
import { ErrorCode } from '../common/error/error-codes.js';
import { APP_CONFIG, type AppConfig } from '../config/app-config.js';
import {
  AUTH_SESSIONS_REPOSITORY,
  type AuthSessionsRepository,
} from '../sessions/auth-sessions.repository.js';
import { CurrentUser } from '../sessions/current-user.decorator.js';
import { type RequestUser } from '../sessions/jwt.strategy.js';
import { Public } from '../sessions/public.decorator.js';
import { IssuedSession, SessionService } from '../sessions/session.service.js';
import {
  USERS_REPOSITORY,
  type UsersRepository,
} from '../users/users.repository.js';
import {
  clearAuthCookies,
  REFRESH_TOKEN_COOKIE,
  setAuthCookies,
} from './cookies.js';
import { CsrfGuard } from './csrf.guard.js';
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  csrfTokenMatch,
  generateCsrfToken,
} from './csrf.js';
import type { AuthResponseDto } from './dto/auth-response.dto.js';
import {
  ForgotPasswordDto,
  ForgotPasswordResponseDto,
} from './dto/forgot-password.dto.js';
import { LoginDto, LoginResponseDto } from './dto/login.dto.js';
import { RefreshDto, type RefreshResponseDto } from './dto/refresh.dto.js';
import {
  ResetPasswordDto,
  ResetPasswordResponseDto,
} from './dto/reset-password.dto.js';
import { EmailVerificationService } from './email-verification/email-verification.service.js';
import {
  ResendVerificationDto,
  ResendVerificationResponseDto,
} from './email-verification/resend-verification.dto.js';
import { VerifyEmailOtpDto } from './email-verification/verify-email.dto.js';
import { LoginService } from './login.service.js';
import { PasswordResetService } from './password/password-reset.service.js';
import { RegisterDto } from './registration/register.dto.js';
import { RegistrationService } from './registration/registration.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(APP_CONFIG)
    private readonly config: AppConfig,
    @Inject(USERS_REPOSITORY)
    private readonly userRepository: UsersRepository,
    @Inject(AUTH_SESSIONS_REPOSITORY)
    private readonly authSessionsRepository: AuthSessionsRepository,
    private readonly registrationService: RegistrationService,
    private readonly verificationService: EmailVerificationService,
    private readonly loginService: LoginService,
    private readonly sessionService: SessionService,
    private readonly passwordResetService: PasswordResetService,
  ) {}
  @Public()
  @Post('register')
  @HttpCode(202)
  @Throttle({
    default: {
      limit: 10,
      ttl: 60_000,
    },
  })
  async register(@Body() dto: RegisterDto) {
    return this.registrationService.register(dto);
  }

  @Public()
  @Post('email-verification/verify')
  @HttpCode(202)
  @Throttle({
    default: {
      limit: 10,
      ttl: 60_000,
    },
  })
  async verify(@Body() dto: VerifyEmailOtpDto) {
    return this.verificationService.verify(dto);
  }

  @Public()
  @Post('email-verification/resend')
  @HttpCode(202)
  @Throttle({
    default: {
      limit: 3,
      ttl: 300_000,
    },
  })
  async resend(
    @Body() dto: ResendVerificationDto,
  ): Promise<ResendVerificationResponseDto> {
    return this.verificationService.resend(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({
    default: {
      limit: 10,
      ttl: 60_000,
    },
  })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<LoginResponseDto> {
    const { session } = await this.loginService.login(dto);
    return this.respond(session, reply);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @Throttle({
    default: {
      limit: 20,
      ttl: 60_000,
    },
  })
  async refresh(
    @Body() dto: RefreshDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<RefreshResponseDto> {
    if (
      !dto.refreshToken &&
      !csrfTokenMatch(
        request.cookies?.[CSRF_COOKIE_NAME],
        request.headers[CSRF_HEADER_NAME],
      )
    ) {
      throw new ForbiddenException('CSRF token missing or invalid.');
    }
    const refreshToken =
      dto.refreshToken ?? request.cookies?.[REFRESH_TOKEN_COOKIE];
    if (!refreshToken)
      throw new AppError(
        ErrorCode.INVALID_REFRESH_TOKEN,
        'This refresh token is invalid or has expired.',
        HttpStatus.UNAUTHORIZED,
      );

    const session = await this.sessionService.rotateRefreshToken(refreshToken);

    return this.respond(session, reply);
  }

  @Public()
  @Post('forgot')
  @HttpCode(202)
  @Throttle({
    default: {
      limit: 5,
      ttl: 60_000,
    },
  })
  async forgot(
    @Body() dto: ForgotPasswordDto,
  ): Promise<ForgotPasswordResponseDto> {
    return this.passwordResetService.forgotPassword(dto);
  }

  @Public()
  @Post('reset')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async reset(
    @Body() dto: ResetPasswordDto,
  ): Promise<ResetPasswordResponseDto> {
    return this.passwordResetService.resetPassword(dto);
  }

  @Get('me')
  async me(@CurrentUser() currentUser: RequestUser) {
    const user = await this.userRepository.getUserById(currentUser.userId);
    if (!user) throw new NotFoundException('user not found');
    return user;
  }

  @Get('sessions')
  async listSessions(@CurrentUser() currentUser: RequestUser) {
    const sessions = await this.authSessionsRepository.findActiveForUser(
      currentUser.userId,
    );
    return sessions;
  }

  @Delete('sessions/:sessionId')
  @HttpCode(204)
  @UseGuards(CsrfGuard)
  async revokeSession(
    @CurrentUser() currentUser: RequestUser,
    @Param('sessionId') sessionId: string,
  ) {
    const session = await this.authSessionsRepository.findById(sessionId);
    if (!session || session.userId !== currentUser.userId)
      throw new AppError(
        ErrorCode.NOT_FOUND,
        'session not found',
        HttpStatus.NOT_FOUND,
      );
    await this.authSessionsRepository.revoke(session.id, 'LOGOUT');
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(CsrfGuard)
  async logout(
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.sessionService.revokeSession(user.sessionId, 'LOGOUT');
    clearAuthCookies(reply);
  }

  @Post('logout-all')
  @HttpCode(204)
  @UseGuards(CsrfGuard)
  async logoutAll(
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.sessionService.revokeAllForUser(user.userId, 'LOGOUT');
    clearAuthCookies(reply);
  }

  private respond(
    session: IssuedSession,
    reply: FastifyReply,
  ): AuthResponseDto {
    if (session.clientType === 'WEB') {
      setAuthCookies(reply, {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        refreshTokenExpiresAt: session.refreshTokenExpiresAt,
        isProduction: this.config.environment === 'production',
        csrfToken: generateCsrfToken(),
      });
      return {
        authenticated: true,
      };
    }

    return {
      authenticated: true,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    };
  }
}
