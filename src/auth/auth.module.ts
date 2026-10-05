import { Module } from '@nestjs/common';
import { PlatformConfigModule } from '../config/platform-config.module.js';
import { EmailModule } from '../email/email.module.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { EMAIL_VERIFICATION_REPOSITORY } from './email-verification/email-verification.repository.js';
import { EmailVerificationService } from './email-verification/email-verification.service.js';
import { OtpService } from './email-verification/otp.service.js';
import { PrismaEmailVerificationRepository } from './email-verification/prisma-email-verification.repository.js';
import { PASSWORD_CREDENTIALS_REPOSITORY } from './password/password-credentials.repository.js';
import { PasswordHasher } from './password/password.hasher.js';
import { PrismaPasswordCredentialsRepository } from './password/prisma-password-credentials.repository.js';
import { RegistrationService } from './registration/registration.service.js';
import { LoginService } from './login.service.js';
import { SessionsModule } from '../sessions/sessions.module.js';

@Module({
  imports: [PlatformConfigModule, UsersModule, EmailModule, SessionsModule],
  providers: [
    PasswordHasher,
    {
      provide: PASSWORD_CREDENTIALS_REPOSITORY,
      useClass: PrismaPasswordCredentialsRepository,
    },
    {
      provide: EMAIL_VERIFICATION_REPOSITORY,
      useClass: PrismaEmailVerificationRepository,
    },
    OtpService,
    RegistrationService,
    EmailVerificationService,
    LoginService,
  ],
  exports: [
    PasswordHasher,
    PASSWORD_CREDENTIALS_REPOSITORY,
    EMAIL_VERIFICATION_REPOSITORY,
  ],
  controllers: [AuthController],
})
export class AuthModule {}
