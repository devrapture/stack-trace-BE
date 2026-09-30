import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { EmailVerificationService } from './email-verification/email-verification.service.js';
import {
  ResendVerificationDto,
  ResendVerificationResponseDto,
} from './email-verification/resend-verification.dto.js';
import { VerifyEmailOtpDto } from './email-verification/verify-email.dto.js';
import { RegisterDto } from './registration/register.dto.js';
import { RegistrationService } from './registration/registration.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly registrationService: RegistrationService,
    private readonly verificationService: EmailVerificationService,
  ) {}
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
}
