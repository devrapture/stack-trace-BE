import { Module } from '@nestjs/common';
import { PlatformConfigModule } from '../config/platform-config.module.js';
import { EmailModule } from '../email/email.module.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { EMAIL_VERIFICATION_REPOSITORY } from './email-verification.repository.js';
import { OtpService } from './otp.service.js';
import { PASSWORD_CREDENTIALS_REPOSITORY } from './password/password-credentials.repository.js';
import { PasswordHasher } from './password/password.hasher.js';
import { PrismaPasswordCredentialsRepository } from './password/prisma-password-credentials.repository.js';
import { PrismaEmailVerificationRepository } from './prisma-email-verification.repository.js';
import { RegistrationService } from './registration.service.js';

@Module({
  imports: [PlatformConfigModule, UsersModule, EmailModule],
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
  ],
  exports: [
    PasswordHasher,
    PASSWORD_CREDENTIALS_REPOSITORY,
    EMAIL_VERIFICATION_REPOSITORY,
  ],
  controllers: [AuthController],
})
export class AuthModule {}
