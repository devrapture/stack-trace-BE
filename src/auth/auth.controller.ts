import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RegisterDto } from './registration/register.dto.js';
import { RegistrationService } from './registration/registration.service.js';
import { VerifyEmailOtpDto } from './email-verification/verify-email.dto.js';
import { EmailVerificationService } from './email-verification/email-verification.service.js';

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
}
